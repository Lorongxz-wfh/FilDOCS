<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
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
use App\Services\OfficeHierarchyService;


use Symfony\Component\HttpFoundation\Response;
use App\Http\Resources\DocumentResource;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use App\Mail\WorkflowNotificationMail;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use App\Models\ActivityLog;
use App\Models\Tag;
use App\Services\WorkflowSteps;

class DocumentController extends Controller
{
    use RoleNameTrait, LogsActivityTrait;

    public function __construct(
        private DocumentVersionFileService $versionFiles,
        private DocumentShareService $shares,
        private DocumentIndexService $docIndex,
        private OfficeHierarchyService $officeHierarchy,
    ) {}

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

        $data = $request->validate([
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
        ]);

        $qaOfficeId = Cache::remember('office_id:QA', 3600, function () {
            return \App\Models\Office::where('code', 'QA')->value('id');
        });

        $roleName = $this->roleNameOf($user) ?: null;
        $isAdmin  = in_array($roleName, ['admin', 'sysadmin'], true);

        $visibleDocs = Document::query();

        // Admin/sysadmin see ALL documents — skip office-based visibility filter
        if (!$isAdmin) {
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
        }

        // Apply date filters if provided
        if (!empty($data['date_from'])) {
            $visibleDocs->where('created_at', '>=', $data['date_from']);
        }
        if (!empty($data['date_to'])) {
            $visibleDocs->where('created_at', '<=', $data['date_to']);
        }

        $total = (clone $visibleDocs)->count();

        $distributed = (clone $visibleDocs)->whereHas('latestVersion', function ($v) use ($data) {
            $v->where('status', 'Distributed');
            if (!empty($data['date_from'])) {
                $v->where('distributed_at', '>=', $data['date_from']);
            }
            if (!empty($data['date_to'])) {
                $v->where('distributed_at', '<=', $data['date_to']);
            }
        })->count();

        if ($isAdmin) {
            // Pending = total open workflow tasks across all docs
            $pending = (int) WorkflowTask::where('status', 'open')->count();
        } elseif ($roleName === 'auditor') {
            $pending = 0;
        } else {
            $pending = (int) (WorkflowTask::query()
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
                ->selectRaw('COUNT(DISTINCT documents.id) as cnt')
                ->value('cnt') ?? 0);
        }

        $byPhase = [
            'draft'        => (clone $visibleDocs)->whereHas('latestVersion', fn($q) => $q->whereIn('status', ['Draft', 'Office Draft']))->count(),
            'review'       => (clone $visibleDocs)->whereHas('latestVersion', fn($q) => $q->where('status', 'like', '%Review%')->orWhere('status', 'like', '%Check%'))->count(),
            'approval'     => (clone $visibleDocs)->whereHas('latestVersion', fn($q) => $q->where('status', 'like', '%Approval%'))->count(),
            'finalization' => (clone $visibleDocs)->whereHas('latestVersion', fn($q) => $q->where(function ($r) {
                $r->where('status', 'like', '%Registration%')->orWhere('status', 'like', '%Distribution%');
            }))->count(),
            'distributed'  => $distributed,
        ];

        return response()->json([
            'total' => $total,
            'pending' => $pending,
            'distributed' => $distributed,
            'by_phase' => $byPhase,
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
        $roleName = $this->roleNameOf($user) ?: null;

        $canSeeAll = in_array($roleName, ['admin', 'president', 'qa'], true);

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

            // Check if document was ever Distributed (public)
            $isPublicArchive = $document->archived_at && DocumentVersion::where('document_id', $document->id)->where('status', 'Distributed')->exists();

            $vpOfficeCode = $this->officeHierarchy->vpRoleToOfficeCode($roleName);
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

                if (!$inVpScope && !$isSharedToMe && !$hasOpenTaskOnLatest && !$isPublicArchive) {
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
                    && !$isPublicArchive
                ) {
                    return response()->json(['message' => 'Forbidden.'], 403);
                }
            }
        }

        $q = DocumentVersion::query()
            ->where('document_id', $document->id);
        
        // Auditor: only Distributed history
        if ($roleName === 'auditor') {
            $q->where('status', 'Distributed');
        }

        $versions = $q->orderByDesc('version_number')->get();

