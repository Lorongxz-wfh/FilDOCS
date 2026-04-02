<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\Notification;
use App\Models\User;
use App\Models\ActivityLog;
use App\Traits\LogsActivityTrait;

class DocumentShareService
{
    use LogsActivityTrait;

    /**
     * Sync shares and create notifications + activity log.
     *
     * @return array{office_ids: array<int>, added_office_ids: array<int>, removed_office_ids: array<int>}
     */
    public function setShares(Document $document, array $officeIds, int $actorUserId, int $actorOfficeId): array
    {
        // Allow sharing if there is a Distributed version OR if the current version is in finalization (Registration/Distribution)
        $hasDistributed = DocumentVersion::query()
            ->where('document_id', $document->id)
            ->where('status', 'Distributed')
            ->exists();

        $isFinalizing = false;
        if (!$hasDistributed && $document->latestVersion) {
            $status = $document->latestVersion->status;
            if (str_contains($status, 'Registration') || str_contains($status, 'Distribution')) {
                $isFinalizing = true;
            }
        }

        if (!$hasDistributed && !$isFinalizing) {
            abort(422, 'Can only share after the document reaches the Registration or Distribution phase.');
        }

        $officeIds = array_values(array_unique(array_map('intval', $officeIds)));

        // Capture current shares BEFORE sync so we can detect added/removed
        $beforeOfficeIds = $document->sharedOffices()
            ->pluck('offices.id')
            ->map(fn($v) => (int) $v)
            ->values()
            ->all();

        // Sync
        $document->sharedOffices()->sync($officeIds);

        // Diff
        $addedOfficeIds = array_values(array_diff($officeIds, $beforeOfficeIds));
        $removedOfficeIds = array_values(array_diff($beforeOfficeIds, $officeIds));

        // Create notifications (one per user)
        $latestVersionId = $document->latestVersion?->id;

        if (!empty($addedOfficeIds)) {
            $userIds = User::whereIn('office_id', $addedOfficeIds)->pluck('id')->values()->all();

            $rows = array_map(function ($uid) use ($document, $latestVersionId) {
                return [
                    'user_id' => $uid,
                    'document_id' => $document->id,
                    'document_version_id' => $latestVersionId,
                    'event' => 'document.shared.added',
                    'title' => 'A document was shared with your office',
                    'body' => $document->title,
                    'meta' => json_encode([
                        'document_title' => $document->title,
                        'document_code' => $document->code,
                        'doctype' => $document->doctype,
                        'no_link' => false,
                    ]),
                    'read_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }, $userIds);

            if (!empty($rows)) Notification::insert($rows);
        }

        if (!empty($removedOfficeIds)) {
            $userIds = User::whereIn('office_id', $removedOfficeIds)->pluck('id')->values()->all();

            $rows = array_map(function ($uid) use ($document, $latestVersionId) {
                return [
                    'user_id' => $uid,
                    'document_id' => $document->id,
                    'document_version_id' => $latestVersionId,
                    'event' => 'document.shared.removed',
                    'title' => 'Access to a shared document was removed',
                    'body' => $document->title,
                    'meta' => json_encode([
                        'document_title' => $document->title,
                        'document_code' => $document->code,
                        'doctype' => $document->doctype,
                        'no_link' => true,
                    ]),
                    'read_at' => null,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }, $userIds);

            if (!empty($rows)) Notification::insert($rows);
        }

        $this->logActivity('document.shares_updated', 'Updated document sharing', $actorUserId, $actorOfficeId, [
            'office_ids' => $officeIds,
            'added_office_ids' => $addedOfficeIds,
            'removed_office_ids' => $removedOfficeIds,
        ], $document->id, $latestVersionId);

        return [
            'office_ids' => $officeIds,
            'added_office_ids' => $addedOfficeIds,
            'removed_office_ids' => $removedOfficeIds,
        ];
    }
}
