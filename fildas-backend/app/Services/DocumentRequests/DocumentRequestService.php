<?php

namespace App\Services\DocumentRequests;

use App\Mail\WorkflowNotificationMail;
use App\Models\Notification;
use App\Models\User;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class DocumentRequestService
{
    use LogsActivityTrait;

    public function __construct(
        private DocumentRequestFileService $files,
        private DocumentRequestProgressService $progress,
    ) {}

    /**
     * Create a new document request batch (multi_office or multi_doc).
     */
    public function createRequest(array $data, User $actor, ?UploadedFile $exampleFile = null): int
    {
        return DB::transaction(function () use ($data, $actor, $exampleFile) {
            $now  = now();
            $mode = $data['mode'];

            $requestId = DB::table('document_requests')->insertGetId([
                'title'              => $data['title'],
                'description'        => $data['description'] ?? null,
                'due_at'             => $data['due_at'] ?? null,
                'status'             => 'open',
                'mode'               => $mode,
                'template_id'        => $data['template_id'] ?? null,
                'created_by_user_id' => $actor->id,
                'created_at'         => $now,
                'updated_at'         => $now,
            ]);

            $officeIds = [];

            if ($mode === 'multi_office') {
                // Optional single example file for the whole request
                if ($exampleFile) {
                    $payload = $this->files->saveRequestExampleFile($requestId, $exampleFile);
                    DB::table('document_requests')->where('id', $requestId)->update([
                        'example_original_filename' => $payload['original_filename'],
                        'example_file_path'         => $payload['file_path'],
                        'example_preview_path'      => $payload['preview_path'],
                        'updated_at'                => now(),
                    ]);
                }

                $officeIds = array_values(array_unique(array_map('intval', $data['office_ids'] ?? [])));
                foreach ($officeIds as $oid) {
                    DB::table('document_request_recipients')->insert([
                        'request_id'       => $requestId,
                        'office_id'        => $oid,
                        'status'           => 'pending',
                        'last_submitted_at' => null,
                        'last_reviewed_at'  => null,
                        'created_at'       => $now,
                        'updated_at'       => $now,
                    ]);
                }
            } else {
                // multi_doc — one recipient office
                $officeId = (int) $data['office_id'];
                $officeIds = [$officeId];

                DB::table('document_request_recipients')->insert([
                    'request_id'       => $requestId,
                    'office_id'        => $officeId,
                    'status'           => 'pending',
                    'last_submitted_at' => null,
                    'last_reviewed_at'  => null,
                    'created_at'       => $now,
                    'updated_at'       => $now,
                ]);

                // Create items
                foreach (($data['items'] ?? []) as $i => $itemData) {
                    DB::table('document_request_items')->insert([
                        'request_id'  => $requestId,
                        'title'       => $itemData['title'],
                        'description' => $itemData['description'] ?? null,
                        'template_id' => $itemData['template_id'] ?? null,
                        'sort_order'  => $i,
                        'created_at'  => $now,
                        'updated_at'  => $now,
                    ]);
                }
            }

            // Activity log
            $this->logActivity('document_request.created', 'Created a document request', $actor->id, $actor->office_id, [
                'document_request_id'    => $requestId,
                'document_request_title' => $data['title'],
                'mode'                   => $mode,
                'office_ids'             => $officeIds,
                'due_at'                 => $data['due_at'] ?? null,
            ]);

            // Dispatch Notifications
            $this->sendRequestNotifications($requestId, $officeIds, $actor, $data['title']);

            // Broadcast
            try {
                broadcast(new \App\Events\WorkspaceChanged('request'));
            } catch (\Throwable) {}

            return $requestId;
        });
    }

    /**
     * Submit evidence for a document request/item.
     */
    public function submitSubmission(int $requestId, int $recipientId, array $data, User $actor, array $uploadedFiles): int
    {
        return DB::transaction(function () use ($requestId, $recipientId, $data, $actor, $uploadedFiles) {
            $now    = now();
            $itemId = $data['item_id'] ?? null;

            // count attempt_no
            $attemptNo = (int) (DB::table('document_request_submissions')
                ->where('recipient_id', $recipientId)
                ->max('attempt_no') ?? 0) + 1;

            $submissionId = DB::table('document_request_submissions')->insertGetId([
                'recipient_id'           => $recipientId,
                'item_id'                => $itemId,
                'attempt_no'             => $attemptNo,
                'submitted_by_user_id'   => $actor->id,
                'note'                   => $data['note'] ?? null,
                'status'                 => 'submitted',
                'qa_reviewed_by_user_id' => null,
                'qa_review_note'         => null,
                'reviewed_at'            => null,
                'created_at'             => $now,
                'updated_at'             => $now,
            ]);

            foreach ($uploadedFiles as $i => $f) {
                $payload = $this->files->saveSubmissionFile($submissionId, $f, $i + 1);
                DB::table('document_request_submission_files')->insert([
                    'submission_id'     => $submissionId,
                    'original_filename' => $payload['original_filename'],
                    'file_path'         => $payload['file_path'],
                    'preview_path'      => $payload['preview_path'],
                    'mime'              => $payload['mime'],
                    'size_bytes'        => $payload['size_bytes'],
                    'created_at'        => $now,
                    'updated_at'        => $now,
                ]);
            }

            // Update recipient status
            DB::table('document_request_recipients')
                ->where('id', $recipientId)
                ->update([
                    'status'            => 'submitted',
                    'last_submitted_at' => $now,
                    'updated_at'        => $now,
                ]);

            $this->logActivity('document_request.submission.submitted', 'Submitted document request evidence', $actor->id, $actor->office_id, [
                'document_request_id'    => $requestId,
                'document_request_title' => DB::table('document_requests')->where('id', $requestId)->value('title'),
                'recipient_id'           => $recipientId,
                'submission_id'          => $submissionId,
                'item_id'                => $itemId,
                'attempt_no'             => $attemptNo,
            ]);

            // System message
            $uploadMsg = "Submitted attempt #{$attemptNo}";
            if (!empty($data['note'])) $uploadMsg .= ": " . $data['note'];
            DB::table('document_request_messages')->insert([
                'document_request_id' => $requestId,
                'recipient_id'        => $recipientId,
                'item_id'             => $itemId,
                'sender_user_id'      => $actor->id,
                'type'                => 'upload',
                'message'             => $uploadMsg,
                'created_at'          => $now,
                'updated_at'          => $now,
            ]);

            // Notifications
            $this->sendSubmissionNotifications($requestId, $recipientId, $submissionId, $actor);

            try {
                broadcast(new \App\Events\WorkspaceChanged('request'));
            } catch (\Throwable) {}

            return $submissionId;
        });
    }

    /**
     * Review a submission (accepted/rejected).
     */
    public function reviewSubmission(int $submissionId, array $data, User $actor): void
    {
        DB::transaction(function () use ($submissionId, $data, $actor) {
            $now = now();
            $submission = DB::table('document_request_submissions')->where('id', $submissionId)->first();
            $recipient  = DB::table('document_request_recipients')->where('id', $submission->recipient_id)->first();
            $requestRow = DB::table('document_requests')->where('id', $recipient->request_id)->first();

            DB::table('document_request_submissions')->where('id', $submissionId)->update([
                'status'                 => $data['decision'],
                'qa_reviewed_by_user_id' => $actor->id,
                'qa_review_note'         => $data['note'] ?? null,
                'reviewed_at'            => $now,
                'updated_at'             => $now,
            ]);

            // Determine recipient status based on other items/submissions
            $newStatus = $data['decision']; // default

            if ($requestRow->mode === 'multi_doc' && $data['decision'] === 'accepted') {
                // Check if ALL items in this request are now accepted for this recipient
                $allItems = DB::table('document_request_items')->where('request_id', $recipient->request_id)->get();
                $allAccepted = true;
                foreach ($allItems as $it) {
                    $itemLatest = DB::table('document_request_submissions')
                        ->where('recipient_id', $recipient->id)
                        ->where('item_id', $it->id)
                        ->orderByDesc('attempt_no')
                        ->first();
                    if (!$itemLatest || $itemLatest->status !== 'accepted') {
                        $allAccepted = false;
                        break;
                    }
                }
                $newStatus = $allAccepted ? 'accepted' : 'submitted'; 
            }

            DB::table('document_request_recipients')->where('id', $recipient->id)->update([
                'status'            => $newStatus,
                'last_reviewed_at'  => $now,
                'updated_at'        => $now,
            ]);

            $this->logActivity('document_request.submission.reviewed', "Reviewed submission as {$data['decision']}", $actor->id, $actor->office_id, [
                'document_request_id'    => $recipient->request_id,
                'document_request_title' => $requestRow->title,
                'recipient_id'           => $recipient->id,
                'submission_id'          => $submissionId,
                'decision'               => $data['decision'],
            ]);

            // System message
            DB::table('document_request_messages')->insert([
                'document_request_id' => $recipient->request_id,
                'recipient_id'        => $recipient->id,
                'item_id'             => $submission->item_id,
                'sender_user_id'      => $actor->id,
                'type'                => 'system',
                'message'             => "Submission [Attempt #{$submission->attempt_no}] was " . strtoupper($data['decision']) . ($data['note'] ? ": " . $data['note'] : ""),
                'created_at'          => $now,
                'updated_at'          => $now,
            ]);

            // Notifications
            $this->sendReviewNotifications($recipient->request_id, $recipient->id, $submissionId, $actor, $data['decision'], $data['note']);

            try {
                broadcast(new \App\Events\WorkspaceChanged('request'));
            } catch (\Throwable) {}
        });
    }

    private function sendSubmissionNotifications(int $requestId, int $recipientId, int $submissionId, User $actor): void
    {
        $submitterName = trim(($actor->first_name ?? '') . ' ' . ($actor->last_name ?? '')) ?: 'An office';
        $frontendUrl   = rtrim(env('FRONTEND_URL', config('app.url')), '/');
        $req = DB::table('document_requests')->where('id', $requestId)->first();

        $qaUsers = User::query()
            ->whereHas('role', fn($q) => $q->whereIn('name', ['QA', 'SYSADMIN']))
            ->select(['id', 'office_id', 'email', 'first_name', 'last_name', 'email_doc_updates'])
            ->get();

        foreach ($qaUsers as $u) {
            Notification::create([
                'user_id'             => $u->id,
                'document_id'         => null,
                'document_version_id' => null,
                'event'               => 'document_request.submission.submitted',
                'title'               => 'Document request submission received',
                'body'                => 'An office submitted evidence for a document request.',
                'meta'                => [
                    'document_request_id' => $requestId,
                    'recipient_id'        => $recipientId,
                    'submission_id'       => $submissionId,
                    'from_office_id'      => $actor->office_id,
                ],
                'read_at' => null,
            ]);

            if ($u->email && (bool) ($u->email_requests ?? true)) {
                try {
                    Mail::to($u->email)->queue(new WorkflowNotificationMail(
                        recipientName:   trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')) ?: $u->email,
                        notifTitle:      'Evidence Submission Received: ' . ($req->title ?? 'Request'),
                        notifBody:       "<strong>{$submitterName}</strong> has submitted evidence for the request <strong>\"" . ($req->title ?? 'Request') . "\"</strong>. It is now awaiting your review.",
                        documentTitle:   $req->title ?? 'Document Request',
                        documentStatus:  'Submitted',
                        isReject:        false,
                        actorName:       $submitterName,
                        documentId:      null,
                        cardLabel:       'Document Request',
                        appUrl:          $frontendUrl,
                        appName:         config('app.name', 'FilDAS'),
                        overrideLinkUrl: $frontendUrl . '/document-requests/' . $requestId,
                    ));
                } catch (\Throwable) {}
            }
        }
    }

    private function sendReviewNotifications(int $requestId, int $recipientId, int $submissionId, User $actor, string $decision, ?string $note): void
    {
        $actorName   = trim(($actor->first_name ?? '') . ' ' . ($actor->last_name ?? '')) ?: 'QA';
        $frontendUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
        $req = DB::table('document_requests')->where('id', $requestId)->first();
        $recipient = DB::table('document_request_recipients')->where('id', $recipientId)->first();

        $officeUsers = User::query()
            ->where('office_id', $recipient->office_id)
            ->select(['id', 'email', 'first_name', 'last_name', 'email_doc_updates'])
            ->get();

        $isReject = ($decision === 'rejected');
        $statusLabel = $isReject ? 'Returned / Rejected' : 'Accepted';

        foreach ($officeUsers as $u) {
            Notification::create([
                'user_id'             => $u->id,
                'document_id'         => null,
                'document_version_id' => null,
                'event'               => 'document_request.submission.reviewed',
                'title'               => "Evidence Submission {$statusLabel}",
                'body'                => "QA has reviewed your submission for: " . ($req->title ?? 'Request'),
                'meta'                => [
                    'document_request_id' => $requestId,
                    'recipient_id'        => $recipientId,
                    'submission_id'       => $submissionId,
                    'decision'            => $decision,
                ],
                'read_at' => null,
            ]);

            $shouldEmail = $isReject 
                ? (bool) ($u->email_requests ?? true) 
                : (bool) ($u->email_doc_updates ?? true);

            if ($u->email && $shouldEmail) {
                try {
                    Mail::to($u->email)->queue(new WorkflowNotificationMail(
                        recipientName:   trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')) ?: $u->email,
                        notifTitle:      "Evidence Submission {$statusLabel}: " . ($req->title ?? 'Request'),
                        notifBody:       "QA has <strong>" . strtoupper($decision) . "</strong> your latest evidence submission for <strong>\"" . ($req->title ?? 'Request') . "\"</strong>." . ($note ? "<br><br><strong>Note from QA:</strong> {$note}" : ""),
                        documentTitle:   $req->title ?? 'Document Request',
                        documentStatus:  $statusLabel,
                        isReject:        $isReject,
                        actorName:       $actorName,
                        documentId:      null,
                        cardLabel:       'Document Request',
                        appUrl:          $frontendUrl,
                        appName:         config('app.name', 'FilDAS'),
                        overrideLinkUrl: $frontendUrl . '/document-requests/' . $requestId,
                    ));
                } catch (\Throwable) {}
            }
        }
    }

    public function sendRequestNotifications(int $requestId, array $officeIds, User $actor, string $title): void
    {
        $actorName = trim(($actor->first_name ?? '') . ' ' . ($actor->last_name ?? '')) ?: 'QA';
        $frontendUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');

        $users = User::query()
            ->whereIn('office_id', $officeIds)
            ->select(['id', 'office_id', 'email', 'first_name', 'last_name', 'email_doc_updates'])
            ->get();

        foreach ($users as $u) {
            Notification::create([
                'user_id'             => $u->id,
                'document_id'         => null,
                'document_version_id' => null,
                'event'               => 'document_request.created',
                'title'               => 'Action Required: New Evidence Request from QA',
                'body'                => 'A new document request has been issued: ' . $title,
                'meta'                => [
                    'document_request_id' => $requestId,
                    'office_id'           => (int) $u->office_id,
                ],
                'read_at' => null,
            ]);

            if ($u->email && (bool) ($u->email_requests ?? true)) {
                try {
                    Mail::to($u->email)->queue(new WorkflowNotificationMail(
                        recipientName:   trim(($u->first_name ?? '') . ' ' . ($u->last_name ?? '')) ?: $u->email,
                        notifTitle:      'Action Required: New Evidence Request from QA',
                        notifBody:       "A new evidence request <strong>\"{$title}\"</strong> has been issued by QA. Please provide the required documents by the deadline.",
                        documentTitle:   $title,
                        documentStatus:  'Open',
                        isReject:        false,
                        actorName:       $actorName,
                        documentId:      null,
                        cardLabel:       'Document Request',
                        appUrl:          $frontendUrl,
                        appName:         config('app.name', 'FilDAS'),
                        overrideLinkUrl: $frontendUrl . '/document-requests/' . $requestId,
                    ));
                } catch (\Throwable) {}
            }
        }
    }
}
