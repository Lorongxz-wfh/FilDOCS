<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Http\Requests\DocumentStoreRequest;
use App\Http\Requests\DocumentIndexRequest;
use App\Models\Document;
use App\Models\DocumentCounter;
use App\Models\DocumentVersion;
use App\Models\Notification;
use App\Models\User;
use App\Models\WorkflowTask;
use App\Models\Office;

use App\Services\DocumentPreviewService;
use App\Services\DocumentVersionFileService;
use App\Services\DocumentShareService;
use App\Services\DocumentIndexService;


use Symfony\Component\HttpFoundation\Response;
use App\Http\Resources\DocumentResource;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use App\Models\ActivityLog;
use App\Models\Tag;
use App\Services\WorkflowSteps;

class DocumentController extends Controller
{
    public function __construct(
        private DocumentVersionFileService $versionFiles,
        private DocumentShareService $shares,
        private DocumentIndexService $docIndex
    ) {}

    private function vpRoleToOfficeCode(?string $roleName): ?string
    {
        return match ($roleName) {
            'vpaa' => 'VA',
            'vpadmin' => 'VAd',
            'vpfinance' => 'VF',
            'vpreqa' => 'VR',
            default => null,
        };
    }

    // GET /api/documents
    public function index(DocumentIndexRequest $request)
    {
        $user = $request->user();
        $documents = $this->docIndex->paginateForUser($user, $request->validated());

        return DocumentResource::collection($documents);
    }


    public function stats(Request $request)
    {
        $user = $request->user();
        $userOfficeId = $user?->office_id;

        $qaOfficeId = Cache::remember('office_id:QA', 3600, function () {
            return \App\Models\Office::where('code', 'QA')->value('id');
        });

        $roleName = $user?->role?->name ? strtolower(trim($user->role->name)) : null;

        $visibleDocs = Document::query();

        if ($qaOfficeId && (int) $userOfficeId !== (int) $qaOfficeId) {
            $visibleDocs->whereHas('latestVersion', function ($v) use ($userOfficeId) {
                $v->whereHas('tasks', function ($t) use ($userOfficeId) {
                    $t->where('status', 'open')
                        ->where('assigned_office_id', $userOfficeId);
                });
            });
        }

        if ($roleName === 'auditor') {
            // Auditor: only docs whose latest version is Distributed
            $visibleDocs->whereHas('latestVersion', function ($v) {
                $v->where('status', 'Distributed');
            });
        }

        $total = (clone $visibleDocs)->count();

        $distributed = (clone $visibleDocs)->whereHas('latestVersion', function ($v) {
            $v->where('status', 'Distributed');
        })->count();

        $pendingQuery = WorkflowTask::query()
            ->where('workflow_tasks.status', 'open')
            ->where('workflow_tasks.assigned_office_id', $userOfficeId)
            ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
            ->join('documents', 'document_versions.document_id', '=', 'documents.id')

            ->joinSub(
                DocumentVersion::query()
                    ->selectRaw('document_id, MAX(version_number) as max_version_number')
                    ->groupBy('document_id'),
                'dv_max',
                function ($join) {
                    $join->on('dv_max.document_id', '=', 'document_versions.document_id')
                        ->on('dv_max.max_version_number', '=', 'document_versions.version_number');
                }
            )
            ->selectRaw('COUNT(DISTINCT documents.id) as cnt');

        if ($roleName === 'auditor') {
            $pending = 0;
        } else {
            $pending = (int) ($pendingQuery->value('cnt') ?? 0);
        }

        return response()->json([
            'total' => $total,
            'pending' => $pending,
            'distributed' => $distributed,
        ]);
    }

    public function show(Document $document)
    {
        return new DocumentResource($document->load([
            'ownerOffice',
            'reviewOffice',
            'latestVersion',
            'latestVersion.tasks',
            'latestVersion.tasks.assignedOffice',
            'tags',
        ]));
    }

