<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\DocumentVersion;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class ActivityLogController extends Controller
{
    use RoleNameTrait;

    // POST /api/activity/opened-version
    public function openedVersion(Request $request)
    {
        $data = $request->validate([
            'document_version_id' => 'required|integer|exists:document_versions,id',
            'source' => 'nullable|string|max:50', // e.g. "versions_panel", "work_queue"
        ]);

        $user = $request->user();
        $version = DocumentVersion::findOrFail($data['document_version_id']);

        // Dedupe: same user + version within 60 seconds
        $key = 'opened_version:' . $user->id . ':' . $version->id;
        if (Cache::has($key)) {
            return response()->json(['ok' => true, 'deduped' => true]);
        }
        Cache::put($key, 1, now()->addSeconds(60));

        // Opened version events intentionally not logged — too noisy

        return response()->json(['ok' => true]);
    }

    // GET /api/activity?scope=office|mine|document|all&document_id=&document_version_id=&per_page=&page=&q=&event=&office_id=&date_from=&date_to=
    public function index(Request $request)
    {
        $data = $this->validateQueryParams($request);
        $perPage = (int) ($data['per_page'] ?? 25);
        $result = $this->buildQuery($request, $data);

        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        $paginated = $result->with([
            'actorUser' => function ($query) {
                $query->withTrashed()->with('role');
            },
            'actorOffice:id,name,code',
            'targetOffice:id,name,code',
            'document:id,title,code',
            'documentRequest:id,title',
        ])->paginate($perPage);

        // Inject durations for document/version scoped views
        if ($request->query('scope') === 'document' || $request->query('document_version_id') || $request->query('document_id')) {
            $this->injectDurations($paginated->getCollection());
        }

        return response()->json($paginated);
    }

    // GET /api/activity/export
    public function export(Request $request)
    {
        $data = $this->validateQueryParams($request);
        $result = $this->buildQuery($request, $data);

        if ($result instanceof \Illuminate\Http\JsonResponse) {
            return $result;
        }

        // Limit to 5000 max to prevent memory exhaustion
        $logs = $result->with([
            'actorUser' => function ($query) {
                $query->withTrashed()->with('role');
            },
            'actorOffice:id,name,code',
            'targetOffice:id,name,code',
            'document:id,title,code',
            'documentRequest:id,title',
        ])->limit(5000)->get();

        if ($request->query('scope') === 'document' || $request->query('document_version_id') || $request->query('document_id')) {
            $this->injectDurations($logs);
        }

        return response()->json($logs);
    }

    /**
     * Calculate time difference between sequential events for the same version.
     * Assumes items are ordered by created_at DESC.
     */
    private function injectDurations($collection)
    {
        if ($collection->isEmpty()) return;

        // Group by version to ensure we only calculate durations within the same workflow context
        $grouped = $collection->groupBy('document_version_id');

        foreach ($grouped as $versionId => $items) {
            if (!$versionId) continue;

            // Items are DESC. i=0 is newest, i=1 is older.
            // Duration for $items[1] is ($items[0]->created_at - $items[1]->created_at)
            for ($i = 0; $i < count($items) - 1; $i++) {
                $newest = $items[$i];
                $older  = $items[$i + 1];

                $diffSeconds = $newest->created_at->diffInSeconds($older->created_at);
                $actionLower = strtolower($older->event ?? "");
                $older->is_loop = str_contains($actionLower, 'return') || str_contains($actionLower, 'back');

                $older->duration_seconds = $diffSeconds;
                // Human readable string
                $older->duration_human = $older->created_at->diffForHumans($newest->created_at, true);
            }
        }
    }

    private function validateQueryParams(Request $request)
    {
        return $request->validate([
            'scope' => 'nullable|in:office,mine,document,request,connected,all',
            'document_id' => 'nullable|integer|exists:documents,id',
            'request_id' => 'nullable|integer|exists:document_requests,id',
            'document_version_id' => 'nullable|integer|exists:document_versions,id',
            'per_page' => 'nullable|integer|min:1|max:50',
            'page' => 'nullable|integer|min:1',
            'q' => 'nullable|string|max:100',
            'event' => 'nullable|string|max:100',
            'office_id' => 'nullable|integer|exists:offices,id',
            'date_from' => 'nullable|date',
            'date_to'  => 'nullable|date',
            'category' => 'nullable|in:workflow,request,document,user,template,profile,actions,security',
        ]);
    }

    private function buildQuery(Request $request, array $data)
    {
        $user = $request->user();
        $roleName = $this->roleNameOf($user);
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $canSeeAll = in_array($roleName, ['qa', 'admin', 'sysadmin', 'office_head', 'auditor'], true);

        $scope = $data['scope'] ?? 'office';

        $allowedSorts = ['created_at', 'event', 'label'];
        $sortBy  = in_array($request->query('sort_by'), $allowedSorts, true)
            ? $request->query('sort_by') : 'created_at';
        $sortDir = $request->query('sort_dir') === 'asc' ? 'asc' : 'desc';

        $q = ActivityLog::query()->orderBy($sortBy, $sortDir);

        // Filters (apply before scope narrowing)
        if (!empty($data['event'])) {
            $q->where('event', $data['event']);
        }

        if (!empty($data['office_id'])) {
            $oid = (int) $data['office_id'];
            $q->where(function ($qq) use ($oid) {
                $qq->where('actor_office_id', $oid)
                    ->orWhere('target_office_id', $oid);
            });
        }

        if (!empty($data['date_from'])) {
            $q->whereDate('created_at', '>=', $data['date_from']);
        }
        if (!empty($data['date_to'])) {
            $q->whereDate('created_at', '<=', $data['date_to']);
        }

        if (!empty($data['q'])) {
            $term = trim($data['q']);
            $q->where(function ($qq) use ($term) {
                $qq->where('event', 'like', "%{$term}%")
                    ->orWhere('label', 'like', "%{$term}%");
            });
        }

        // Category filter
        $category = trim((string) ($request->query('category', '')));
        $categoryPrefixes = [
            'workflow' => ['workflow.', 'document.', 'version.'],
            'request'  => ['document_request.'],
            'document' => ['document.', 'version.', 'message.'],
            'user'     => ['user.', 'office.'],
            'template' => ['template.'],
            'profile'       => ['profile.', 'auth.'],
            'announcement'  => ['announcement.'],
            'security'      => ['auth.', 'security.', '2fa.'],
            // All document/workflow/request actions — excludes auth, profile, user-mgmt, template noise
            'actions'  => ['workflow.', 'document.', 'version.', 'message.', 'document_request.'],
        ];
        if ($category !== '' && isset($categoryPrefixes[$category])) {
            $prefixes = $categoryPrefixes[$category];
            $q->where(function ($qq) use ($prefixes) {
                foreach ($prefixes as $prefix) {
                    $qq->orWhere('event', 'like', $prefix . '%');
                }
            });
        }

        // Scope
        if ($scope === 'mine') {
            $q->where('actor_user_id', $user->id);
        } elseif ($scope === 'document') {
            if (!empty($data['document_version_id'])) {
                $q->where('document_version_id', $data['document_version_id']);
            } elseif (!empty($data['document_id'])) {
                $q->where('document_id', $data['document_id']);
            } else {
                return response()->json(['message' => 'document_id or document_version_id is required for scope=document'], 422);
            }
        } elseif ($scope === 'request') {
            $reqId = (int) ($data['request_id'] ?? 0);
            if ($reqId <= 0) {
                return response()->json(['message' => 'request_id is required for scope=request'], 422);
            }

            // Access check: QA/admin sees all, office user must be a recipient
            $roleName = $this->roleNameOf($user);
            $isQa = $this->isQaOrAdmin($roleName);

            if (!$isQa) {
                $isRecipient = \Illuminate\Support\Facades\DB::table('document_request_recipients')
                    ->where('request_id', $reqId)
                    ->where('office_id', $userOfficeId)
                    ->exists();

                $isCreator = \Illuminate\Support\Facades\DB::table('document_requests')
                    ->where('id', $reqId)
                    ->where('created_by_user_id', $user->id)
                    ->exists();

                if (!$isRecipient && !$isCreator) {
                    return response()->json(['message' => 'Forbidden.'], 403);
                }
            }

            // Fetch activity logs where meta->document_request_id matches (database agnostic)
            $q->where('meta->document_request_id', (string) $reqId);
        } elseif ($scope === 'connected') {
            if (!$userOfficeId) {
                return response()->json(['message' => 'Your account has no office assigned.'], 422);
            }

            // "Connected" means: Owner, Participant, or Share Recipient
            $q->where(function ($qq) use ($user, $userOfficeId) {
                // 1. Direct Ownership
                $qq->whereIn('document_id', function ($sub) use ($user, $userOfficeId) {
                    $sub->select('id')->from('documents')
                        ->where('created_by', $user->id)
                        ->orWhere('owner_office_id', $userOfficeId);
                })
                // 2. Workflow Participation (current or past)
                ->orWhereIn('document_id', function ($sub) use ($userOfficeId) {
                    $sub->select('dv.document_id')
                        ->from('workflow_tasks as wt')
                        ->join('document_versions as dv', 'wt.document_version_id', '=', 'dv.id')
                        ->where('wt.assigned_office_id', $userOfficeId);
                })
                // 3. Shared access
                ->orWhereIn('document_id', function ($sub) use ($userOfficeId) {
                    $sub->select('document_id')->from('document_shares')
                        ->where('office_id', $userOfficeId);
                });
            });
        } elseif ($scope === 'office') {
            if (!$userOfficeId) {
                return response()->json(['message' => 'Your account has no office assigned. Use scope=all or scope=mine.'], 422);
            }

            $q->where(function ($qq) use ($userOfficeId) {
                $qq->where('actor_office_id', $userOfficeId)
                    ->orWhere('target_office_id', $userOfficeId);
            });
        } else {
            // scope=all: QA/admin see everything; office_head scoped to their office; others see their office too
            if (!$canSeeAll || ($roleName === 'office_head' && $userOfficeId)) {
                $q->where(function ($qq) use ($user, $userOfficeId) {
                    // Fallback to "connected" for non-admins if scope is all
                    $qq->whereIn('document_id', function ($sub) use ($user, $userOfficeId) {
                        $sub->select('id')->from('documents')
                            ->where('created_by', $user->id)
                            ->orWhere('owner_office_id', $userOfficeId);
                    })
                    ->orWhereIn('document_id', function ($sub) use ($userOfficeId) {
                        $sub->select('dv.document_id')
                            ->from('workflow_tasks as wt')
                            ->join('document_versions as dv', 'wt.document_version_id', '=', 'dv.id')
                            ->where('wt.assigned_office_id', $userOfficeId);
                    })
                    ->orWhereIn('document_id', function ($sub) use ($userOfficeId) {
                        $sub->select('document_id')->from('document_shares')
                            ->where('office_id', $userOfficeId);
                    })
                    // Also include generic user/office actions not tied to a document
                    ->orWhereNull('document_id')
                    ->where(function ($sub) use ($userOfficeId) {
                        $sub->where('actor_office_id', $userOfficeId)
                            ->orWhere('target_office_id', $userOfficeId);
                    });
                });
            }
        }

        return $q;
    }
}
