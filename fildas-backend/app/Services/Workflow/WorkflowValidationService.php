<?php

namespace App\Services\Workflow;

use App\Models\ActivityLog;
use App\Models\DocumentVersion;
use App\Models\WorkflowTask;
use App\Services\WorkflowSteps;

class WorkflowValidationService
{
    /**
     * Assert that the given action is allowed at this point in the workflow.
     * Throws \InvalidArgumentException if any guard fails.
     */
    public function assertActionAllowed(
        DocumentVersion $version,
        WorkflowTask $task,
        string $action,
        \App\Models\User $user,
    ): void {
        $this->assertOfficeIsolation($task, $user);
        $this->assertDraftHasFile($version, $task, $action);
        $this->assertSigningRequirement($version, $task, $action);
        $this->assertRevisionHasNewFile($version, $task, $action);
    }

    // ──────────────────────────────────────────────────────────────────────
    // GUARDS
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Users (unless admin) can only perform actions on tasks assigned to their office.
     */
    private function assertOfficeIsolation(WorkflowTask $task, \App\Models\User $user): void
    {
        $roleName = strtolower(trim($user->role?->name ?? ''));
        if (in_array($roleName, ['admin', 'sysadmin', 'system admin'], true)) {
            return;
        }

        if ((int) $task->assigned_office_id !== (int) $user->office_id) {
            throw new \InvalidArgumentException(
                "This task is assigned to a different office. You do not have permission to perform this action."
            );
        }
    }

    /**
     * Document workflows must have at least one file uploaded before forwarding from draft.
     */
    private function assertDraftHasFile(DocumentVersion $version, WorkflowTask $task, string $action): void
    {
        $draftForwardActions = [
            \App\Services\WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW,
            \App\Services\WorkflowSteps::ACTION_OFFICE_SEND_TO_HEAD,
            \App\Services\WorkflowSteps::ACTION_CUSTOM_FORWARD,
        ];

        if (
            \App\Services\WorkflowSteps::isDraftStep($task->step) &&
            in_array($action, $draftForwardActions, true) &&
            empty($version->file_path)
        ) {
            throw new \InvalidArgumentException(
                'A document file must be uploaded before this workflow can be forwarded to the next phase.'
            );
        }
    }

    /**
     * During approval phase, a forward action requires a signed file.
     * This includes the initial transition from "Review Check" to the first Approval step.
     */
    private function assertSigningRequirement(
        DocumentVersion $version,
        WorkflowTask $task,
        string $action,
    ): void {
        $startingOrInApproval = $this->isApprovalStep($task->step) || $this->isReviewFinalCheckStep($task->step);

        if (
            $startingOrInApproval &&
            $this->isForwardActionToOrDuringApproval($action) &&
            empty($version->signed_file_path)
        ) {
            throw new \InvalidArgumentException(
                'A signed copy of the document must be uploaded before starting the approval phase.'
            );
        }
    }

    /**
     * Revisions must have a new file uploaded before the first forward from draft.
     */
    private function assertRevisionHasNewFile(
        DocumentVersion $version,
        WorkflowTask $task,
        string $action,
    ): void {
        $draftForwardActions = [
            WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW,
            WorkflowSteps::ACTION_OFFICE_SEND_TO_HEAD,
            WorkflowSteps::ACTION_CUSTOM_FORWARD,
        ];

        if (
            WorkflowSteps::isDraftStep($task->step) &&
            in_array($action, $draftForwardActions, true) &&
            (int) $version->version_number > 0
        ) {
            $hasNewFile = \App\Models\ActivityLog::where('document_version_id', $version->id)
                ->whereIn('event', ['version.file_replaced', 'version.file_uploaded'])
                ->exists();

            if (!$hasNewFile) {
                throw new \InvalidArgumentException(
                    'Upload a new version of the document before forwarding this revision.'
                );
            }
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    // STEP / ACTION CLASSIFIERS
    // ──────────────────────────────────────────────────────────────────────

    private function isReviewFinalCheckStep(string $step): bool
    {
        return in_array($step, [
            WorkflowSteps::STEP_QA_REVIEW_FINAL_CHECK,
            WorkflowSteps::STEP_OFFICE_REVIEW_FINAL_CHECK,
            WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER,
        ], true);
    }

    private function isApprovalStep(string $step): bool
    {
        return in_array($step, [
            WorkflowSteps::STEP_QA_OFFICE_APPROVAL,
            WorkflowSteps::STEP_QA_VP_APPROVAL,
            WorkflowSteps::STEP_QA_PRES_APPROVAL,
            WorkflowSteps::STEP_OFFICE_HEAD_APPROVAL,
            WorkflowSteps::STEP_OFFICE_VP_APPROVAL,
            WorkflowSteps::STEP_OFFICE_PRES_APPROVAL,
            WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL,
            // Note: Approval Final Check steps don't usually require another signature upload 
            // unless the logic demands it, but we can include them if they should block forward.
        ], true);
    }

    private function isForwardActionToOrDuringApproval(string $action): bool
    {
        return in_array($action, [
            // Transitions INTO approval
            WorkflowSteps::ACTION_QA_START_OFFICE_APPROVAL,
            WorkflowSteps::ACTION_OFFICE_START_APPROVAL,
            WorkflowSteps::ACTION_CUSTOM_START_APPROVAL,

            // Transitions WITHIN approval
            WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP_APPR,
            WorkflowSteps::ACTION_QA_VP_FORWARD_TO_PRESIDENT,
            WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR,
            WorkflowSteps::ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT,
            WorkflowSteps::ACTION_CUSTOM_FORWARD, // Custom forward is used for next recipient
        ], true);
    }
}