    public function versions(Request $request, Document $document)
    {
        $user = $request->user();
        $roleName = $user?->role?->name ? strtolower(trim($user->role->name)) : null;

        $canSeeAll = in_array($roleName, ['admin', 'president', 'qa'], true);

        $isSharedToMe = false;

        if (!$canSeeAll && $roleName !== 'auditor') {
            $userOfficeId = $user?->office_id;

            $isSharedToMe = $document->sharedOffices()
                ->where('offices.id', $userOfficeId)
                ->exists();

            $hasOpenTaskOnLatest = WorkflowTask::query()
                ->where('workflow_tasks.status', 'open')
                ->where('workflow_tasks.assigned_office_id', $userOfficeId)
                ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
                ->where('document_versions.document_id', $document->id)
                ->where('document_versions.version_number', function ($sq) use ($document) {
                    $sq->selectRaw('MAX(version_number)')
                        ->from('document_versions')
                        ->where('document_id', $document->id);
                })
                ->exists();

            $vpOfficeCode = $this->vpRoleToOfficeCode($roleName);
            if ($vpOfficeCode) {
                $vpOfficeId = Cache::remember("office_id:{$vpOfficeCode}", 3600, function () use ($vpOfficeCode) {
                    return \App\Models\Office::where('code', $vpOfficeCode)->value('id');
                });

                $vpOfficeIds = $vpOfficeId
                    ? Cache::remember("vp_office_ids:{$vpOfficeId}", 3600, function () use ($vpOfficeId) {
                        return \App\Models\Office::where('parent_office_id', $vpOfficeId)
                            ->pluck('id')
                            ->push($vpOfficeId)
                            ->values()
                            ->all();
                    })
                    : [];

                $inVpScope = in_array((int) $document->owner_office_id, array_map('intval', $vpOfficeIds), true);

                if (!$inVpScope && !$isSharedToMe && !$hasOpenTaskOnLatest) {
                    return response()->json(['message' => 'Forbidden.'], 403);
                }
            } else {
                // Normal user: must match owner office OR be shared OR has open task on latest
                // OR was a workflow participant at any point (covers Distributed docs)
                $wasWorkflowParticipant = WorkflowTask::query()
                    ->where('workflow_tasks.assigned_office_id', $userOfficeId)
                    ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
                    ->where('document_versions.document_id', $document->id)
                    ->exists();

                if (
                    (int) $document->owner_office_id !== (int) $userOfficeId
                    && !$isSharedToMe
                    && !$hasOpenTaskOnLatest
                    && !$wasWorkflowParticipant
                ) {
                    return response()->json(['message' => 'Forbidden.'], 403);
                }
            }
        }

        $q = DocumentVersion::query()
            ->where('document_id', $document->id);
        // Keep Cancelled in history (Option A)

        // Auditor: only Distributed history
        if ($roleName === 'auditor') {
            $q->where('status', 'Distributed');
        }

        if (!$canSeeAll && $roleName !== 'auditor' && ($isSharedToMe ?? false)) {
            $latestDistributed = DocumentVersion::query()
                ->where('document_id', $document->id)
                ->where('status', 'Distributed')
                ->orderByDesc('version_number')
                ->limit(1)
                ->get();

            return response()->json($latestDistributed);
        }

        $versions = $q->orderByDesc('version_number')->get();

        return response()->json($versions);
    }

    public function getShares(Request $request, Document $document)
    {
        $user = $request->user();
        $roleName = $user?->role?->name ? strtolower(trim($user->role->name)) : null;
        $canManage = in_array($roleName, ['admin', 'qa'], true);

        if (!$canManage) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $officeIds = $document->sharedOffices()->pluck('offices.id')->values();

        return response()->json([
            'document_id' => $document->id,
            'office_ids' => $officeIds,
        ]);
    }

