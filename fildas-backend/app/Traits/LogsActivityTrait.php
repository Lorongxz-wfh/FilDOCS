<?php

namespace App\Traits;

use App\Models\ActivityLog;

/**
 * Provides a single-method wrapper for ActivityLog::create().
 * Use in any Controller or Service that writes activity log entries.
 */
trait LogsActivityTrait
{
    /**
     * Write one activity log entry.
     *
     * @param  string      $event             Dot-notation event key, e.g. "document.created"
     * @param  string      $label             Human-readable description, e.g. "Created a document"
     * @param  int         $actorUserId       ID of the user performing the action
     * @param  int|null    $actorOfficeId     Office of the actor (null for admin / no-office roles)
     * @param  array|null  $meta              Arbitrary context data (JSON-able)
     * @param  int|null    $documentId        Related document (null for non-document events)
     * @param  int|null    $documentVersionId Related version (null for non-document events)
     * @param  int|null    $targetOfficeId    Destination office when routing (usually null)
     */
    protected function logActivity(
        string $event,
        string $label,
        int $actorUserId,
        ?int $actorOfficeId,
        array|null $meta = null,
        ?int $documentId = null,
        ?int $documentVersionId = null,
        ?int $targetOfficeId = null,
    ): void {
        ActivityLog::create([
            'document_id'         => $documentId,
            'document_version_id' => $documentVersionId,
            'actor_user_id'       => $actorUserId,
            'actor_office_id'     => $actorOfficeId,
            'target_office_id'    => $targetOfficeId,
            'event'               => $event,
            'label'               => $label,
            'meta'                => $meta,
        ]);
    }
}
