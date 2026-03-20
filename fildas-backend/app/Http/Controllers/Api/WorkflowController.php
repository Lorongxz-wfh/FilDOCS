<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DocumentVersion;
use App\Models\WorkflowTask;
use App\Services\WorkflowService;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkflowController extends Controller
{
    use RoleNameTrait;

    public function __construct(
        private WorkflowService $workflow,
    ) {}

    // GET /api/document-versions/{version}/tasks
    public function tasks(DocumentVersion $version)
    {
        $user         = request()->user();
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $roleName     = $this->roleNameOf($user);
        $isAdmin      = in_array($roleName, ['admin', 'sysadmin'], true);

        if (!$userOfficeId && !$isAdmin) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $tasks = WorkflowTask::where('document_version_id', $version->id)
            ->orderByDesc('id')
            ->get();

        $qaOfficeId   = (int) (\App\Models\Office::where('code', 'QA')->value('id') ?? 0);
        $presOfficeId = (int) (\App\Models\Office::where('code', 'PO')->value('id') ?? 0);
        $roleName     = $this->roleNameOf($user);
        $canSeeAll    = $userOfficeId === $qaOfficeId
            || $userOfficeId === $presOfficeId
            || in_array($roleName, ['admin', 'sysadmin'], true);

        if (!$canSeeAll) {
            $hasTask = $tasks->contains(fn($t) => (int) $t->assigned_office_id === $userOfficeId);
            if (!$hasTask) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        }

        return response()->json($tasks);
    }

    // GET /api/document-versions/{version}/available-actions
    public function availableActions(DocumentVersion $version)
    {
        $user = request()->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $actions = $this->workflow->getAvailableActions($version, $user);

        return response()->json([
            'document_version_id' => $version->id,
            'actions'             => $actions,
        ]);
    }

    // GET /api/document-versions/{version}/route-steps
    public function routeSteps(DocumentVersion $version)
    {
        $user         = request()->user();
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $roleName     = $this->roleNameOf($user);
        $isAdmin      = in_array($roleName, ['admin', 'sysadmin'], true);

        if (!$userOfficeId && !$isAdmin) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        $qaOfficeId   = (int) (\App\Models\Office::where('code', 'QA')->value('id') ?? 0);
        $presOfficeId = (int) (\App\Models\Office::where('code', 'PO')->value('id') ?? 0);
        $roleName     = $this->roleNameOf($user);
        $canSeeAll    = $userOfficeId === $qaOfficeId
            || $userOfficeId === $presOfficeId
            || in_array($roleName, ['admin', 'sysadmin'], true);

        if (!$canSeeAll) {
            $hasTask = WorkflowTask::where('document_version_id', $version->id)
                ->where('assigned_office_id', $userOfficeId)
                ->exists();

            if (!$hasTask) {
                return response()->json(['message' => 'Forbidden.'], 403);
            }
        }

        $steps = DB::table('document_route_steps')
            ->where('document_version_id', $version->id)
            ->orderBy('phase')
            ->orderBy('step_order')
            ->get(['phase', 'step_order', 'office_id']);

        return response()->json([
            'document_version_id' => $version->id,
            'steps'               => $steps,
        ]);
    }

    // POST /api/document-versions/{version}/actions
    public function action(Request $request, DocumentVersion $version)
    {
        $data = $request->validate([
            'action'         => 'required|string',
            'note'           => 'nullable|string',
            'effective_date' => 'nullable|date',
            'debug'          => 'nullable|boolean',
        ]);

        $user     = $request->user();
        $roleName = strtolower($this->roleNameOf($user));
        $isAdmin  = in_array($roleName, ['admin', 'sysadmin'], true);
        $debug    = (bool) ($data['debug'] ?? false);

        if (!$user?->office_id) {
            if (!($isAdmin && $debug)) {
                $msg = $isAdmin
                    ? 'Enable developer mode in Settings to perform workflow actions.'
                    : 'Your account has no office assigned.';
                return response()->json(['message' => $msg], 422);
            }
        }

        try {
            $newTask = $this->workflow->applyAction(
                $version,
                $user,
                strtoupper(trim($data['action'])),
                $data['note'] ?? null,
                $data['effective_date'] ?? null,
            );

            return response()->json([
                'message' => 'Workflow updated.',
                'version' => $version->fresh(),
                'task'    => $newTask,
            ]);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        } catch (\RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }
    }

    // GET /api/work-queue
    public function workQueue(Request $request)
    {
        $user         = $request->user();
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $roleName     = $this->roleNameOf($user);
        $isAdmin      = in_array($roleName, ['admin', 'sysadmin'], true);

        // Admin/Sysadmin: return ALL documents as monitoring (read-only observer)
        if ($isAdmin) {
            $documents = \App\Models\Document::query()
                ->with([
                    'ownerOffice',
                    'latestVersion',
                    'latestVersion.tasks' => fn($q) => $q->where('status', 'open')->orderByDesc('id'),
                ])
                ->orderByDesc('updated_at')
                ->limit(100)
                ->get();

            $monitoring = $documents->map(function ($doc) {
                $version = $doc->latestVersion;
                if (!$version) return null;
                $openTask = $version->relationLoaded('tasks') ? $version->tasks->first() : null;
                return [
                    'task'     => $openTask,
                    'version'  => $version,
                    'document' => $doc,
                    'can_act'  => false,
                ];
            })->filter()->values();

            return response()->json([
                'assigned'   => [],
                'monitoring' => $monitoring,
            ]);
        }

        if (!$userOfficeId) {
            return response()->json(['message' => 'Your account has no office assigned.'], 422);
        }

        // Tasks assigned to my office
        $assignedTasks = WorkflowTask::where('status', 'open')
            ->where('assigned_office_id', $userOfficeId)
            ->with(['version.document.ownerOffice'])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $assigned = $assignedTasks->map(fn($t) => [
            'task'    => $t,
            'version' => $t->version,
            'document' => $t->version?->document,
            'can_act' => true,
        ])->values();

        // Monitoring: docs created by this user, not currently assigned to this office
        $monitorVersions = \App\Models\DocumentVersion::query()
            ->whereHas('document', fn($q) => $q->where('created_by', $user->id))
            ->with([
                'document.ownerOffice',
                'tasks' => fn($q) => $q->orderByDesc('id'),
            ])
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        $monitoring = $monitorVersions->map(function ($v) use ($userOfficeId) {
            $openTask = $v->tasks->firstWhere('status', 'open');

            // Already in assigned list — skip
            if ($openTask && (int) $openTask->assigned_office_id === $userOfficeId) {
                return null;
            }

            return [
                'task'    => $openTask,
                'version' => $v,
                'document' => $v->document,
                'can_act' => false,
            ];
        })->filter()->values();

        return response()->json([
            'assigned'   => $assigned,
            'monitoring' => $monitoring,
        ]);
    }
}