    public function setShares(Request $request, Document $document)
    {
        $user = $request->user();
        $roleName = $user?->role?->name ? strtolower(trim($user->role->name)) : null;
        $canManage = in_array($roleName, ['admin', 'qa'], true);

        if (!$canManage) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'office_ids' => 'array',
            'office_ids.*' => 'integer|exists:offices,id',
        ]);

        $actorUserId = (int) ($user?->id ?? 0);
        $actorOfficeId = (int) ($user?->office_id ?? 0);

        $result = $this->shares->setShares($document, $data['office_ids'] ?? [], $actorUserId, $actorOfficeId);

        return response()->json([
            'message' => 'Shares updated.',
            'document_id' => $document->id,
            'office_ids' => $result['office_ids'],
            'added_office_ids' => $result['added_office_ids'],
            'removed_office_ids' => $result['removed_office_ids'],
        ]);
    }


    // GET /api/documents/{document}/tags
    public function getTags(Request $request, Document $document)
    {
        $document->load('tags');

        return response()->json([
            'document_id' => $document->id,
            'tags' => $document->tags->pluck('name')->values(),
        ]);
    }

    // PUT /api/documents/{document}/tags  (replace all tags)
    public function setTags(Request $request, Document $document)
    {
        $user = $request->user();
        $roleName = $user?->role?->name ? strtolower(trim($user->role->name)) : null;

        $isAdmin = ($roleName === 'admin');
        $isCreator = ((int) ($document->created_by ?? 0) === (int) ($user?->id ?? 0));

        if (!$isAdmin && !$isCreator) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'tags' => 'array|max:20',
            'tags.*' => 'string|min:1|max:30',
        ]);

        $raw = $data['tags'] ?? [];

        // Normalize: trim, collapse spaces, lower for de-dupe, keep original casing? (we’ll store normalized)
        $clean = [];
        foreach ($raw as $t) {
            $t = trim((string) $t);
            if ($t === '') continue;
            $t = preg_replace('/\s+/', ' ', $t);
            $t = mb_strtolower($t);
            $clean[] = $t;
        }

        // unique
        $clean = array_values(array_unique($clean));

        // Upsert tags, then sync pivot
        $tagIds = [];
        foreach ($clean as $name) {
            $tag = Tag::firstOrCreate(['name' => $name]);
            $tagIds[] = $tag->id;
        }

        $document->tags()->sync($tagIds);

        ActivityLog::create([
            'document_id' => $document->id,
            'document_version_id' => $document->latestVersion?->id,
            'actor_user_id' => $user?->id,
            'actor_office_id' => $user?->office_id,
            'target_office_id' => null,
            'event' => 'document.tags_updated',
            'label' => 'Updated document tags',
            'meta' => [
                'tags' => $clean,
            ],
        ]);

        return response()->json([
            'message' => 'Tags updated.',
            'document_id' => $document->id,
            'tags' => $clean,
        ]);
    }

    // POST /api/documents (create family + v0 Draft)
    public function store(DocumentStoreRequest $request)
    {
        $roleName = $request->user()?->role?->name ? strtolower(trim($request->user()->role->name)) : null;

        $data = $request->validated();

        $userOfficeId = $request->user()?->office_id;
        if (!$userOfficeId) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $routingMode = strtolower(trim((string) ($data['routing_mode'] ?? 'default')));
        if (!in_array($routingMode, ['default', 'custom'], true)) {
            $routingMode = 'default';
        }

        $doc = Document::create([
            'title' => $data['title'],
            'doctype' => $data['doctype'],

            'owner_office_id' => (int) $userOfficeId,

            // Only store review_office_id for default routing (QA flow uses it)
            'review_office_id' => ($routingMode === 'default' && !empty($data['review_office_id']))
                ? (int) $data['review_office_id']
                : null,

            'visibility_scope' => $data['visibility_scope'] ?? 'office',
            'school_year' => $data['school_year'] ?? null,
            'semester' => $data['semester'] ?? null,
            'created_by' => $request->user()->id,
        ]);


        $qaOfficeId = Office::where('code', 'QA')->value('id');
        if (!$qaOfficeId) {
            return response()->json(['message' => 'QA office not found (code=QA).'], 422);
        }

        $isQaRole = ($roleName === 'qa');
        $requestedFlow = strtolower(trim((string) ($data['workflow_type'] ?? '')));

        // Decide flow:
        // - QA role always starts QA flow
        // - non-QA can start office flow (default) unless explicitly forced to qa
        $flow = $isQaRole ? 'qa' : ($requestedFlow === 'qa' ? 'qa' : 'office');

        // (routingMode already normalized above)

        // Routing rules are validated in DocumentStoreRequest.
        // Keep only minimal defense-in-depth here (normalization + insert-time checks).


        if ($flow === 'office') {
            $initialStatus = 'Office Draft';
            $initialStep = 'office_draft';
            $assignedOfficeId = (int) $userOfficeId;
        } else {
            $initialStatus = 'Draft';
            $initialStep = 'draft';
            $assignedOfficeId = (int) $qaOfficeId;
        }

        // Create v0 version with correct starter status + workflow_type
        $version = DocumentVersion::create([
            'document_id'    => $doc->id,
            'version_number' => 0,
            'status'         => $initialStatus,
            'workflow_type'  => $flow,
            'routing_mode'   => $routingMode,
            'description'    => $data['description'] ?? null,
            'effective_date' => $data['effective_date'] ?? null,
        ]);

        $customOfficeIds = [];

        // Persist custom routing steps (review + approval use the same recipients)
        if ($routingMode === 'custom') {
            // Defense-in-depth normalization: keep order, remove invalid, de-dupe, cap to 5
            $raw = $data['custom_review_office_ids'] ?? [];
            $raw = is_array($raw) ? $raw : [];

            $ids = [];
            $seen = [];
            foreach ($raw as $x) {
                $oid = (int) $x;
                if ($oid <= 0) continue;
                if (isset($seen[$oid])) continue;
                $seen[$oid] = true;
                $ids[] = $oid;
                if (count($ids) >= 5) break;
            }

            if (count($ids) < 1) {
                return response()->json(['message' => 'Please select at least 1 recipient office for Custom flow.'], 422);
            }

            $customOfficeIds = $ids;

            $now = now();


            foreach (['review', 'approval'] as $phase) {
                foreach ($ids as $i => $officeId) {
                    DB::table('document_route_steps')->insert([
                        'document_version_id' => $version->id,
                        'phase' => $phase,
                        'step_order' => $i + 1,
                        'office_id' => (int) $officeId,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            }
        }


        WorkflowTask::create([
            'document_version_id' => $version->id,
            'phase' => 'review',
            'step' => $initialStep,
            'status' => 'open',
            'opened_at' => now(),
            'assigned_office_id' => $assignedOfficeId,
        ]);



        ActivityLog::create([
            'document_id' => $doc->id,
            'document_version_id' => $version->id,
            'actor_user_id' => $request->user()?->id,
            'actor_office_id' => $request->user()?->office_id,
            'target_office_id' => $doc->review_office_id,
            'event' => 'document.created',
            'label' => 'Created a document draft',
            'meta' => [
                'status' => $version->status,
                'version_number' => $version->version_number,
                'review_office_id' => $doc->review_office_id,
                'doctype' => $doc->doctype,
                'visibility_scope' => $doc->visibility_scope,

                // Routing capture (temporary until we add a routing table)
                'routing_mode' => $routingMode,
                'custom_review_office_ids' => ($routingMode === 'custom')
                    ? array_values($customOfficeIds)
                    : [],

            ],
        ]);

        $office = $doc->ownerOffice()->first();
        if ($office) {
            // Atomic per-(office,doctype) sequence allocation
            DB::transaction(function () use ($doc, $office) {
                $counter = DocumentCounter::query()
                    ->where('office_id', $doc->owner_office_id)
                    ->where('doctype', $doc->doctype)
                    ->lockForUpdate()
                    ->first();

                if (!$counter) {
                    $counter = DocumentCounter::create([
                        'office_id' => $doc->owner_office_id,
                        'doctype' => $doc->doctype,
                        'next_seq' => 1,
                    ]);
                }

                $seq = (int) $counter->next_seq;

                $doc->code = Document::generateCode($office, $doc->doctype, $seq);
                $doc->save();

                $counter->next_seq = $seq + 1;
                $counter->save();
            });
        }

        // File upload
        if ($request->hasFile('file')) {
            $this->versionFiles->saveVersionFile($version, $request->file('file'));
            ActivityLog::create([
                'document_id' => $doc->id,
                'document_version_id' => $version->id,
                'actor_user_id' => $request->user()?->id,
                'actor_office_id' => $request->user()?->office_id,
                'target_office_id' => null,
                'event' => 'version.file_uploaded',
                'label' => 'Uploaded a draft file',
                'meta' => [
                    'status' => $version->status,
                    'version_number' => $version->version_number,
                    'filename' => $version->original_filename,
                ],
            ]);
        }

        return (new DocumentResource($doc->load(['ownerOffice', 'latestVersion'])))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, Document $document)
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:255',
            'doctype' => 'sometimes|string|max:50',
            'owner_office_id' => 'sometimes|integer|exists:offices,id',
            'visibility_scope' => 'sometimes|in:office,global',
            'school_year' => 'sometimes|nullable|string|max:20',
            'semester' => 'sometimes|nullable|string|max:20',
        ]);

        $document->fill($data);
        $document->save();

        return new DocumentResource($document->load(['ownerOffice', 'latestVersion']));
    }

    public function createRevision(Request $request, Document $document)
    {
        $data = $request->validate([
            'revision_reason' => 'nullable|string|max:1000',
        ]);

        $latestOfficial = DocumentVersion::query()
            ->where('document_id', $document->id)
            ->whereIn('status', ['Distributed', 'Superseded'])
            ->orderByDesc('version_number')
            ->first();

        if (!$latestOfficial) {
            return response()->json(['message' => 'No official version to revise.'], 422);
        }


        // Prevent multiple active versions (only ONE active at a time per document family)
        $active = DocumentVersion::query()
            ->where('document_id', $document->id)
            ->whereNotIn('status', ['Cancelled', 'Distributed', 'Superseded'])
            ->orderByDesc('version_number')
            ->first();

        if ($active) {
            return response()->json([
                'message' => 'A draft/review/approval version is already in progress.',
                'active_version_id' => $active->id,
                'active_version_number' => $active->version_number,
                'active_status' => $active->status,
            ], 422);
        }

        $maxVersionNumber = (int) DocumentVersion::where('document_id', $document->id)
            ->max('version_number');

        $latestCancelled = DocumentVersion::query()
            ->where('document_id', $document->id)
            ->where('status', 'Cancelled')
            ->orderByDesc('version_number')
            ->first();

        $nextVersionNumber = $maxVersionNumber + 1;

        // If the latest version is Cancelled, reuse its number (Option A)
        if ($latestCancelled && (int) $latestCancelled->version_number === $maxVersionNumber) {
            $nextVersionNumber = (int) $latestCancelled->version_number;
        }

        // Inherit flow + routing from the latest official version
        $inheritedFlow    = $latestOfficial->workflow_type ?? 'qa';
        $inheritedRouting = $latestOfficial->routing_mode  ?? 'default';

        $isOfficeFlow = ($inheritedFlow === 'office');

        $qaOfficeId    = (int) Office::where('code', 'QA')->value('id');
        $ownerOfficeId = (int) ($document->owner_office_id ?? 0);

        $draftStatus      = $isOfficeFlow ? 'Office Draft' : 'Draft';
        $draftStep        = $isOfficeFlow ? WorkflowSteps::STEP_OFFICE_DRAFT : WorkflowSteps::STEP_QA_DRAFT;
        $assignedOfficeId = $isOfficeFlow ? $ownerOfficeId : $qaOfficeId;

        if ($inheritedRouting === 'custom') {
            $draftStep        = WorkflowSteps::STEP_CUSTOM_DRAFT;
            $assignedOfficeId = $ownerOfficeId ?: $qaOfficeId;
            $draftStatus      = 'Draft';
        }

        $revisionReason = $data['revision_reason'] ?? null;

        if ($latestCancelled && (int) $latestCancelled->version_number === $nextVersionNumber) {
            // Re-open the cancelled version instead of creating a new row
            $revision = $latestCancelled;
            $revision->status          = $draftStatus;
            $revision->workflow_type   = $inheritedFlow;
            $revision->routing_mode    = $inheritedRouting;
            $revision->revision_reason = $revisionReason;
            $revision->cancelled_at    = null;
            $revision->save();
        } else {
            $revision = DocumentVersion::create([
                'document_id'     => $document->id,
                'version_number'  => $nextVersionNumber,
                'status'          => $draftStatus,
                'workflow_type'   => $inheritedFlow,
                'routing_mode'    => $inheritedRouting,
                'revision_reason' => $revisionReason,
            ]);
        }

        // For custom flow revisions — re-seed route steps from the previous version
        if ($inheritedRouting === 'custom') {
            $prevSteps = DB::table('document_route_steps')
                ->where('document_version_id', $latestOfficial->id)
                ->orderBy('phase')
                ->orderBy('step_order')
                ->get(['phase', 'step_order', 'office_id']);

            $now = now();
            foreach ($prevSteps as $s) {
                DB::table('document_route_steps')->insert([
                    'document_version_id' => $revision->id,
                    'phase'               => $s->phase,
                    'step_order'          => $s->step_order,
                    'office_id'           => $s->office_id,
                    'created_at'          => $now,
                    'updated_at'          => $now,
                ]);
            }
        }

        WorkflowTask::create([
            'document_version_id' => $revision->id,
            'phase'               => 'review',
            'step'                => $draftStep,
            'status'              => 'open',
            'opened_at'           => now(),
            'assigned_office_id'  => $assignedOfficeId,
        ]);

        ActivityLog::create([
            'document_id'         => $document->id,
            'document_version_id' => $revision->id,
            'actor_user_id'       => $request->user()?->id,
            'actor_office_id'     => $request->user()?->office_id,
            'target_office_id'    => $assignedOfficeId,
            'event'               => 'version.revision_created',
            'label'               => 'Started a revision draft',
            'meta'                => [
                'version_number'          => $revision->version_number,
                'status'                  => $revision->status,
                'workflow_type'           => $inheritedFlow,
                'routing_mode'            => $inheritedRouting,
                'based_on_version_number' => $latestOfficial->version_number,
                'based_on_status'         => $latestOfficial->status,
            ],
        ]);

        return response()->json($revision, 201);
    }


    // POST /api/document-versions/{version}/replace-file
    public function replaceFile(Request $request, DocumentVersion $version)
    {
        if (!in_array($version->status, ['Draft', 'Office Draft'])) {
            return response()->json(['message' => 'Can only replace file during Draft.'], 422);
        }

        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
        ]);

        $this->versionFiles->saveVersionFile($version, $request->file('file'));

        ActivityLog::create([
            'document_id' => $version->document_id,
            'document_version_id' => $version->id,
            'actor_user_id' => $request->user()?->id,
            'actor_office_id' => $request->user()?->office_id,
            'target_office_id' => null,
            'event' => 'version.file_replaced',
            'label' => 'Replaced the draft file',
            'meta' => [
                'status' => $version->status,
                'version_number' => $version->version_number,
                'filename' => $version->original_filename,
            ],
        ]);

        return response()->json($version->fresh(), 200);
    }

    // HALF

    public function updateVersion(Request $request, DocumentVersion $version)
    {
        if (!in_array($version->status, ['Draft'])) {
            return response()->json(['message' => 'Draft fields can only be updated during Draft.'], 422);
        }

        $data = $request->validate([
            'description' => 'nullable|string',
            'effective_date' => 'nullable|date',
        ]);

        $version->description = array_key_exists('description', $data)
            ? ($data['description'] ?? null)
            : $version->description;

        $version->effective_date = array_key_exists('effective_date', $data)
            ? ($data['effective_date'] ?? null)
            : $version->effective_date;

        $version->save();

        \App\Models\ActivityLog::create([
            'document_id' => $version->document_id,
            'document_version_id' => $version->id,
            'actor_user_id' => $request->user()?->id,
            'actor_office_id' => $request->user()?->office_id,
            'target_office_id' => null,
            'event' => 'version.updated',
            'label' => 'Updated draft version fields',
            'meta' => [
                'version_number' => $version->version_number,
                'status' => $version->status,
                'changed' => [
                    'description' => array_key_exists('description', $data),
                    'effective_date' => array_key_exists('effective_date', $data),
                ],
            ],
        ]);

        return response()->json(['version' => $version->fresh()], 200);
    }


    // GET /api/document-versions/{version}/preview
    public function previewVersion(Request $request, DocumentVersion $version)
    {
        $roleName = $request->user()?->role?->name ? strtolower(trim($request->user()->role->name)) : null;

        if ($roleName === 'auditor' && $version->status !== 'Distributed') {
            return response()->json(['message' => 'Only Distributed versions can be previewed.'], 422);
        }

        if (!$version->preview_path) {
            return response()->json(['message' => 'Preview not available for this version.'], Response::HTTP_NOT_FOUND);
        }

        if (!Storage::disk()->exists($version->preview_path)) {
            return response()->json(['message' => 'Preview file not found on server.'], Response::HTTP_NOT_FOUND);
        }

        $stream = Storage::disk()->readStream($version->preview_path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . ($version->original_filename ?? 'preview.pdf') . '"',
        ]);
    }
    public function downloadVersion(Request $request, DocumentVersion $version)
    {
        if ($version->status !== 'Distributed') {
            return response()->json(['message' => 'Only Distributed versions can be downloaded.'], 422);
        }

        if (!$version->file_path) {
            return response()->json(['message' => 'No file available for this version.'], 404);
        }

        if (!Storage::disk()->exists($version->file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        $downloadName = $version->original_filename ?? 'document';

        \App\Models\ActivityLog::create([
            'document_id' => $version->document_id,
            'document_version_id' => $version->id,
            'actor_user_id' => $request->user()?->id,
            'actor_office_id' => $request->user()?->office_id,
            'target_office_id' => null,
            'event' => 'version.downloaded',
            'label' => 'Downloaded a document file',
            'meta' => [
                'status' => $version->status,
                'version_number' => $version->version_number,
            ],
        ]);

        $stream = Storage::disk()->readStream($version->file_path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
        }, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Disposition' => 'attachment; filename="' . $downloadName . '"',
        ]);
    }

    public function cancelRevision(Request $request, DocumentVersion $version)
    {
        if ($version->status !== 'Draft') {
            return response()->json(['message' => 'Only Draft versions can be cancelled.'], 422);
        }

        if ((int) $version->version_number === 0) {
            return response()->json(['message' => 'Cannot cancel v0 draft using cancel; delete draft instead.'], 422);
        }

        return DB::transaction(function () use ($version, $request) {
            // 1) Cancel this version
            $version->status = 'Cancelled';
            $version->cancelled_at = now();
            $version->save();

            ActivityLog::create([
                'document_id' => $version->document_id,
                'document_version_id' => $version->id,
                'actor_user_id' => $request->user()?->id,
                'actor_office_id' => $request->user()?->office_id,
                'target_office_id' => null,
                'event' => 'version.cancelled',
                'label' => 'Cancelled a draft version',
                'meta' => [
                    'version_number' => $version->version_number, // <-- keep if your column is version_number
                    'previous_status' => 'Draft',
                ],
            ]);

            // 2) Close any open tasks on this cancelled version
            WorkflowTask::query()
                ->where('document_version_id', $version->id)
                ->where('status', 'open')
                ->update([
                    'status' => 'cancelled',
                    'completed_at' => now(),
                ]);

            // 3) Roll back to previous official version (v2 if cancelling v3)
            $prevOfficial = DocumentVersion::query()
                ->where('document_id', $version->document_id)
                ->where('version_number', '<', $version->version_number)
                ->whereIn('status', ['Distributed', 'Superseded'])
                ->orderByDesc('version_number')
                ->first();

            if ($prevOfficial) {
                // Re-open workflow by creating a new QA task (history-safe)
                $qaOfficeId = \App\Models\Office::where('code', 'QA')->value('id');

                WorkflowTask::create([
                    'document_version_id' => $prevOfficial->id,
                    'phase' => 'review',
                    'step' => 'draft',
                    'status' => 'open',
                    'opened_at' => now(),
                    'assigned_office_id' => $qaOfficeId,
                ]);
            }

            return response()->json([
                'message' => 'Version cancelled.',
                'rolled_back_to_version_id' => $prevOfficial?->id,
                'rolled_back_to_version_number' => $prevOfficial?->version_number,
            ], 200);
        });
    }

    public function destroyVersion(Request $request, DocumentVersion $version)
    {
        if ($version->status !== 'Draft') {
            return response()->json(['message' => 'Can only delete during Draft.'], 422);
        }

        $document = $version->document()->first();

        ActivityLog::create([
            'document_id' => $version->document_id,
            'document_version_id' => $version->id,
            'actor_user_id' => $request->user()?->id,
            'actor_office_id' => $request->user()?->office_id,
            'target_office_id' => null,
            'event' => 'version.deleted',
            'label' => 'Deleted a draft version',
            'meta' => [
                'version_number' => $version->version_number,
                'status' => $version->status,
                'deleted_document_family' => ((int) $version->version_number === 0),
            ],
        ]);

        $this->versionFiles->deleteVersionFiles($version);
        $version->delete();

        // If this was v0 draft, delete the whole document family (soft delete)
        if ($document && (int)$version->version_number === 0) {
            $document->delete();
        }

        return response()->json(['message' => 'Draft deleted.'], 200);
    }

    public function showVersion(DocumentVersion $version)
    {
        $version->load('document.ownerOffice');

        return response()->json([
            'version' => $version,
            'document' => new DocumentResource($version->document->load(['ownerOffice', 'latestVersion'])),
        ]);
    }

    public function previewLink(Request $request, DocumentVersion $version)
    {
        $ttlMinutes = 60;

        $userId = (int) ($request->user()?->id ?? 0);
        if ($userId <= 0) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        // IMPORTANT: uid must be part of cache key, otherwise users can receive each other’s cached signed URLs.
        // Enforce access BEFORE issuing a signed URL
        Gate::authorize('preview', $version);

        $cacheKey = "preview_link:v{$version->id}:uid{$userId}:ttl{$ttlMinutes}";

        $payload = Cache::remember($cacheKey, ($ttlMinutes - 5) * 60, function () use ($version, $ttlMinutes, $userId) {
            $signedUrl = URL::temporarySignedRoute(
                'document-versions.preview',
                now()->addMinutes($ttlMinutes),
                ['version' => $version->id, 'uid' => $userId]
            );

            return [
                'url' => $signedUrl,
                'expires_in_minutes' => $ttlMinutes,
            ];
        });

        return response()->json($payload);
    }


    public function previewSigned(Request $request, DocumentVersion $version)
    {
        // Signature already validated by middleware('signed')
        $uid = (int) ($request->query('uid') ?? 0);

        if ($uid <= 0) {
            return response()->json(['message' => 'Missing uid.'], 422);
        }

        $user = User::find($uid);
        if (!$user) {
            return response()->json(['message' => 'User not found.'], 404);
        }

        Gate::forUser($user)->authorize('preview', $version);

        return $this->previewVersion($request, $version);
    }
}
