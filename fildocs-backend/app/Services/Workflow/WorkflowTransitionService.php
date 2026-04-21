<?php

namespace App\Services\Workflow;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\DocumentMessage;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkflowTask;
use App\Services\OfficeHierarchyService;
use App\Services\WorkflowSteps;
use Illuminate\Support\Facades\DB;

class WorkflowTransitionService
{
    public function __construct(
        private OfficeHierarchyService $hierarchy,
        private WorkflowNotificationService $notifier,
    ) {}

    /**
     * Called by DocumentController::replaceFile after successful upload during approval phase.
     */
    public function flagSignedFile(DocumentVersion $version, string $filePath): void
    {
        $version->signed_file_path = $filePath;
        $version->save();
    }

    /**
     * Apply a QA-start workflow action.
     */
    public function applyQaAction(
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
                WorkflowSteps::STEP_QA_OFFICE_REVIEW, $officeId, null, null
            ],
            WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP => (function () use ($officeId) {
                [$vpOffId, $vpRole, $vpUser] = $this->resolveVp($officeId);
                return [WorkflowSteps::STEP_QA_VP_REVIEW, $vpOffId, $vpRole, $vpUser];
            })(),
            WorkflowSteps::ACTION_QA_OFFICE_RETURN_TO_QA => [
                WorkflowSteps::STEP_QA_DRAFT, $qaOfficeId, null, null
            ],
            WorkflowSteps::ACTION_QA_VP_SEND_BACK_TO_QA => [
                WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK, $qaOfficeId, null, null
            ],
            WorkflowSteps::ACTION_QA_START_OFFICE_APPROVAL => [
                WorkflowSteps::STEP_QA_OFFICE_APPROVAL, $officeId, null, null
            ],
            WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP_APPR => (function () use ($officeId) {
                [$vpOffId, $vpRole, $vpUser] = $this->resolveVp($officeId);
                return [WorkflowSteps::STEP_QA_VP_APPROVAL, $vpOffId, $vpRole, $vpUser];
            })(),
            WorkflowSteps::ACTION_QA_VP_FORWARD_TO_PRESIDENT => (function () {
                [$presOffId, $presRole, $presUser] = $this->resolvePresident();
                return [WorkflowSteps::STEP_QA_PRES_APPROVAL, $presOffId, $presRole, $presUser];
            })(),
            WorkflowSteps::ACTION_QA_PRESIDENT_APPROVE => [
                WorkflowSteps::STEP_QA_APPROVAL_FINAL_CHECK, $qaOfficeId, null, null
            ],
            WorkflowSteps::ACTION_QA_START_FINALIZATION => [
                WorkflowSteps::STEP_QA_REGISTRATION, $qaOfficeId, null, null
            ],
            WorkflowSteps::ACTION_QA_REGISTER => [
                WorkflowSteps::STEP_QA_DISTRIBUTION, $qaOfficeId, null, null
            ],
            WorkflowSteps::ACTION_QA_DISTRIBUTE => [
                WorkflowSteps::STEP_DISTRIBUTED, $qaOfficeId, null, null
            ],
            default => throw new \InvalidArgumentException("Unknown QA action: {$action}"),
        };

        return $this->transition($version, $task, $user, $nextStep, $nextOfficeId, $nextRoleId, $nextUserId, $note, $effectiveDate);
    }

    /**
     * Apply an Office-start workflow action.
     */
    public function applyOfficeAction(
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
                WorkflowSteps::STEP_OFFICE_HEAD_REVIEW, $ownerOfficeId, null, null
            ],
            WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP => (function () use ($ownerOfficeId) {
                [$vpOffId, $vpRole, $vpUser] = $this->resolveVp($ownerOfficeId);
                return [WorkflowSteps::STEP_OFFICE_VP_REVIEW, $vpOffId, $vpRole, $vpUser];
            })(),
            WorkflowSteps::ACTION_OFFICE_VP_SEND_BACK_TO_STAFF => [
                WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK, $ownerOfficeId, null, null
            ],
            WorkflowSteps::ACTION_OFFICE_START_APPROVAL => [
                WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL, $ownerOfficeId, null, null
            ],
            WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR => (function () use ($ownerOfficeId) {
                [$vpOffId, $vpRole, $vpUser] = $this->resolveVp($ownerOfficeId);
                return [WorkflowSteps::STEP_OFFICE_VP_APPROVAL, $vpOffId, $vpRole, $vpUser];
            })(),
            WorkflowSteps::ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT => (function () {
                [$presOffId, $presRole, $presUser] = $this->resolvePresident();
                return [WorkflowSteps::STEP_OFFICE_PRES_APPROVAL, $presOffId, $presRole, $presUser];
            })(),
            WorkflowSteps::ACTION_OFFICE_PRESIDENT_APPROVE => [
                WorkflowSteps::STEP_OFFICE_APPROVAL_FINAL_CHECK, $ownerOfficeId, null, null
            ],
            WorkflowSteps::ACTION_OFFICE_START_FINALIZATION => [
                WorkflowSteps::STEP_OFFICE_REGISTRATION, $ownerOfficeId, null, null
            ],
            WorkflowSteps::ACTION_OFFICE_REGISTER => [
                WorkflowSteps::STEP_OFFICE_DISTRIBUTION, $ownerOfficeId, null, null
            ],
            WorkflowSteps::ACTION_OFFICE_DISTRIBUTE => [
                WorkflowSteps::STEP_DISTRIBUTED, $ownerOfficeId, null, null
            ],
            default => throw new \InvalidArgumentException("Unknown Office action: {$action}"),
        };

        return $this->transition($version, $task, $user, $nextStep, $nextOfficeId, $nextRoleId, $nextUserId, $note, $effectiveDate);
    }

    /**
     * Apply a custom routing workflow action.
     */
    public function applyCustomAction(
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
                    WorkflowSteps::STEP_CUSTOM_DRAFT, WorkflowSteps::STEP_OFFICE_DRAFT
                    => [WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW, $customList[0] ?? $ownerOfficeId],

                    WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW =>
                    $nextInList ? [WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW, $nextInList] : [WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER, $ownerOfficeId],

                    WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL =>
                    $nextInList ? [WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL, $nextInList] : [WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER, $ownerOfficeId],

                    default => throw new \InvalidArgumentException("CUSTOM_FORWARD not valid at step: {$curStep}"),
                };
            })(),
            WorkflowSteps::ACTION_CUSTOM_START_APPROVAL => [
                WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL, $customList[0] ?? $ownerOfficeId,
            ],
            WorkflowSteps::ACTION_CUSTOM_START_FINALIZATION => [
                WorkflowSteps::STEP_CUSTOM_REGISTRATION, $ownerOfficeId,
            ],
            WorkflowSteps::ACTION_CUSTOM_REGISTER => [
                WorkflowSteps::STEP_CUSTOM_DISTRIBUTION, $ownerOfficeId,
            ],
            WorkflowSteps::ACTION_CUSTOM_DISTRIBUTE => [
                WorkflowSteps::STEP_DISTRIBUTED, $ownerOfficeId,
            ],
            default => throw new \InvalidArgumentException("Unknown Custom action: {$action}"),
        };

        return $this->transition($version, $task, $user, $nextStep, $nextOfficeId, null, null, $note, $effectiveDate);
    }

    /**
     * Rejects a document and returns it to the creator's draft step.
     */
    public function applyReject(DocumentVersion $version, WorkflowTask $task, User $user, string $note): WorkflowTask
    {
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

        return $this->transition($version, $task, $user, $draftStep, $ownerOfficeId, null, null, $note, null, true);
    }

    /**
     * Core logic for moving a document version to a new step.
     */
    public function transition(
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

        // Code generation and registration handling
        $registrationSteps = [WorkflowSteps::STEP_QA_DISTRIBUTION, WorkflowSteps::STEP_OFFICE_DISTRIBUTION, WorkflowSteps::STEP_CUSTOM_DISTRIBUTION];
        if (in_array($nextStep, $registrationSteps, true)) {
            $this->handleDocRegistration($version);
        }

        if ($isFinal) {
            $version->distributed_at = $version->distributed_at ?? now();
            $version->effective_date = $effectiveDate ?? $version->effective_date ?? now()->toDateString();

            DocumentVersion::where('document_id', $version->document_id)
                ->where('id', '!=', $version->id)
                ->where('status', 'Distributed')
                ->update([
                    'status' => 'Superseded', 
                    'superseded_at' => now(),
                    'retention_date' => null
                ]);
        }

        $version->save();

        // 5. Post return/reject note
        if ($note && ($isReject || WorkflowSteps::isDraftStep($nextStep))) {
            DocumentMessage::create([
                'document_version_id' => $version->id,
                'sender_user_id'      => $actor->id,
                'type'                => $isReject ? 'reject_note' : 'return_note',
                'message'             => $note,
            ]);
        }

        // 6. External processing (Notifications + Logs)
        $this->notifier->notify($nextOfficeId, $actor, $version, $nextStatus, $isReject);
        $this->notifier->log($version, $actor, $nextOfficeId, $fromStatus, $nextStatus, $currentTask->step, $nextStep, $nextPhase, $note, $isReject);

        if ($isFinal) {
            $this->notifier->notifyDistributed($version, $actor);
        }

        return $newTask;
    }

    private function handleDocRegistration(DocumentVersion $version): void
    {
        $doc = $this->doc($version);
        if ($doc->code) return;

        $office = Office::find($doc->owner_office_id);
        if (!$office) return;

        // Lock for update to prevent concurrent sequence collisions
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
        while (Document::where('code', Document::generateCode($office, $doc->doctype, $seq))->exists()) {
            $seq++;
        }

        $doc->code        = Document::generateCode($office, $doc->doctype, $seq);
        $doc->reserved_code = null;
        $doc->save();

        $counter->next_seq = $seq + 1;
        $counter->save();
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
            ->unique()->values()->all();
    }

    private function resolveVp(int $basisOfficeId): array
    {
        $vpOffice = $this->hierarchy->findVpOfficeForOfficeId($basisOfficeId);
        if (!$vpOffice) throw new \RuntimeException('VP office not found.');
        $roleId = $this->hierarchy->roleId('vp');
        $user = $this->hierarchy->findSingleActiveUser((int) $vpOffice->id, 'vp');
        return [(int) $vpOffice->id, $roleId, $user ? (int) $user->id : null];
    }

    private function resolvePresident(): array
    {
        $presOffice = $this->hierarchy->findPresidentOffice();
        if (!$presOffice) throw new \RuntimeException('President office not found.');
        $roleId = $this->hierarchy->roleId('president');
        $user = $this->hierarchy->findSingleActiveUser((int) $presOffice->id, 'president');
        return [(int) $presOffice->id, $roleId, $user ? (int) $user->id : null];
    }
}
