<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $doc = $this;

        // For library queries (status=Distributed), latestDistributedVersion is eager-loaded
        // and gives the correct distributed version even when a newer revision draft exists.
        $v = ($doc->relationLoaded('latestDistributedVersion') && $doc->latestDistributedVersion !== null)
            ? $doc->latestDistributedVersion
            : ($doc->relationLoaded('latestVersion') ? $doc->latestVersion : null);

        // Resolve current OPEN task assignee only if it was eager-loaded.
        // Never query inside a Resource (avoids N+1 on lists). [web:702]
        $assigneeOffice = null;

        if ($v && $v->relationLoaded('tasks')) {
            $openTask = $v->tasks->firstWhere('status', 'open');

            if ($openTask && $openTask->relationLoaded('assignedOffice')) {
                $assigneeOffice = $openTask->assignedOffice;
            }
        }


        return [
            'id' => $doc->id,
            'title' => $doc->title,

            // keep old key names temporarily for frontend compatibility
            'office_id' => $doc->owner_office_id,
            'owner_office_id' => $doc->owner_office_id,
            'office' => $this->whenLoaded('ownerOffice', function () use ($doc) {
                return [
                    'id' => $doc->ownerOffice->id,
                    'name' => $doc->ownerOffice->name,
                    'code' => $doc->ownerOffice->code,
                ];
            }),

            // NEW: routing office (QA-selected) for Office Review/Approval steps
            'review_office_id' => $doc->review_office_id,
            'review_office' => $this->whenLoaded('reviewOffice', function () use ($doc) {
                return [
                    'id' => $doc->reviewOffice->id,
                    'name' => $doc->reviewOffice->name,
                    'code' => $doc->reviewOffice->code,
                ];
            }),


            'doctype' => $doc->doctype,
            'code' => $doc->code,
            'reserved_code' => $doc->reserved_code,
            'tags' => $this->whenLoaded('tags', function () use ($doc) {
                return $doc->tags->pluck('name')->values();
            }),

            'was_participant' => (function () use ($doc) {
                $request = request();
                $user = $request?->user();
                if (!$user || !$user->office_id) return false;
                return \App\Models\WorkflowTask::query()
                    ->where('assigned_office_id', (int) $user->office_id)
                    ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
                    ->where('document_versions.document_id', (int) $doc->id)
                    ->exists();
            })(),


            // Flattened version fields (compat)
            'status' => $v?->status ?? 'Draft',

            // Who currently needs to act (office), used for UI labels like “Forward to X”
            'current_assignee_office' => $assigneeOffice ? [
                'id' => $assigneeOffice->id,
                'name' => $assigneeOffice->name,
                'code' => $assigneeOffice->code,
            ] : null,

            'version_number' => $v?->version_number ?? 0,
            'effective_date' => $v?->effective_date,
            'distributed_at' => $v?->distributed_at,
            'file_path' => $v?->file_path,
            'preview_path' => $v?->preview_path,
            'original_filename' => $v?->original_filename,

            // New metadata (optional for frontend now)
            'visibility_scope' => $doc->visibility_scope,
            'school_year' => $doc->school_year,
            'semester' => $doc->semester,

            'created_by' => $doc->created_by,
            'created_at' => optional($doc->created_at)->toISOString(),
            'updated_at' => optional($doc->updated_at)->toISOString(),
            'archived_at' => optional($doc->archived_at)->toISOString(),

            // Explicit reason for archiving, prioritized for the UI label
            'archive_reason' => $doc->archived_at 
                ? 'Manually Archived' 
                : ($v?->status === 'Superseded' 
                    ? 'Superseded' 
                    : ($v?->status === 'Cancelled' ? 'Cancelled' : null)),
        ];
    }
}
