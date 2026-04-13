<?php

namespace App\Services;

use App\Mail\WorkflowNotificationMail;
use App\Models\Document;
use App\Models\DocumentMessage;
use App\Models\DocumentVersion;
use App\Models\Notification;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkflowTask;
use App\Services\Workflow\WorkflowValidationService;
use App\Traits\RoleNameTrait;
use App\Traits\LogsActivityTrait;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class WorkflowService
{
    use RoleNameTrait, LogsActivityTrait;

    public function __construct(
        private \App\Services\OfficeHierarchyService $hierarchy,
        private \App\Services\Workflow\WorkflowValidationService $validator,
        private \App\Services\Workflow\WorkflowTransitionService $transitions,
        private \App\Services\Workflow\WorkflowNotificationService $notifier,
    ) {}

    // ──────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────────────────────

    public function getAvailableActions(DocumentVersion $version, User $user): array
    {
        $cancelAllowed = $this->canCancelDocument($version, $user);
        $task = $this->openTask($version);
        if (!$task) {
            return $cancelAllowed ? [\App\Services\WorkflowSteps::ACTION_CANCEL_DOCUMENT] : [];
        }

        $userOfficeId = (int) ($user->office_id ?? 0);
        $taskOfficeId = (int) ($task->assigned_office_id ?? 0);
        $roleName     = strtolower($this->roleNameOf($user));
        $isAdmin      = in_array($roleName, ['admin', 'sysadmin'], true);

        $actions = [];
        if ($isAdmin || $userOfficeId === $taskOfficeId) {
            $flow    = $version->workflow_type;
            $routing = $version->routing_mode;
            $step    = $task->step;

            $actions = $routing === 'custom'
                ? $this->availableActionsCustom($step, $user)
                : match ($flow) {
                    'office' => $this->availableActionsOffice($step, $user),
                    default  => $this->availableActionsQa($step, $user),
                };
        }

        if ($cancelAllowed) {
            $step = $task->step ?? '';
            if (!\App\Services\WorkflowSteps::isDraftStep($step) && !\App\Services\WorkflowSteps::isFinalizationStep($step)) {
                $actions[] = \App\Services\WorkflowSteps::ACTION_CANCEL_DOCUMENT;
            }
        }

        return $actions;
    }

    public function flagSignedFile(DocumentVersion $version, string $filePath): void
    {
        $this->transitions->flagSignedFile($version, $filePath);
    }

    public function applyAction(
        DocumentVersion $version,
        User $user,
        string $action,
        ?string $note = null,
        ?string $effectiveDate = null,
    ): WorkflowTask {
        return DB::transaction(function () use ($version, $user, $action, $note, $effectiveDate) {
            $terminalStatuses = [\App\Services\WorkflowSteps::STATUS_DISTRIBUTED, \App\Services\WorkflowSteps::STATUS_CANCELLED, \App\Services\WorkflowSteps::STATUS_SUPERSEDED];
            if (in_array($version->status, $terminalStatuses, true)) {
                throw new \RuntimeException("Cannot perform '{$action}' on document in '{$version->status}' state.");
            }

            if ($action === \App\Services\WorkflowSteps::ACTION_CANCEL_DOCUMENT) {
                if (!$note) throw new \RuntimeException('Cancellation reason required.');
                if (!$this->canCancelDocument($version, $user)) throw new \RuntimeException('No permission to cancel.');
                return $this->applyCancel($version, $user, $note);
            }

            $task = $this->openTask($version);
            if (!$task) throw new \RuntimeException('No open task found.');

            if ($action === \App\Services\WorkflowSteps::ACTION_REJECT) {
                if (!$note) throw new \RuntimeException('Rejection note required.');
                return $this->transitions->applyReject($version, $task, $user, $note);
            }

            // Validation Guard
            $roleName = strtolower(trim($user->role?->name ?? ''));
            if (!in_array($roleName, ['admin', 'sysadmin'], true)) {
                $this->validator->assertActionAllowed($version, $task, $action, $user);
            }

            $flow    = $version->workflow_type;
            $routing = $version->routing_mode;

            if ($routing === 'custom') {
                return $this->transitions->applyCustomAction($version, $task, $user, $action, $note, $effectiveDate);
            }

            return match ($flow) {
                'office' => $this->transitions->applyOfficeAction($version, $task, $user, $action, $note, $effectiveDate),
                default  => $this->transitions->applyQaAction($version, $task, $user, $action, $note, $effectiveDate),
            };
        });
    }

    public function applyCancel(DocumentVersion $version, User $user, string $reason): WorkflowTask
    {
        // 1. Logic moved to internal helper for now, but uses cleaner services
        $doc = $this->doc($version);
        $fromStatus = $version->status;

        WorkflowTask::where('document_version_id', $version->id)
            ->where('status', 'open')
            ->update(['status' => 'cancelled', 'completed_at' => now()]);

        $version->status = \App\Services\WorkflowSteps::STATUS_CANCELLED;
        $version->cancelled_at = now();
        $version->save();

        DocumentMessage::create([
            'document_version_id' => $version->id,
            'sender_user_id'      => $user->id,
            'type'                => 'system',
            'message'             => "Document cancelled: {$reason}",
        ]);

        // Handlers from Notifier
        $involvedOfficeIds = $this->involvedOfficeIds($version);
        foreach ($involvedOfficeIds as $officeId) {
            $this->notifier->notify($officeId, $user, $version, 'Cancelled', false); // Reuse notify logic
        }

        $this->notifier->log($version, $user, $user->office_id, $fromStatus, 'Cancelled', 'cancelled', 'cancelled', 'completed', $reason, false);

        return WorkflowTask::where('document_version_id', $version->id)->orderByDesc('id')->first();
    }

    public function getRoutingUsers(DocumentVersion $version): \Illuminate\Support\Collection
    {
        $officeIds = collect();
        $ownerOfficeId = (int) ($version->document->owner_office_id ?? 0);
        if ($ownerOfficeId) $officeIds->push($ownerOfficeId);

        $taskOfficeIds = WorkflowTask::where('document_version_id', $version->id)->pluck('assigned_office_id')->unique()->filter();
        $officeIds = $officeIds->merge($taskOfficeIds);

        if ($version->routing_mode === 'custom') {
            $customOfficeIds = DB::table('document_route_steps')->where('document_version_id', $version->id)->pluck('office_id')->unique();
            $officeIds = $officeIds->merge($customOfficeIds);
        } else {
            $officeIds->push((int) \App\Models\Office::where('code', 'QA')->value('id'));
            $officeIds->push((int) \App\Models\Office::where('code', 'PO')->value('id'));
            $vpOffice = $this->hierarchy->findVpOfficeForOfficeId($ownerOfficeId);
            if ($vpOffice) $officeIds->push($vpOffice->id);
            if ($version->workflow_type !== 'office') {
                 $firstTask = WorkflowTask::where('document_version_id', $version->id)->orderBy('id')->first();
                 if ($firstTask && $firstTask->assigned_office_id != $ownerOfficeId) $officeIds->push($firstTask->assigned_office_id);
            }
        }

        return User::query()->whereIn('office_id', $officeIds->unique()->filter())->whereNull('deleted_at')->with('office')->get();
    }

    // ──────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS (Lightweight)
    // ──────────────────────────────────────────────────────────────────────

    private function canCancelDocument(DocumentVersion $version, User $user): bool
    {
        $role = $this->roleNameOf($user);
        if (in_array($role, ['admin', 'sysadmin', 'system admin'], true)) return true;
        
        $doc = $this->doc($version);
        $ownerOfficeId = (int) ($doc->owner_office_id ?? 0);
        $userOfficeId  = (int) ($user->office_id ?? 0);

        if ($version->workflow_type === 'qa') {
            return $userOfficeId === (int) \App\Models\Office::where('code', 'QA')->value('id');
        }
        return $userOfficeId === $ownerOfficeId;
    }

    private function involvedOfficeIds(DocumentVersion $version): array
    {
        return WorkflowTask::where('document_version_id', $version->id)
            ->whereNotNull('assigned_office_id')
            ->pluck('assigned_office_id')
            ->map(fn($id) => (int) $id)
            ->unique()->values()->all();
    }

    private function availableActionsQa(string $step, User $user): array
    {
        $reviewSteps = [\App\Services\WorkflowSteps::STEP_QA_OFFICE_REVIEW, \App\Services\WorkflowSteps::STEP_QA_VP_REVIEW];
        $approvalSteps = [\App\Services\WorkflowSteps::STEP_QA_OFFICE_APPROVAL, \App\Services\WorkflowSteps::STEP_QA_VP_APPROVAL, \App\Services\WorkflowSteps::STEP_QA_PRES_APPROVAL];

        $actions = match ($step) {
            \App\Services\WorkflowSteps::STEP_QA_DRAFT => [\App\Services\WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW],
            \App\Services\WorkflowSteps::STEP_QA_OFFICE_REVIEW => [\App\Services\WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP],
            \App\Services\WorkflowSteps::STEP_QA_VP_REVIEW => [\App\Services\WorkflowSteps::ACTION_QA_VP_SEND_BACK_TO_QA],
            \App\Services\WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK => [\App\Services\WorkflowSteps::ACTION_QA_START_OFFICE_APPROVAL],
            \App\Services\WorkflowSteps::STEP_QA_OFFICE_APPROVAL => [\App\Services\WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP_APPR],
            \App\Services\WorkflowSteps::STEP_QA_VP_APPROVAL => [\App\Services\WorkflowSteps::ACTION_QA_VP_FORWARD_TO_PRESIDENT],
            \App\Services\WorkflowSteps::STEP_QA_PRES_APPROVAL => [\App\Services\WorkflowSteps::ACTION_QA_PRESIDENT_APPROVE],
            \App\Services\WorkflowSteps::STEP_QA_APPROVAL_FINAL_CHECK => [\App\Services\WorkflowSteps::ACTION_QA_START_FINALIZATION],
            \App\Services\WorkflowSteps::STEP_QA_REGISTRATION => [\App\Services\WorkflowSteps::ACTION_QA_REGISTER],
            \App\Services\WorkflowSteps::STEP_QA_DISTRIBUTION => [\App\Services\WorkflowSteps::ACTION_QA_DISTRIBUTE],
            default => [],
        };

        if (in_array($step, $reviewSteps, true) || in_array($step, $approvalSteps, true)) $actions[] = \App\Services\WorkflowSteps::ACTION_REJECT;
        return $actions;
    }

    private function availableActionsOffice(string $step, User $user): array
    {
        $reviewSteps = [\App\Services\WorkflowSteps::STEP_OFFICE_HEAD_REVIEW, \App\Services\WorkflowSteps::STEP_OFFICE_VP_REVIEW];
        $approvalSteps = [\App\Services\WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL, \App\Services\WorkflowSteps::STEP_OFFICE_VP_APPROVAL, \App\Services\WorkflowSteps::STEP_OFFICE_PRES_APPROVAL];

        $actions = match ($step) {
            \App\Services\WorkflowSteps::STEP_OFFICE_DRAFT => [\App\Services\WorkflowSteps::ACTION_OFFICE_SEND_TO_HEAD],
            \App\Services\WorkflowSteps::STEP_OFFICE_HEAD_REVIEW => [\App\Services\WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP],
            \App\Services\WorkflowSteps::STEP_OFFICE_VP_REVIEW => [\App\Services\WorkflowSteps::ACTION_OFFICE_VP_SEND_BACK_TO_STAFF],
            \App\Services\WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK => [\App\Services\WorkflowSteps::ACTION_OFFICE_START_APPROVAL],
            \App\Services\WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL => [\App\Services\WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR],
            \App\Services\WorkflowSteps::STEP_OFFICE_VP_APPROVAL => [\App\Services\WorkflowSteps::ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT],
            \App\Services\WorkflowSteps::STEP_OFFICE_PRES_APPROVAL => [\App\Services\WorkflowSteps::ACTION_OFFICE_PRESIDENT_APPROVE],
            \App\Services\WorkflowSteps::STEP_OFFICE_APPROVAL_FINAL_CHECK => [\App\Services\WorkflowSteps::ACTION_OFFICE_START_FINALIZATION],
            \App\Services\WorkflowSteps::STEP_OFFICE_REGISTRATION => [\App\Services\WorkflowSteps::ACTION_OFFICE_REGISTER],
            \App\Services\WorkflowSteps::STEP_OFFICE_DISTRIBUTION => [\App\Services\WorkflowSteps::ACTION_OFFICE_DISTRIBUTE],
            default => [],
        };

        if (in_array($step, $reviewSteps, true) || in_array($step, $approvalSteps, true)) $actions[] = \App\Services\WorkflowSteps::ACTION_REJECT;
        return $actions;
    }

    private function availableActionsCustom(string $step, User $user): array
    {
        $actions = match ($step) {
            \App\Services\WorkflowSteps::STEP_CUSTOM_DRAFT, \App\Services\WorkflowSteps::STEP_OFFICE_DRAFT => [\App\Services\WorkflowSteps::ACTION_CUSTOM_FORWARD],
            \App\Services\WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW => [\App\Services\WorkflowSteps::ACTION_CUSTOM_FORWARD],
            \App\Services\WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER => [\App\Services\WorkflowSteps::ACTION_CUSTOM_START_APPROVAL],
            \App\Services\WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL => [\App\Services\WorkflowSteps::ACTION_CUSTOM_FORWARD],
            \App\Services\WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER => [\App\Services\WorkflowSteps::ACTION_CUSTOM_START_FINALIZATION],
            \App\Services\WorkflowSteps::STEP_CUSTOM_REGISTRATION => [\App\Services\WorkflowSteps::ACTION_CUSTOM_REGISTER],
            \App\Services\WorkflowSteps::STEP_CUSTOM_DISTRIBUTION => [\App\Services\WorkflowSteps::ACTION_CUSTOM_DISTRIBUTE],
            default => [],
        };

        if ($step === \App\Services\WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW) $actions[] = \App\Services\WorkflowSteps::ACTION_REJECT;
        return $actions;
    }

    private function openTask(DocumentVersion $version): ?WorkflowTask
    {
        return WorkflowTask::where('document_version_id', $version->id)->where('status', 'open')->orderByDesc('id')->first();
    }

    private function doc(DocumentVersion $version): Document
    {
        return $version->document ?? $version->load('document')->document;
    }
}
