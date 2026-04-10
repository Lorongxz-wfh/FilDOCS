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
        private OfficeHierarchyService $hierarchy,
        private WorkflowValidationService $validator,
    ) {}

    // ──────────────────────────────────────────────────────────────────────
    // PUBLIC API
    // ──────────────────────────────────────────────────────────────────────

    public function getAvailableActions(DocumentVersion $version, User $user): array
    {
        // Cancel is always checked separately — it's available to owner/admin
        // regardless of which office the open task is assigned to
        $cancelAllowed = $this->canCancelDocument($version, $user);

        $task = $this->openTask($version);
        if (!$task) {
            return $cancelAllowed ? [WorkflowSteps::ACTION_CANCEL_DOCUMENT] : [];
        }

        $userOfficeId = (int) ($user->office_id ?? 0);
        $taskOfficeId = (int) ($task->assigned_office_id ?? 0);
        $roleName     = strtolower($this->roleNameOf($user));
        $isAdmin      = in_array($roleName, ['admin', 'sysadmin'], true);

        $actions = [];

        // Admin always receives the full action list (for observer UI);
        // normal users only see actions when their office is the assigned one.
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

        // Append cancel if allowed and not already in finalization
        if ($cancelAllowed) {
            $step = $task->step ?? '';
            if (
                !WorkflowSteps::isDraftStep($step) &&
                !WorkflowSteps::isFinalizationStep($step)
            ) {
                $actions[] = WorkflowSteps::ACTION_CANCEL_DOCUMENT;
            }
        }

        return $actions;
    }

    // Called by DocumentController::replaceFile after successful upload during approval phase
    public function flagSignedFile(DocumentVersion $version, string $filePath): void
    {
        $version->signed_file_path = $filePath;
        $version->save();
    }

    public function applyAction(
        DocumentVersion $version,
        User $user,
        string $action,
        ?string $note = null,
        ?string $effectiveDate = null,
    ): WorkflowTask {
        return DB::transaction(function () use ($version, $user, $action, $note, $effectiveDate) {
            // 1. Guard against terminal states
            $terminalStatuses = [
                WorkflowSteps::STATUS_DISTRIBUTED,
                WorkflowSteps::STATUS_CANCELLED,
                WorkflowSteps::STATUS_SUPERSEDED
            ];
            if (in_array($version->status, $terminalStatuses, true)) {
                throw new \RuntimeException("Cannot perform action '{$action}' on a document version that is already {$version->status}.");
            }

            // Cancel — handled before task check
            if ($action === WorkflowSteps::ACTION_CANCEL_DOCUMENT) {
                if (!$note) throw new \RuntimeException('A reason is required when cancelling.');
                if (!$this->canCancelDocument($version, $user)) {
                    throw new \RuntimeException('You do not have permission to cancel this document.');
                }
                return $this->applyCancel($version, $user, $note);
            }

            $task = $this->openTask($version);
            if (!$task) {
                throw new \RuntimeException('No open task found for this version.');
            }

            if ($action === WorkflowSteps::ACTION_REJECT) {
                if (!$note) throw new \RuntimeException('A note is required when rejecting.');
                return $this->applyReject($version, $task, $user, $note);
            }

            $flow    = $version->workflow_type;
            $routing = $version->routing_mode;

            // ── Pre-action validation (skipped for admin/sysadmin dev bypass) ──
            $roleName = strtolower(trim($user->role?->name ?? ''));
            if (!in_array($roleName, ['admin', 'sysadmin'], true)) {
                $this->validator->assertActionAllowed($version, $task, $action);
            }

            if ($routing === 'custom') {
                return $this->applyCustomAction($version, $task, $user, $action, $note, $effectiveDate);
            }

            return match ($flow) {
                'office' => $this->applyOfficeAction($version, $task, $user, $action, $note, $effectiveDate),
                default  => $this->applyQaAction($version, $task, $user, $action, $note, $effectiveDate),
            };
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    // AVAILABLE ACTIONS
    // ──────────────────────────────────────────────────────────────────────

    private function availableActionsQa(string $step, User $user): array
    {
        $reviewSteps = [
            WorkflowSteps::STEP_QA_OFFICE_REVIEW,
            WorkflowSteps::STEP_QA_VP_REVIEW,
        ];
        $approvalSteps = [
            WorkflowSteps::STEP_QA_OFFICE_APPROVAL,
            WorkflowSteps::STEP_QA_VP_APPROVAL,
            WorkflowSteps::STEP_QA_PRES_APPROVAL,
        ];

        $actions = match ($step) {
            WorkflowSteps::STEP_QA_DRAFT
            => [WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW],

            WorkflowSteps::STEP_QA_OFFICE_REVIEW
            => [WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP],

            WorkflowSteps::STEP_QA_VP_REVIEW
            => [WorkflowSteps::ACTION_QA_VP_SEND_BACK_TO_QA],

            WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK
            => [WorkflowSteps::ACTION_QA_START_OFFICE_APPROVAL],

            WorkflowSteps::STEP_QA_OFFICE_APPROVAL
            => [WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP_APPR],

            WorkflowSteps::STEP_QA_VP_APPROVAL
            => [WorkflowSteps::ACTION_QA_VP_FORWARD_TO_PRESIDENT],

            WorkflowSteps::STEP_QA_PRES_APPROVAL
            => [WorkflowSteps::ACTION_QA_PRESIDENT_APPROVE],

            WorkflowSteps::STEP_QA_APPROVAL_FINAL_CHECK
            => [WorkflowSteps::ACTION_QA_START_FINALIZATION],

            WorkflowSteps::STEP_QA_REGISTRATION
            => [WorkflowSteps::ACTION_QA_REGISTER],

            WorkflowSteps::STEP_QA_DISTRIBUTION
            => [WorkflowSteps::ACTION_QA_DISTRIBUTE],

            default => [],
        };

        // Reject: review and approval steps (not draft, final checks, finalization)
        if (in_array($step, $reviewSteps, true) || in_array($step, $approvalSteps, true)) {
            $actions[] = WorkflowSteps::ACTION_REJECT;
        }

        return $actions;
    }

    private function availableActionsOffice(string $step, User $user): array
    {
        $reviewSteps = [
            WorkflowSteps::STEP_OFFICE_HEAD_REVIEW,
            WorkflowSteps::STEP_OFFICE_VP_REVIEW,
        ];
        $approvalSteps = [
            WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL,
            WorkflowSteps::STEP_OFFICE_VP_APPROVAL,
            WorkflowSteps::STEP_OFFICE_PRES_APPROVAL,
        ];

        $actions = match ($step) {
            WorkflowSteps::STEP_OFFICE_DRAFT
            => [WorkflowSteps::ACTION_OFFICE_SEND_TO_HEAD],

            WorkflowSteps::STEP_OFFICE_HEAD_REVIEW
            => [WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP],

            WorkflowSteps::STEP_OFFICE_VP_REVIEW
            => [WorkflowSteps::ACTION_OFFICE_VP_SEND_BACK_TO_STAFF],

            WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK
            => [WorkflowSteps::ACTION_OFFICE_START_APPROVAL],

            WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL
            => [WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR],

            WorkflowSteps::STEP_OFFICE_VP_APPROVAL
            => [WorkflowSteps::ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT],

            WorkflowSteps::STEP_OFFICE_PRES_APPROVAL
            => [WorkflowSteps::ACTION_OFFICE_PRESIDENT_APPROVE],

            WorkflowSteps::STEP_OFFICE_APPROVAL_FINAL_CHECK
            => [WorkflowSteps::ACTION_OFFICE_START_FINALIZATION],

            WorkflowSteps::STEP_OFFICE_REGISTRATION
            => [WorkflowSteps::ACTION_OFFICE_REGISTER],

            WorkflowSteps::STEP_OFFICE_DISTRIBUTION
            => [WorkflowSteps::ACTION_OFFICE_DISTRIBUTE],

            default => [],
        };

        if (in_array($step, $reviewSteps, true) || in_array($step, $approvalSteps, true)) {
            $actions[] = WorkflowSteps::ACTION_REJECT;
        }

        return $actions;
    }

    private function availableActionsCustom(string $step, User $user): array
    {
        $rejectableSteps = [
            WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW,
        ];

        $actions = match ($step) {
            WorkflowSteps::STEP_CUSTOM_DRAFT,
            WorkflowSteps::STEP_OFFICE_DRAFT   // backward compat: custom-flow docs created before step normalisation
            => [WorkflowSteps::ACTION_CUSTOM_FORWARD],

            WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW
            => [WorkflowSteps::ACTION_CUSTOM_FORWARD],

            WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER
            => [WorkflowSteps::ACTION_CUSTOM_START_APPROVAL],

            WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL
            => [WorkflowSteps::ACTION_CUSTOM_FORWARD],

            WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER
            => [WorkflowSteps::ACTION_CUSTOM_START_FINALIZATION],

            WorkflowSteps::STEP_CUSTOM_REGISTRATION
            => [WorkflowSteps::ACTION_CUSTOM_REGISTER],

            WorkflowSteps::STEP_CUSTOM_DISTRIBUTION
            => [WorkflowSteps::ACTION_CUSTOM_DISTRIBUTE],

            default => [],
        };

        if (in_array($step, $rejectableSteps, true)) {
            $actions[] = WorkflowSteps::ACTION_REJECT;
        }

        return $actions;
    }

    // ──────────────────────────────────────────────────────────────────────
    // APPLY ACTIONS — QA FLOW
    // ──────────────────────────────────────────────────────────────────────

    private function applyQaAction(
        DocumentVersion $version,
        WorkflowTask $task,
        User $user,
        string $action,
        ?string $note,
        ?string $effectiveDate,
    ): WorkflowTask {
        $doc        = $this->doc($version);
        $qaOfficeId = $this->qaOfficeId();
        $officeId   = (int) ($doc->review_office_id ?? 0);

        [$nextStep, $nextOfficeId, $nextRoleId, $nextUserId] = match ($action) {

            WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW => [
                WorkflowSteps::STEP_QA_OFFICE_REVIEW,
                $officeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP => (function () use ($officeId) {
                [$vpOfficeId, $vpRoleId, $vpUserId] = $this->resolveVp($officeId);
                return [WorkflowSteps::STEP_QA_VP_REVIEW, $vpOfficeId, $vpRoleId, $vpUserId];
            })(),

            WorkflowSteps::ACTION_QA_OFFICE_RETURN_TO_QA => [
                WorkflowSteps::STEP_QA_DRAFT,
                $qaOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_VP_SEND_BACK_TO_QA => [
                WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK,
                $qaOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_START_OFFICE_APPROVAL => [
                WorkflowSteps::STEP_QA_OFFICE_APPROVAL,
                $officeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP_APPR => (function () use ($officeId) {
                [$vpOfficeId, $vpRoleId, $vpUserId] = $this->resolveVp($officeId);
                return [WorkflowSteps::STEP_QA_VP_APPROVAL, $vpOfficeId, $vpRoleId, $vpUserId];
            })(),

            WorkflowSteps::ACTION_QA_VP_FORWARD_TO_PRESIDENT => (function () {
                [$presOfficeId, $presRoleId, $presUserId] = $this->resolvePresident();
                return [WorkflowSteps::STEP_QA_PRES_APPROVAL, $presOfficeId, $presRoleId, $presUserId];
            })(),

            WorkflowSteps::ACTION_QA_PRESIDENT_APPROVE => [
                WorkflowSteps::STEP_QA_APPROVAL_FINAL_CHECK,
                $qaOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_START_FINALIZATION => [
                WorkflowSteps::STEP_QA_REGISTRATION,
                $qaOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_REGISTER => [
                WorkflowSteps::STEP_QA_DISTRIBUTION,
                $qaOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_QA_DISTRIBUTE => [
                WorkflowSteps::STEP_DISTRIBUTED,
                $qaOfficeId,
                null,
                null,
            ],

            default => throw new \InvalidArgumentException("Unknown QA action: {$action}"),
        };

        return $this->transition($version, $task, $user, $nextStep, $nextOfficeId, $nextRoleId, $nextUserId, $note, $effectiveDate);
    }

    // ──────────────────────────────────────────────────────────────────────
    // APPLY ACTIONS — OFFICE FLOW
    // ──────────────────────────────────────────────────────────────────────

    private function applyOfficeAction(
        DocumentVersion $version,
        WorkflowTask $task,
        User $user,
        string $action,
        ?string $note,
        ?string $effectiveDate,
    ): WorkflowTask {
        $doc           = $this->doc($version);
        $ownerOfficeId = (int) ($doc->owner_office_id ?? 0);

        [$nextStep, $nextOfficeId, $nextRoleId, $nextUserId] = match ($action) {

            WorkflowSteps::ACTION_OFFICE_SEND_TO_HEAD => [
                WorkflowSteps::STEP_OFFICE_HEAD_REVIEW,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP => (function () use ($ownerOfficeId) {
                [$vpOfficeId, $vpRoleId, $vpUserId] = $this->resolveVp($ownerOfficeId);
                return [WorkflowSteps::STEP_OFFICE_VP_REVIEW, $vpOfficeId, $vpRoleId, $vpUserId];
            })(),

            WorkflowSteps::ACTION_OFFICE_HEAD_RETURN_TO_STAFF => [
                WorkflowSteps::STEP_OFFICE_DRAFT,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_VP_SEND_BACK_TO_STAFF => [
                WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_START_APPROVAL => [
                WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR => (function () use ($ownerOfficeId) {
                [$vpOfficeId, $vpRoleId, $vpUserId] = $this->resolveVp($ownerOfficeId);
                return [WorkflowSteps::STEP_OFFICE_VP_APPROVAL, $vpOfficeId, $vpRoleId, $vpUserId];
            })(),

            WorkflowSteps::ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT => (function () {
                [$presOfficeId, $presRoleId, $presUserId] = $this->resolvePresident();
                return [WorkflowSteps::STEP_OFFICE_PRES_APPROVAL, $presOfficeId, $presRoleId, $presUserId];
            })(),

            WorkflowSteps::ACTION_OFFICE_PRESIDENT_APPROVE => [
                WorkflowSteps::STEP_OFFICE_APPROVAL_FINAL_CHECK,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_START_FINALIZATION => [
                WorkflowSteps::STEP_OFFICE_REGISTRATION,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_REGISTER => [
                WorkflowSteps::STEP_OFFICE_DISTRIBUTION,
                $ownerOfficeId,
                null,
                null,
            ],

            WorkflowSteps::ACTION_OFFICE_DISTRIBUTE => [
                WorkflowSteps::STEP_DISTRIBUTED,
                $ownerOfficeId,
                null,
                null,
            ],

            default => throw new \InvalidArgumentException("Unknown Office action: {$action}"),
        };

        return $this->transition($version, $task, $user, $nextStep, $nextOfficeId, $nextRoleId, $nextUserId, $note, $effectiveDate);
    }

    // ──────────────────────────────────────────────────────────────────────
    // APPLY ACTIONS — CUSTOM FLOW
    // ──────────────────────────────────────────────────────────────────────

    private function applyCustomAction(
        DocumentVersion $version,
        WorkflowTask $task,
        User $user,
        string $action,
        ?string $note,
        ?string $effectiveDate,
    ): WorkflowTask {
        $doc           = $this->doc($version);
        $ownerOfficeId = (int) ($doc->owner_office_id ?? 0);
        $customList    = $this->customOfficeList((int) $version->id);
        $curStep       = $task->step;
        $curOfficeId   = (int) ($task->assigned_office_id ?? 0);

        $idx        = array_search($curOfficeId, $customList, true);
        $nextInList = ($idx !== false && isset($customList[$idx + 1])) ? $customList[$idx + 1] : null;

        [$nextStep, $nextOfficeId] = match ($action) {

            WorkflowSteps::ACTION_CUSTOM_FORWARD => (function () use ($curStep, $nextInList, $ownerOfficeId, $customList) {
                return match ($curStep) {
                    WorkflowSteps::STEP_CUSTOM_DRAFT,
                    WorkflowSteps::STEP_OFFICE_DRAFT  // backward compat
                    => [WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW, $customList[0] ?? $ownerOfficeId],

                    WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW =>
                    $nextInList
                        ? [WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW, $nextInList]
                        : [WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER, $ownerOfficeId],

                    WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL =>
                    $nextInList
                        ? [WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL, $nextInList]
                        : [WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER, $ownerOfficeId],

                    default => throw new \InvalidArgumentException("CUSTOM_FORWARD not valid at step: {$curStep}"),
                };
            })(),

            WorkflowSteps::ACTION_CUSTOM_START_APPROVAL => [
                WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL,
                $customList[0] ?? $ownerOfficeId,
            ],

            WorkflowSteps::ACTION_CUSTOM_START_FINALIZATION => [
                WorkflowSteps::STEP_CUSTOM_REGISTRATION,
                $ownerOfficeId,
            ],

            WorkflowSteps::ACTION_CUSTOM_REGISTER => [
                WorkflowSteps::STEP_CUSTOM_DISTRIBUTION,
                $ownerOfficeId,
            ],

            WorkflowSteps::ACTION_CUSTOM_DISTRIBUTE => [
                WorkflowSteps::STEP_DISTRIBUTED,
                $ownerOfficeId,
            ],

            default => throw new \InvalidArgumentException("Unknown Custom action: {$action}"),
        };

        return $this->transition($version, $task, $user, $nextStep, $nextOfficeId, null, null, $note, $effectiveDate);
    }

    // ──────────────────────────────────────────────────────────────────────
    // UNIVERSAL REJECT
    // ──────────────────────────────────────────────────────────────────────

    private function applyReject(
        DocumentVersion $version,
        WorkflowTask $task,
        User $user,
        string $note,
    ): WorkflowTask {
        $doc     = $this->doc($version);
        $flow    = $version->workflow_type;
        $routing = $version->routing_mode;

        $ownerOfficeId = ($routing === 'custom' || $flow === 'office')
            ? (int) ($doc->owner_office_id ?? 0)
            : $this->qaOfficeId();

        $draftStep = match (true) {
            $routing === 'custom' => WorkflowSteps::STEP_CUSTOM_DRAFT,
            $flow === 'office'    => WorkflowSteps::STEP_OFFICE_DRAFT,
            default               => WorkflowSteps::STEP_QA_DRAFT,
        };

        return $this->transition($version, $task, $user, $draftStep, $ownerOfficeId, null, null, $note, null, isReject: true);
    }

    // ──────────────────────────────────────────────────────────────────────
    // CANCEL DOCUMENT
    // ──────────────────────────────────────────────────────────────────────

    private function applyCancel(
        DocumentVersion $version,
        User $user,
        string $reason,
    ): WorkflowTask {
        $doc = $this->doc($version);

        // Close all open tasks
        WorkflowTask::where('document_version_id', $version->id)
            ->where('status', 'open')
            ->update(['status' => 'cancelled', 'completed_at' => now()]);

        // Update version status
        $fromStatus      = $version->status;
        $version->status = WorkflowSteps::STATUS_CANCELLED;
        $version->cancelled_at = now();
        $version->save();

        // Post cancel message
        DocumentMessage::create([
            'document_version_id' => $version->id,
            'sender_user_id'      => $user->id,
            'type'                => 'system',
            'message'             => "Document cancelled: {$reason}",
        ]);

        // Notify all involved offices — only if cancelled during review/approval (not draft)
        $draftStatuses = ['Draft', 'Office Draft'];
        $wasDraft = in_array($fromStatus, $draftStatuses, true);

        $involvedOfficeIds = $this->involvedOfficeIds($version);
        $appUrl  = rtrim(env('FRONTEND_URL', config('app.url')), '/');
        $appName = config('app.name', 'FilDAS');
        $actorName = trim($user->first_name . ' ' . $user->last_name) ?: 'Someone';

        foreach ($involvedOfficeIds as $officeId) {
            $officeUsers = User::where('office_id', $officeId)
                ->select(['id', 'first_name', 'last_name', 'email', 'email_doc_updates'])
                ->get();
            foreach ($officeUsers as $u) {
                if ((int) $u->id === (int) $user->id) continue;

                Notification::create([
                    'user_id'             => $u->id,
                    'document_id'         => $version->document_id,
                    'document_version_id' => $version->id,
                    'event'               => 'workflow.cancelled',
                    'title'               => 'Document cancelled',
                    'body'                => ($doc->title ?? 'A document') . ' has been cancelled. Reason: ' . $reason,
                    'meta'                => ['from_status' => $fromStatus],
                    'read_at'             => null,
                ]);

                if (!$wasDraft && (bool) ($u->email_doc_updates ?? true) && $u->email) {
                    try {
                        Mail::to($u->email)->queue(new \App\Mail\WorkflowNotificationMail(
                            recipientName: trim($u->first_name . ' ' . $u->last_name) ?: $u->email,
                            notifTitle: 'Document cancelled',
                            notifBody: ($doc->title ?? 'A document') . ' has been cancelled by ' . $actorName . '. Reason: ' . $reason,
                            documentTitle: $doc->title ?? 'Untitled Document',
                            documentStatus: 'Cancelled',
                            isReject: false,
                            actorName: $actorName,
                            documentId: $version->document_id,
                            appUrl: $appUrl,
                            appName: $appName,
                        ));
                    } catch (\Throwable) {
                    }
                }
            }
        }

        // Activity log
        $this->logActivity('workflow.cancelled', 'Document cancelled', $user->id, $user->office_id, [
            'from_status' => $fromStatus,
            'to_status'   => WorkflowSteps::STATUS_CANCELLED,
            'reason'      => $reason,
        ], $version->document_id, $version->id);

        // Return the last task as a dummy result (cancel doesn't create a new task)
        return WorkflowTask::where('document_version_id', $version->id)
            ->orderByDesc('id')
            ->first();
    }

    private function canCancelDocument(DocumentVersion $version, User $user): bool
    {
        // Admin/SysAdmin can always cancel
        $role = $this->roleNameOf($user);
        if (in_array($role, ['admin', 'sysadmin', 'system admin'], true)) return true;

        // Owner/QA: must be the document's owner office
        $doc           = $this->doc($version);
        $ownerOfficeId = (int) ($doc->owner_office_id ?? 0);
        $userOfficeId  = (int) ($user->office_id ?? 0);

        // For QA flow, owner is QA office
        if ($version->workflow_type === 'qa') {
            return $userOfficeId === $this->qaOfficeId();
        }

        return $userOfficeId === $ownerOfficeId;
    }

    private function involvedOfficeIds(DocumentVersion $version): array
    {
        return WorkflowTask::where('document_version_id', $version->id)
            ->whereNotNull('assigned_office_id')
            ->pluck('assigned_office_id')
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    // ──────────────────────────────────────────────────────────────────────
    // CORE TRANSITION
    // ──────────────────────────────────────────────────────────────────────

    private function transition(
        DocumentVersion $version,
        WorkflowTask $currentTask,
        User $actor,
        string $nextStep,
        int $nextOfficeId,
        ?int $nextRoleId,
        ?int $nextUserId,
        ?string $note,
        ?string $effectiveDate,
        bool $isReject = false,
    ): WorkflowTask {
        $flow       = $version->workflow_type;
        $routing    = $version->routing_mode;
        $fromStatus = $version->status;
        $isFinal    = ($nextStep === WorkflowSteps::STEP_DISTRIBUTED);

        $nextOffice     = $nextOfficeId ? Office::find($nextOfficeId) : null;
        $nextOfficeCode = $nextOffice?->code;

        $nextStatus = WorkflowSteps::statusForStep(
            $routing === 'custom' ? 'custom' : $flow,
            $nextStep,
            $nextOfficeCode,
        );

        $nextPhase = WorkflowSteps::phaseForStep($nextStep);

        // 1. Close current task
        $currentTask->status       = $isReject ? 'rejected' : 'completed';
        $currentTask->completed_at = now();
        $currentTask->save();

        // 2. Cancel other open tasks if returning to draft
        if ($isReject || WorkflowSteps::isDraftStep($nextStep)) {
            WorkflowTask::where('document_version_id', $version->id)
                ->where('status', 'open')
                ->where('id', '!=', $currentTask->id)
                ->update(['status' => 'cancelled', 'completed_at' => now()]);
        }

        // 3. Create next task
        $newTask = WorkflowTask::create([
            'document_version_id' => $version->id,
            'phase'               => $nextPhase,
            'step'                => $nextStep,
            'status'              => $isFinal ? 'completed' : 'open',
            'opened_at'           => now(),
            'completed_at'        => $isFinal ? now() : null,
            'assigned_office_id'  => $nextOfficeId,
            'assigned_role_id'    => $nextRoleId,
            'assigned_user_id'    => $nextUserId,
        ]);

        // 4. Update version status
        $version->status = $nextStatus;

        // Consume counter and assign real code at registration step
        $registrationSteps = [
            WorkflowSteps::STEP_QA_DISTRIBUTION,
            WorkflowSteps::STEP_OFFICE_DISTRIBUTION,
            WorkflowSteps::STEP_CUSTOM_DISTRIBUTION,
        ];
        if (in_array($nextStep, $registrationSteps, true)) {
            $doc = $this->doc($version);
            if (!$doc->code) {
                $office = \App\Models\Office::find($doc->owner_office_id);
                if ($office) {
                    DB::transaction(function () use ($doc, $office) {
                        $counter = \App\Models\DocumentCounter::query()
                            ->where('office_id', $doc->owner_office_id)
                            ->where('doctype', $doc->doctype)
                            ->lockForUpdate()
                            ->first();

                        if (!$counter) {
                            $counter = \App\Models\DocumentCounter::create([
                                'office_id' => $doc->owner_office_id,
                                'doctype'   => $doc->doctype,
                                'next_seq'  => 1,
                            ]);
                        }

                        $seq = (int) $counter->next_seq;

                        // Skip any seq whose code is already taken (handles counter
                        // drift from testing resets or partial transaction failures).
                        while (\App\Models\Document::where(
                            'code',
                            \App\Models\Document::generateCode($office, $doc->doctype, $seq)
                        )->exists()) {
                            $seq++;
                        }

                        $doc->code  = \App\Models\Document::generateCode($office, $doc->doctype, $seq);
                        $doc->reserved_code = null;
                        $doc->save();

                        $counter->next_seq = $seq + 1;
                        $counter->save();
                    });
                }
            }
        }

        if ($isFinal) {
            $version->distributed_at = $version->distributed_at ?? now();
            $version->effective_date = $effectiveDate ?? $version->effective_date ?? now()->toDateString();

            DocumentVersion::where('document_id', $version->document_id)
                ->where('id', '!=', $version->id)
                ->where('status', 'Distributed')
                ->update(['status' => 'Superseded', 'superseded_at' => now()]);
        }

        $version->save();

        // 5. Post return/reject note as message
        if ($note && ($isReject || WorkflowSteps::isDraftStep($nextStep))) {
            DocumentMessage::create([
                'document_version_id' => $version->id,
                'sender_user_id'      => $actor->id,
                'type'                => $isReject ? 'reject_note' : 'return_note',
                'message'             => $note,
            ]);
        }

        // 6. Notifications + logs
        $this->notify($nextOfficeId, $actor, $version, $nextStatus, $isReject);
        $this->log($version, $actor, $nextOfficeId, $fromStatus, $nextStatus, $currentTask->step, $nextStep, $nextPhase, $note, $isReject);

        if ($isFinal) {
            $this->notifyDistributed($version, $actor);
        }

        return $newTask;
    }

    // ──────────────────────────────────────────────────────────────────────
    // HELPERS
    // ──────────────────────────────────────────────────────────────────────

    private function openTask(DocumentVersion $version): ?WorkflowTask
    {
        return WorkflowTask::where('document_version_id', $version->id)
            ->where('status', 'open')
            ->orderByDesc('id')
            ->first();
    }

    private function doc(DocumentVersion $version): Document
    {
        return $version->document ?? $version->load('document')->document;
    }

    private function qaOfficeId(): int
    {
        return (int) Office::where('code', 'QA')->value('id');
    }

    private function customOfficeList(int $versionId): array
    {
        return DB::table('document_route_steps')
            ->where('document_version_id', $versionId)
            ->where('phase', 'review')
            ->orderBy('step_order')
            ->pluck('office_id')
            ->map(fn($id) => (int) $id)
            ->unique()
            ->values()
            ->all();
    }

    private function resolveVp(int $basisOfficeId): array
    {
        $vpOffice = $this->hierarchy->findVpOfficeForOfficeId($basisOfficeId);
        if (!$vpOffice) throw new \RuntimeException('VP office not found for this office.');

        $roleId = $this->hierarchy->roleId('vp');
        $user   = $this->hierarchy->findSingleActiveUser((int) $vpOffice->id, 'vp');
        if (!$user) throw new \RuntimeException('No VP user found for VP office ' . $vpOffice->code . '.');

        return [(int) $vpOffice->id, $roleId, (int) $user->id];
    }

    private function resolvePresident(): array
    {
        $presOffice = $this->hierarchy->findPresidentOffice();
        if (!$presOffice) throw new \RuntimeException('President office not found.');

        $roleId = $this->hierarchy->roleId('president');
        $user   = $this->hierarchy->findSingleActiveUser((int) $presOffice->id, 'president');
        if (!$user) throw new \RuntimeException('No President user found.');

        return [(int) $presOffice->id, $roleId, (int) $user->id];
    }

    private function notify(int $officeId, User $actor, DocumentVersion $version, string $toStatus, bool $isReject): void
    {
        $doc       = $this->doc($version);
        $actorName = trim($actor->first_name . ' ' . $actor->last_name) ?: 'Someone';
        $office    = $officeId ? Office::find($officeId) : null;
        $step      = $this->openTask($version)?->step ?? '';

        [$title, $body] = $this->resolveEmailContent($step, $toStatus, $isReject, $doc->title ?? 'A document', $actorName);

        $users = User::where('office_id', $officeId)
            ->select(['id', 'first_name', 'last_name', 'email', 'office_id', 'email_doc_updates', 'email_approvals'])
            ->get();
        foreach ($users as $u) {
            if ((int) $u->id === (int) $actor->id) continue;

            // In-app notification
            Notification::create([
                'user_id'             => $u->id,
                'document_id'         => $version->document_id,
                'document_version_id' => $version->id,
                'event'               => $isReject ? 'workflow.rejected' : 'workflow.assigned',
                'title'               => $title,
                'body'                => $body,
                'meta'                => ['to_status' => $toStatus],
                'read_at'             => null,
            ]);

            // Email notification — only if user has enabled the relevant preference
            // Rejections and assignments both require action
            $shouldEmail = (bool) ($u->email_approvals ?? true);

            if ($shouldEmail && $u->email) {
                try {
                    Mail::to($u->email)->queue(new WorkflowNotificationMail(
                        recipientName:   trim($u->first_name . ' ' . $u->last_name) ?: $u->email,
                        notifTitle:      $title,
                        notifBody:       $body,
                        documentTitle:   $doc->title ?? 'Untitled Document',
                        documentStatus:  $toStatus,
                        isReject:        $isReject,
                        actorName:       $actorName,
                        documentId:      $version->document_id,
                        appUrl:          rtrim(env('FRONTEND_URL', config('app.url')), '/'),
                        appName:         config('app.name', 'FilDAS'),
                    ));
                } catch (\Throwable) {
                    // Email failure must never break the workflow action
                }
            }
        }
    }

    private function notifyDistributed(DocumentVersion $version, User $actor): void
    {
        $doc       = $this->doc($version);
        $actorName = trim($actor->first_name . ' ' . $actor->last_name) ?: 'Someone';
        $appUrl    = rtrim(env('FRONTEND_URL', config('app.url')), '/');
        $appName   = config('app.name', 'FilDAS');

        $participantOfficeIds = WorkflowTask::where('document_version_id', $version->id)
            ->pluck('assigned_office_id')
            ->filter()
            ->map(fn ($id) => (int) $id)
            ->unique()
            ->values()
            ->all();

        $users = User::whereIn('office_id', $participantOfficeIds)
            ->where('id', '!=', $actor->id)
            ->select(['id', 'first_name', 'last_name', 'email', 'email_doc_updates'])
            ->get();

        foreach ($users as $u) {
            // 1. Database Notification
            \App\Models\Notification::create([
                'user_id'             => $u->id,
                'document_id'         => $version->document_id,
                'document_version_id' => $version->id,
                'event'               => 'document.distributed',
                'title'               => 'Document Distributed',
                'body'                => ($doc->title ?? 'A document') . ' has been distributed and is now available in your library.',
                'meta'                => [
                    'version_id' => $version->id,
                    'actor_name' => $actorName,
                ],
                'read_at' => null,
            ]);

            // 2. Email (Respect preference)
            if (!(bool) ($u->email_doc_updates ?? true) || !$u->email) continue;
            try {
                Mail::to($u->email)->queue(new WorkflowNotificationMail(
                    recipientName:  trim($u->first_name . ' ' . $u->last_name) ?: $u->email,
                    notifTitle:     'Document distributed: ' . ($doc->title ?? 'Untitled'),
                    notifBody:      ($doc->title ?? 'A document') . ' has been distributed by ' . $actorName . ' and is now available in the library.',
                    documentTitle:  $doc->title ?? 'Untitled Document',
                    documentStatus: 'Distributed',
                    isReject:       false,
                    actorName:      $actorName,
                    documentId:     $version->document_id,
                    appUrl:         $appUrl,
                    appName:        $appName,
                ));
            } catch (\Throwable) {}
        }
    }

    private function log(
        DocumentVersion $version,
        User $actor,
        int $targetOfficeId,
        string $fromStatus,
        string $toStatus,
        string $fromStep,
        string $toStep,
        string $phase,
        ?string $note,
        bool $isReject,
    ): void {
        [$event, $label] = $this->resolveEventAndLabel($toStep, $toStatus, $isReject);
        $this->logActivity($event, $label, $actor->id, $actor->office_id, [
            'from_status' => $fromStatus,
            'to_status'   => $toStatus,
            'from_step'   => $fromStep,
            'to_step'     => $toStep,
            'phase'       => $phase,
            'note'        => $note,
        ], $version->document_id, $version->id, $targetOfficeId);
    }

    private function resolveEventAndLabel(string $step, string $toStatus, bool $isReject): array
    {
        if ($isReject) return ['workflow.rejected', 'Rejected - returned to draft'];

        return match ($step) {
            // QA flow
            WorkflowSteps::STEP_QA_DRAFT                => ['workflow.returned_to_draft',     'Returned to QA draft'],
            WorkflowSteps::STEP_QA_OFFICE_REVIEW        => ['workflow.sent_to_review',         'Sent to office for review'],
            WorkflowSteps::STEP_QA_VP_REVIEW            => ['workflow.forwarded_to_vp',        'Forwarded to VP for review'],
            WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK   => ['workflow.returned_for_check',     'VP sent back to QA for review check'],
            WorkflowSteps::STEP_QA_OFFICE_APPROVAL      => ['workflow.sent_to_approval',       'Sent to office for approval'],
            WorkflowSteps::STEP_QA_VP_APPROVAL          => ['workflow.forwarded_to_vp',        'Forwarded to VP for approval'],
            WorkflowSteps::STEP_QA_PRES_APPROVAL        => ['workflow.forwarded_to_president', 'Forwarded to President for approval'],
            WorkflowSteps::STEP_QA_APPROVAL_FINAL_CHECK => ['workflow.returned_for_check',     'President approved - QA approval check'],
            WorkflowSteps::STEP_QA_REGISTRATION         => ['workflow.sent_to_registration',   'QA started finalization - registration'],
            WorkflowSteps::STEP_QA_DISTRIBUTION         => ['workflow.registered',             'Document registered - ready to distribute'],

            // Office flow
            WorkflowSteps::STEP_OFFICE_DRAFT                => ['workflow.returned_to_draft',     'Returned to office draft'],
            WorkflowSteps::STEP_OFFICE_HEAD_REVIEW          => ['workflow.sent_to_review',         'Sent to office head for review'],
            WorkflowSteps::STEP_OFFICE_VP_REVIEW            => ['workflow.forwarded_to_vp',        'Forwarded to VP for review'],
            WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK   => ['workflow.returned_for_check',     'VP forwarded to creator for review check'],
            WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL        => ['workflow.sent_to_approval',       'Sent to office head for approval'],
            WorkflowSteps::STEP_OFFICE_VP_APPROVAL          => ['workflow.forwarded_to_vp',        'Forwarded to VP for approval'],
            WorkflowSteps::STEP_OFFICE_PRES_APPROVAL        => ['workflow.forwarded_to_president', 'Forwarded to President for approval'],
            WorkflowSteps::STEP_OFFICE_APPROVAL_FINAL_CHECK => ['workflow.returned_for_check',     'President approved - creator approval check'],
            WorkflowSteps::STEP_OFFICE_REGISTRATION         => ['workflow.sent_to_registration',   'Staff started finalization - registration'],
            WorkflowSteps::STEP_OFFICE_DISTRIBUTION         => ['workflow.registered',             'Document registered - ready to distribute'],

            // Custom flow
            WorkflowSteps::STEP_CUSTOM_DRAFT                    => ['workflow.returned_to_draft',  'Returned to owner draft'],
            WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW            => ['workflow.sent_to_review',      'Forwarded for review'],
            WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER     => ['workflow.returned_for_check',  'Review complete - returned to owner for check'],
            WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL          => ['workflow.sent_to_approval',    'Forwarded for approval'],
            WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER   => ['workflow.returned_for_check',  'Approval complete - returned to owner for check'],
            WorkflowSteps::STEP_CUSTOM_REGISTRATION             => ['workflow.sent_to_registration', 'Owner started finalization - registration'],
            WorkflowSteps::STEP_CUSTOM_DISTRIBUTION             => ['workflow.registered',           'Document registered - ready to distribute'],

            // Terminal
            WorkflowSteps::STEP_DISTRIBUTED => ['workflow.distributed', 'Document distributed'],

            default => ['workflow.action', "Advanced to {$toStatus}"],
        };
    }

    private function resolveEmailContent(string $step, string $toStatus, bool $isReject, string $docTitle, string $actorName): array
    {
        if ($isReject) {
            return [
                'Revision Required: ' . $docTitle,
                "<strong>{$actorName}</strong> has returned <strong>\"{$docTitle}\"</strong> to your office for editing. Please review the feedback and resubmit when ready."
            ];
        }

        return match ($step) {
            // QA flow
            WorkflowSteps::STEP_QA_OFFICE_REVIEW => [
                'Review Required: ' . $docTitle,
                "QA has forwarded <strong>\"{$docTitle}\"</strong> to your office for content review. Please verify the details and forward it to the VP."
            ],
            WorkflowSteps::STEP_QA_VP_REVIEW => [
                'VP Review Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> has been forwarded to your office for VP-level review. Please check the document contents before approval starts."
            ],
            WorkflowSteps::STEP_QA_OFFICE_APPROVAL => [
                'Approval Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> is now in the formal approval phase. Your office head's signature and approval are required to proceed."
            ],
            WorkflowSteps::STEP_QA_VP_APPROVAL => [
                'VP Approval Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> has been forwarded to your office for formal VP-level approval."
            ],
            WorkflowSteps::STEP_QA_PRES_APPROVAL => [
                'Presidential Approval Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> is awaiting your final presidential approval and signature."
            ],

            // Office flow
            WorkflowSteps::STEP_OFFICE_HEAD_REVIEW => [
                'Review Required: ' . $docTitle,
                "A draft of <strong>\"{$docTitle}\"</strong> has been submitted to your office head for internal review."
            ],
            WorkflowSteps::STEP_OFFICE_VP_REVIEW => [
                'VP Review Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> from your cluster has been submitted for VP-level review."
            ],
            WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL => [
                'Approval Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> is ready for your office head's formal approval."
            ],
            WorkflowSteps::STEP_OFFICE_VP_APPROVAL => [
                'VP Approval Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> from your cluster is awaiting VP-level approval."
            ],
            WorkflowSteps::STEP_OFFICE_PRES_APPROVAL => [
                'Presidential Approval Required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> is awaiting your final presidential signature."
            ],

            // Final Checks & Returns
            WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK,
            WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK,
            WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER => [
                'Action Required: Final Review Check',
                "The review process for <strong>\"{$docTitle}\"</strong> is complete. Please perform a final check of the feedback before starting the approval phase."
            ],
            WorkflowSteps::STEP_QA_APPROVAL_FINAL_CHECK,
            WorkflowSteps::STEP_OFFICE_APPROVAL_FINAL_CHECK,
            WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER => [
                'Action Required: Final Approval Check',
                "<strong>\"{$docTitle}\"</strong> has received final approval. Please perform a final check before the document is registered and distributed."
            ],

            // Finalization
            WorkflowSteps::STEP_QA_REGISTRATION,
            WorkflowSteps::STEP_OFFICE_REGISTRATION,
            WorkflowSteps::STEP_CUSTOM_REGISTRATION => [
                'Document Ready for Registration',
                "<strong>\"{$docTitle}\"</strong> has been cleared for finalization. Please proceed with registration and distribution."
            ],

            default => [
                'Document action required: ' . $docTitle,
                "<strong>\"{$docTitle}\"</strong> has advanced to <strong>{$toStatus}</strong> and requires your action."
            ]
        };
    }
}