        return response()->json($versions);
    }

    public function getShares(Request $request, Document $document)
    {
        $user = $request->user();
        $roleName = $this->roleNameOf($user) ?: null;
        $actorOfficeId = (int) ($user?->office_id ?? 0);
        $ownerOfficeId = (int) ($document->owner_office_id ?? 0);
        $isOwner = $ownerOfficeId && $actorOfficeId === $ownerOfficeId;
        $canManage = $isOwner || in_array($roleName, ['admin', 'qa'], true);

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
        $roleName = $this->roleNameOf($user) ?: null;
        $actorOfficeId = (int) ($user?->office_id ?? 0);
        $ownerOfficeId = (int) ($document->owner_office_id ?? 0);
        $isOwner = $ownerOfficeId && $actorOfficeId === $ownerOfficeId;
        $canManage = $isOwner || in_array($roleName, ['admin', 'qa'], true);

        if (!$canManage) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'office_ids' => 'array',
            'office_ids.*' => 'integer|exists:offices,id',
        ]);

        $actorUserId = (int) ($user?->id ?? 0);

        $result = $this->shares->setShares($document, $data['office_ids'] ?? [], $actorUserId, $actorOfficeId);

        // Email newly-added offices that the document was shared with them
        $addedOfficeIds = $result['added_office_ids'] ?? [];
        if (!empty($addedOfficeIds)) {
            $actorName  = trim($user->first_name . ' ' . $user->last_name) ?: 'Someone';
            $docTitle   = $document->title ?? 'A document';
            $appUrl     = rtrim(env('FRONTEND_URL', config('app.url')), '/');
            $appName    = config('app.name', 'FilDAS');

            $shareUsers = User::whereIn('office_id', $addedOfficeIds)
                ->select(['id', 'first_name', 'last_name', 'email', 'email_doc_updates'])
                ->get();

            foreach ($shareUsers as $u) {
                if (!(bool) ($u->email_doc_updates ?? true) || !$u->email) continue;
                try {
                    Mail::to($u->email)->queue(new WorkflowNotificationMail(
                        recipientName: trim($u->first_name . ' ' . $u->last_name) ?: $u->email,
                        notifTitle: 'A document has been shared with you',
                        notifBody: $docTitle . ' has been shared with your office by ' . $actorName . '. You can view it in the Library.',
                        documentTitle: $docTitle,
                        documentStatus: 'Distributed',
                        isReject: false,
                        actorName: $actorName,
                        documentId: $document->id,
                        appUrl: $appUrl,
                        appName: $appName,
                    ));
                } catch (\Throwable) {
                }
            }
        }

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
        $roleName = $this->roleNameOf($user) ?: null;

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

        $this->logActivity('document.tags_updated', 'Updated document tags', $user?->id, $user?->office_id, [
            'tags' => $clean,
        ], $document->id, $document->latestVersion?->id);

        return response()->json([
            'message' => 'Tags updated.',
            'document_id' => $document->id,
            'tags' => $clean,
        ]);
    }

    // POST /api/documents (create family + v0 Draft)
    public function store(DocumentStoreRequest $request)
    {
        $roleName = $this->roleName($request) ?: null;

        $data = $request->validated();

        $isAdmin = in_array(strtolower($roleName ?? ''), ['admin', 'sysadmin'], true);

        if ($isAdmin) {
            $userOfficeId = (int) ($data['acting_as_office_id'] ?? 0) ?: null;
            if (!$userOfficeId) {
                return response()->json(['message' => 'Choose an office to create this document on behalf of.'], 422);
            }
        } else {
            $userOfficeId = $request->user()?->office_id;
            if (!$userOfficeId) {
                return response()->json(['message' => 'Your account has no office assigned.'], 422);
            }
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

            // Custom routing always uses unified draft step/status regardless of flow type
            $initialStep   = WorkflowSteps::STEP_CUSTOM_DRAFT; // 'draft'
            $initialStatus = 'Draft';
            if ($version->status !== 'Draft') {
                $version->status = 'Draft';
                $version->save();
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



        $this->logActivity('document.created', 'Created a document draft', $request->user()?->id, $request->user()?->office_id, [
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

        ], $doc->id, $version->id, $doc->review_office_id);

        // Peek at expected code — does NOT consume the counter or increment seq.
        // The real code is assigned atomically at the registration step.
        $doc->reserved_code = Document::peekNextCode(
            (int) $doc->owner_office_id,
            $doc->doctype,
        );
        $doc->save();

        // File upload
        if ($request->hasFile('file')) {
            $this->versionFiles->saveVersionFile($version, $request->file('file'));
            $this->logActivity('version.file_uploaded', 'Uploaded a draft file', $request->user()?->id, $request->user()?->office_id, [
                'status' => $version->status,
                'version_number' => $version->version_number,
                'filename' => $version->original_filename,
            ], $doc->id, $version->id);
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

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

        // Capture field diffs before saving
        $changes = [];
        foreach ($data as $field => $newVal) {
            $oldVal = $document->{$field};
            if ((string) $oldVal !== (string) ($newVal ?? '')) {
                $changes[] = ['field' => $field, 'old' => $oldVal, 'new' => $newVal];
            }
        }

        $document->fill($data);
        $document->save();

        $user = $request->user();
        if (!empty($changes)) {
            $this->logActivity('document.field_changed', 'Updated document details', $user?->id, $user?->office_id, [
                'changes' => $changes,
            ], $document->id, $document->latestVersion?->id);
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

        return new DocumentResource($document->load(['ownerOffice', 'latestVersion']));
    }

    public function createRevision(Request $request, Document $document)
    {
        // Only the owner office (creator) may start a revision
        $user = $request->user();
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $ownerOfficeId = (int) ($document->owner_office_id ?? 0);
        if (!$ownerOfficeId || $userOfficeId !== $ownerOfficeId) {
            return response()->json(['message' => 'Only the document owner office may create a revision.'], 403);
        }

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

        $this->logActivity('version.revision_created', 'Started a revision draft', $request->user()?->id, $request->user()?->office_id, [
            'version_number'          => $revision->version_number,
            'status'                  => $revision->status,
            'workflow_type'           => $inheritedFlow,
            'routing_mode'            => $inheritedRouting,
            'based_on_version_number' => $latestOfficial->version_number,
            'based_on_status'         => $latestOfficial->status,
        ], $document->id, $revision->id, $assignedOfficeId);

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

        return response()->json($revision, 201);
    }


    // POST /api/document-versions/{version}/replace-file
    public function replaceFile(Request $request, DocumentVersion $version)
    {
        Gate::authorize('replaceFile', $version);

        $request->validate([
            'file' => 'required|file|mimes:pdf,doc,docx,xls,xlsx,ppt,pptx|max:10240',
        ]);

        $approvalStatuses = [
            'For Office Approval',
            'For VP Approval',
            "For President's Approval",
            'For QA Approval Check',
            'For Office Head Approval',
            'For Staff Approval Check',
            'For Owner Approval Check',
            // Pre-approval creator double-check steps
            'For QA Final Check',
            'For Office Final Check',
            'For Owner Review Check',
        ];
        $isDuringApproval = in_array($version->status, $approvalStatuses, true)
            || (bool) preg_match('/^For .+ Approval$/', $version->status);

        $isFirstUpload = empty($version->file_path);

        $this->versionFiles->saveVersionFile($version, $request->file('file'));

        $freshVersion = $version->fresh();

        // Flag as signed file when replaced during approval phase
        if ($isDuringApproval && $freshVersion->file_path) {
            $freshVersion->signed_file_path = $freshVersion->file_path;
            $freshVersion->save();
        } else {
            // Uploaded during draft/review — explicitly clear old in-app signature data
            $freshVersion->signed_file_path = null;
            $freshVersion->pre_sign_file_path = null;
            $freshVersion->save();
        }

        $label = $isDuringApproval
            ? 'Uploaded signed document for approval'
            : ($isFirstUpload ? 'Uploaded a draft file' : 'Replaced the draft file');

        $event = $isDuringApproval
            ? 'version.signed_file_uploaded'
            : ($isFirstUpload ? 'version.file_uploaded' : 'version.file_replaced');

        $this->logActivity($event, $label, $request->user()?->id, $request->user()?->office_id, [
            'status'         => $version->status,
            'version_number' => $version->version_number,
            'filename'       => $freshVersion->original_filename,
            'is_signed'      => $isDuringApproval,
        ], $version->document_id, $version->id);

        return response()->json($freshVersion->fresh(), 200);
    }

    // POST /api/document-versions/{version}/apply-signature
    public function applyInAppSignature(Request $request, DocumentVersion $version)
    {
        Gate::authorize('replaceFile', $version);

        $request->validate([
            'file' => 'required|file|mimes:pdf|max:10240',
        ]);

        // Always back up the current file before overwriting with the new signature.
        // This ensures "remove signature" always restores to whoever signed just before,
        // not all the way back to the original (important for multi-signer scenarios).
        if ($version->file_path) {
            $disk = Storage::disk();
            if ($disk->exists($version->file_path)) {
                // Delete old backup first to avoid orphaned files
                if ($version->pre_sign_file_path && $version->pre_sign_file_path !== $version->file_path) {
                    $disk->delete($version->pre_sign_file_path);
                }
                $ext        = pathinfo($version->file_path, PATHINFO_EXTENSION) ?: 'pdf';
                $backupPath = 'pre-sign-backups/' . $version->id . '_' . time() . '.' . $ext;
                $disk->copy($version->file_path, $backupPath);
                $version->pre_sign_file_path = $backupPath;
                $version->save();
            }
        }

        $this->versionFiles->saveVersionFile($version, $request->file('file'));
        $freshVersion = $version->fresh();

        // Mark as signed
        $freshVersion->signed_file_path = $freshVersion->file_path;
        $freshVersion->save();

        $this->logActivity(
            'version.in_app_signature_applied',
            'Applied in-app e-signature',
            $request->user()?->id,
            $request->user()?->office_id,
            [
                'version_number' => $version->version_number,
            ],
            $version->document_id,
            $version->id
        );

        return response()->json($freshVersion->fresh(), 200);
    }

    // DELETE /api/document-versions/{version}/apply-signature
    public function removeInAppSignature(Request $request, DocumentVersion $version)
    {
        Gate::authorize('replaceFile', $version);

        if (!$version->pre_sign_file_path) {
            return response()->json(['message' => 'No original backup available.'], 422);
        }

        $version->file_path        = $version->pre_sign_file_path;
        $version->signed_file_path = null;
        $version->pre_sign_file_path = null;
        $version->preview_path     = null;
        $version->save();

        // Regenerate preview from the restored file
        $version->preview_path = $this->tryRegeneratePreview($version);
        $version->save();

        $this->logActivity(
            'version.in_app_signature_removed',
            'Removed in-app e-signature',
            $request->user()?->id,
            $request->user()?->office_id,
            [
                'version_number' => $version->version_number,
            ],
            $version->document_id,
            $version->id
        );

        return response()->json($version->fresh(), 200);
    }

    // POST /api/document-versions/{version}/regenerate-preview
    public function regeneratePreview(Request $request, DocumentVersion $version)
    {
        Gate::authorize('replaceFile', $version);

        if (!$version->file_path) {
            return response()->json(['message' => 'No file uploaded for this version.'], 422);
        }

        if (!Storage::disk()->exists($version->file_path)) {
            return response()->json(['message' => 'The document file could not be found in storage. It may have been uploaded to a different server environment.'], 422);
        }

        $libreOffice = env('LIBREOFFICE_PATH');
        if (!$libreOffice || !file_exists($libreOffice)) {
            return response()->json(['message' => 'LibreOffice is not configured on this server. Set LIBREOFFICE_PATH in your .env file.'], 422);
        }

        $newPreviewPath = $this->tryRegeneratePreview($version);

        if (!$newPreviewPath) {
            return response()->json(['message' => 'LibreOffice failed to convert the file. Check the server logs for details.'], 422);
        }

        $version->preview_path = $newPreviewPath;
        $version->save();

        // Bust the cached signed preview URL so the next request fetches a fresh one
        Cache::forget("preview_link:v{$version->id}:uid{$request->user()?->id}:ttl60");

        return response()->json($version->fresh(), 200);
    }

    /**
     * Download the current file for a version to a temp location, run LibreOffice
     * preview generation, upload the result back to storage, and return the
     * new preview path (or null if generation failed).
     */
    private function tryRegeneratePreview(DocumentVersion $version): ?string
    {
        $filePath = $version->file_path;

        if (!$filePath || !Storage::disk()->exists($filePath)) {
            return null;
        }

        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION)) ?: 'pdf';

        // Skip conversion if already a PDF
        if ($ext === 'pdf') {
            return $filePath;
        }

        $tmpDir  = sys_get_temp_dir() . '/fildas/' . $version->id;
        $tmpFile = $tmpDir . '/original.' . $ext;

        if (!is_dir($tmpDir)) {
            mkdir($tmpDir, 0775, true);
        }

        // Download file from storage to temp
        $stream = Storage::disk()->readStream($filePath);
        file_put_contents($tmpFile, $stream);
        if (is_resource($stream)) {
            fclose($stream);
        }

        $previewFileName = DocumentPreviewService::generatePreview($tmpDir, $tmpFile);

        $newPreviewPath = null;

        if ($previewFileName) {
            $previewTmpPath = $tmpDir . '/' . $previewFileName;
            $year           = now()->year;
            $r2PreviewPath  = $year . '/' . $version->id . '/' . $previewFileName;

            // Delete old preview if it exists AND it's not the same as the current file
            if ($version->preview_path && $version->preview_path !== $version->file_path && Storage::disk()->exists($version->preview_path)) {
                Storage::disk()->delete($version->preview_path);
            }

            Storage::disk()->putFileAs(
                $year . '/' . $version->id,
                new \Illuminate\Http\File($previewTmpPath),
                $previewFileName
            );

            $newPreviewPath = $r2PreviewPath;
            @unlink($previewTmpPath);
        }

        @unlink($tmpFile);
        @rmdir($tmpDir);

        return $newPreviewPath;
    }

    // GET /api/document-versions/{version}/original-file
    public function getOriginalFile(Request $request, DocumentVersion $version)
    {
        Gate::authorize('preview', $version);

        $path = $version->pre_sign_file_path ?? $version->file_path;

        if (!$path || !Storage::disk()->exists($path)) {
            return response()->json(['message' => 'File not found.'], 404);
        }

        $stream = Storage::disk()->readStream($path);

        return response()->stream(function () use ($stream) {
            fpassthru($stream);
            if (is_resource($stream)) fclose($stream);
        }, 200, [
            'Content-Type'        => 'application/pdf',
            'Content-Disposition' => 'inline',
        ]);
    }

    // HALF

    public function updateVersion(Request $request, DocumentVersion $version)
    {
        $isDraft = in_array($version->status, ['Draft', 'Office Draft'], true);
        $isRegistration = str_contains($version->status, 'Registration');

        if (!$isDraft && !$isRegistration) {
            return response()->json(['message' => 'Draft fields can only be updated during Draft or Registration phase.'], 422);
        }

        $data = $request->validate([
            'description' => 'nullable|string',
            'effective_date' => 'nullable|date',
        ]);

        // Capture field diffs before saving
        $changes = [];
        if (array_key_exists('description', $data) && (string)($version->description ?? '') !== (string)($data['description'] ?? '')) {
            $changes[] = ['field' => 'description', 'old' => $version->description, 'new' => $data['description'] ?? null];
        }
        if (array_key_exists('effective_date', $data)) {
            $oldDate = $version->effective_date ? \Carbon\Carbon::parse($version->effective_date)->format('Y-m-d') : null;
            $newDate = $data['effective_date'] ? \Carbon\Carbon::parse($data['effective_date'])->format('Y-m-d') : null;
            if ($oldDate !== $newDate) {
                $changes[] = ['field' => 'effective_date', 'old' => $oldDate, 'new' => $newDate];
            }
        }

        $version->description = array_key_exists('description', $data)
            ? ($data['description'] ?? null)
            : $version->description;

        $version->effective_date = array_key_exists('effective_date', $data)
            ? ($data['effective_date'] ?? null)
            : $version->effective_date;

        $version->save();

        $user = $request->user();
        if (!empty($changes)) {
            $this->logActivity('document.field_changed', 'Updated draft version fields', $user?->id, $user?->office_id, [
                'changes' => $changes,
            ], $version->document_id, $version->id);
        }

        return response()->json(['version' => $version->fresh()], 200);
    }


    // GET /api/document-versions/{version}/preview
    public function previewVersion(Request $request, DocumentVersion $version)
    {
        $roleName = $this->roleName($request) ?: null;

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
            'Cache-Control' => 'private, max-age=3600, must-revalidate',
        ]);
    }
    public function downloadVersion(Request $request, DocumentVersion $version)
    {
        if (!$version->file_path) {
            return response()->json(['message' => 'No file available for this version.'], 404);
        }

        if (!Storage::disk()->exists($version->file_path)) {
            return response()->json(['message' => 'File not found on server.'], 404);
        }

        $downloadName = $version->original_filename ?? 'document';

        $this->logActivity('version.downloaded', 'Downloaded a document file', $request->user()?->id, $request->user()?->office_id, [
            'status' => $version->status,
            'version_number' => $version->version_number,
        ], $version->document_id, $version->id);

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

            $this->logActivity('version.cancelled', 'Cancelled a draft version', $request->user()?->id, $request->user()?->office_id, [
                'version_number' => $version->version_number, // <-- keep if your column is version_number
                'previous_status' => 'Draft',
            ], $version->document_id, $version->id);

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

            try {
                broadcast(new \App\Events\WorkspaceChanged('document'));
            } catch (\Throwable) {}

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

        $this->logActivity('version.deleted', 'Deleted a draft version', $request->user()?->id, $request->user()?->office_id, [
            'version_number' => $version->version_number,
            'status' => $version->status,
            'deleted_document_family' => ((int) $version->version_number === 0),
        ], $version->document_id, $version->id);

        $this->versionFiles->deleteVersionFiles($version);
        $version->delete();

        // If this was v0 draft, delete the whole document family (soft delete)
        if ($document && (int)$version->version_number === 0) {
            $document->delete();
        }

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Draft deleted.'], 200);
    }

    public function showVersion(DocumentVersion $version)
    {
        $version->load('document.ownerOffice');

        // Check if file replacement is required (after rejection OR revision without new file)
        $needsFileReplacement = false;
        $draftStatuses = ['Draft', 'Office Draft'];
        if (in_array($version->status, $draftStatuses, true)) {
            // Case 1: After rejection — must upload new file before re-forwarding
            $lastRejected = ActivityLog::where('document_version_id', $version->id)
                ->where('event', 'workflow.rejected')
                ->orderByDesc('created_at')
                ->value('created_at');

            if ($lastRejected) {
                $lastFileEvent = ActivityLog::where('document_version_id', $version->id)
                    ->whereIn('event', ['version.file_replaced', 'version.file_uploaded', 'version.signed_file_uploaded'])
                    ->orderByDesc('created_at')
                    ->value('created_at');

                // Needs replacement if rejected AFTER last file upload (or never uploaded)
                $needsFileReplacement = !$lastFileEvent || $lastRejected > $lastFileEvent;
            }

            // Case 2: Revision draft (version_number > 0) — must upload a new file before first forward
            if (!$needsFileReplacement && (int) $version->version_number > 0) {
                $hasNewFile = ActivityLog::where('document_version_id', $version->id)
                    ->whereIn('event', ['version.file_replaced', 'version.file_uploaded'])
                    ->exists();
                $needsFileReplacement = !$hasNewFile;
            }
        }

        $versionData = $version->toArray();
        $versionData['needs_file_replacement'] = $needsFileReplacement;

        return response()->json([
            'version' => $versionData,
            'document' => new DocumentResource(
                $version->document->load(['ownerOffice', 'latestVersion', 'tags'])
            ),
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

        // Include updated_at so any file change (signing, upload) auto-invalidates
        // the cached URL for all users without needing an explicit Cache::forget.
        $updatedAt = $version->updated_at?->timestamp ?? 0;
        $cacheKey = "preview_link:v{$version->id}:uid{$userId}:updated{$updatedAt}";

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

    // GET /api/documents/finished
    // Documents where the current user's office had a workflow task, now Distributed
    public function finished(Request $request)
    {
        $user     = $request->user();
        $officeId = (int) ($user?->office_id ?? 0);
        $role = $this->roleNameOf($user);
        $isQa = in_array($role, ['qa', 'sysadmin', 'admin'], true);
        $perPage  = min((int) ($request->query('per_page', 15)), 50);
        $page     = max((int) ($request->query('page', 1)), 1);
        $q        = trim((string) ($request->query('q', '')));

        // Build base query — distributed versions only
        $query = DB::table('document_versions as dv')
            ->join('documents as d', 'd.id', '=', 'dv.document_id')
            ->leftJoin('offices as oo', 'oo.id', '=', 'd.owner_office_id')
            ->where('dv.status', 'Distributed')
            ->whereNull('dv.superseded_at')
            ->whereNull('dv.cancelled_at');

        if ($isQa) {
            // QA sees all distributed documents they were involved in
            // (they touch everything, so just show all distributed)
            // Still scope to docs they created or had tasks on
            $query->where(function ($q2) use ($user, $officeId) {
                $q2->where('d.created_by', $user->id)
                    ->orWhereExists(function ($sub) use ($officeId) {
                        $sub->select(DB::raw(1))
                            ->from('workflow_tasks as wt')
                            ->whereColumn('wt.document_version_id', 'dv.id')
                            ->where('wt.assigned_office_id', $officeId);
                    });
            });
        } else {
            // Office users: only docs where their office had a task
            $query->whereExists(function ($sub) use ($officeId) {
                $sub->select(DB::raw(1))
                    ->from('workflow_tasks as wt')
                    ->whereColumn('wt.document_version_id', 'dv.id')
                    ->where('wt.assigned_office_id', $officeId)
                    ->where('wt.status', 'completed');
            });
        }

        if ($q) {
            $query->where(function ($q2) use ($q) {
                $q2->where('d.title', 'like', "%{$q}%")
                    ->orWhere('d.code', 'like', "%{$q}%");
            });
        }

        $total = (clone $query)->count();

        $rows = $query
            ->select([
                'd.id',
                'd.title',
                'd.code',
                'd.doctype',
                'd.owner_office_id',
                'd.created_by',
                'd.created_at',
                'dv.id as version_id',
                'dv.version_number',
                'dv.status',
                'dv.distributed_at',
                'dv.effective_date',
                'dv.original_filename',
                'dv.file_path',
                'dv.preview_path',
                'oo.name as owner_office_name',
                'oo.code as owner_office_code',
            ])
            ->orderByDesc('dv.distributed_at')
            ->offset(($page - 1) * $perPage)
            ->limit($perPage)
            ->get();

        $lastPage = max(1, (int) ceil($total / $perPage));

        return response()->json([
            'data' => $rows,
            'meta' => [
                'current_page' => $page,
                'last_page'    => $lastPage,
                'per_page'     => $perPage,
                'total'        => $total,
            ],
        ]);
    }

    public function archive(Request $request, Document $document)
    {
        $user = $request->user();
        
        // Only Distributed documents can be manually archived
        $latest = $document->latestVersion;
        if (!$latest || $latest->status !== 'Distributed') {
            return response()->json(['message' => 'Only distributed documents can be manually archived.'], 422);
        }

        $document->archived_at = now();
        $document->save();

        $this->logActivity('document.archived', 'Archived document manually', $user->id, $user->office_id, [], $document->id, $latest->id);

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Document archived.']);
    }

    public function restore(Request $request, Document $document)
    {
        $user = $request->user();

        if (!$document->archived_at) {
            return response()->json(['message' => 'Document is not archived.'], 422);
        }

        // Restore is only for manually archived documents. 
        // Cancelled and Superseded versions cannot be restored via this method.
        $latest = $document->latestVersion;
        if ($latest && in_array($latest->status, ['Cancelled', 'Superseded'])) {
            return response()->json(['message' => 'Cancelled or Superseded documents cannot be restored.'], 422);
        }

        $document->archived_at = null;
        $document->save();

        $this->logActivity('document.restored', 'Restored document manually', $user->id, $user->office_id, [], $document->id, $latest?->id);

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Document restored.']);
    }

    public function destroy(Request $request, Document $document)
    {
        $user = $request->user();
        $roleName = $this->roleNameOf($user) ?: null;

        if (!in_array($roleName, ['admin', 'sysadmin'], true)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $latestVersionId = $document->latestVersion?->id;
        $title = $document->title;
        $id = $document->id;

        $document->delete();

        $this->logActivity('document.deleted', 'Deleted document', $user->id, $user->office_id, [
            'document_id' => $id,
            'title' => $title,
        ], $id, $latestVersionId);

        try {
            broadcast(new \App\Events\WorkspaceChanged('document'));
        } catch (\Throwable) {}

        return response()->json(['message' => 'Document record deleted.']);
    }
}

