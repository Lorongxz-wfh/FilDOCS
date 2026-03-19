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
    ): void {
        $this->assertSigningRequirement($version, $task, $action);
        $this->assertRevisionHasNewFile($version, $task, $action);
    }

    // ──────────────────────────────────────────────────────────────────────
    // GUARDS
    // ──────────────────────────────────────────────────────────────────────

    /**
     * During approval phase, a forward action requires a signed file.
     */
    private function assertSigningRequirement(
        DocumentVersion $version,
        WorkflowTask $task,
        string $action,
    ): void {
        if (
            $this->isApprovalStep($task->step) &&
            $this->isForwardActionDuringApproval($action) &&
            empty($version->signed_file_path)
        ) {
            throw new \InvalidArgumentException(
                'A signed copy of the document must be uploaded before forwarding during the approval phase.'
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
            $hasNewFile = ActivityLog::where('document_version_id', $version->id)
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
        ], true);
    }

    private function isForwardActionDuringApproval(string $action): bool
    {
        return in_array($action, [
            WorkflowSteps::ACTION_QA_OFFICE_FORWARD_TO_VP_APPR,
            WorkflowSteps::ACTION_QA_VP_FORWARD_TO_PRESIDENT,
            WorkflowSteps::ACTION_OFFICE_HEAD_FORWARD_TO_VP_APPR,
            WorkflowSteps::ACTION_OFFICE_VP_FORWARD_TO_PRESIDENT,
            WorkflowSteps::ACTION_CUSTOM_FORWARD,
        ], true);
    }
}