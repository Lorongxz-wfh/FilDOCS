<?php

namespace App\Services\Workflow;

use App\Mail\WorkflowNotificationMail;
use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Notification;
use App\Models\Office;
use App\Models\User;
use App\Models\WorkflowTask;
use App\Services\WorkflowSteps;
use App\Traits\LogsActivityTrait;
use Illuminate\Support\Facades\Mail;

class WorkflowNotificationService
{
    use LogsActivityTrait;

    /**
     * Send in-app and email notifications to the office assigned to the next task.
     */
    public function notify(int $officeId, User $actor, DocumentVersion $version, string $toStatus, bool $isReject): void
    {
        $doc       = $this->doc($version);
        $actorName = trim($actor->first_name . ' ' . $actor->last_name) ?: 'Someone';
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

            // Email notification
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
                        appName:         config('app.name', 'FilDOCS'),
                    ));
                } catch (\Throwable) {
                }
            }
        }
    }

    /**
     * Notify all participants when a document is fully distributed.
     */
    public function notifyDistributed(DocumentVersion $version, User $actor): void
    {
        $doc       = $this->doc($version);
        $actorName = trim($actor->first_name . ' ' . $actor->last_name) ?: 'Someone';
        $appUrl    = rtrim(env('FRONTEND_URL', config('app.url')), '/');
        $appName   = config('app.name', 'FilDOCS');

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
            Notification::create([
                'user_id'             => $u->id,
                'document_id'         => $version->document_id,
                'document_version_id' => $version->id,
                'event'               => 'document.distributed',
                'title'               => 'Document Distributed',
                'body'                => ($doc->title ?? 'A document') . ' has been distributed and is now available in your library.',
                'meta'                => ['version_id' => $version->id, 'actor_name' => $actorName],
                'read_at'             => null,
            ]);

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

    /**
     * Log a workflow event to activity logs.
     */
    public function log(
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

    private function resolveEventAndLabel(string $step, string $toStatus, bool $isReject): array
    {
        if ($isReject) return ['workflow.rejected', 'Rejected - returned to draft'];

        return match ($step) {
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

            WorkflowSteps::STEP_CUSTOM_DRAFT                    => ['workflow.returned_to_draft',  'Returned to owner draft'],
            WorkflowSteps::STEP_CUSTOM_OFFICE_REVIEW            => ['workflow.sent_to_review',      'Forwarded for review'],
            WorkflowSteps::STEP_CUSTOM_REVIEW_BACK_TO_OWNER     => ['workflow.returned_for_check',  'Review complete - returned to owner for check'],
            WorkflowSteps::STEP_CUSTOM_OFFICE_APPROVAL          => ['workflow.sent_to_approval',    'Forwarded for approval'],
            WorkflowSteps::STEP_CUSTOM_APPROVAL_BACK_TO_OWNER   => ['workflow.returned_for_check',  'Approval complete - returned to owner for check'],
            WorkflowSteps::STEP_CUSTOM_REGISTRATION             => ['workflow.sent_to_registration', 'Owner started finalization - registration'],
            WorkflowSteps::STEP_CUSTOM_DISTRIBUTION             => ['workflow.registered',           'Document registered - ready to distribute'],

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
