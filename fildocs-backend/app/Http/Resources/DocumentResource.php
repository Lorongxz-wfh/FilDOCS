<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DocumentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $doc = $this;

        // CHECK: If this Model result came from the Archive space join, it has flat version attributes.
        // Priority 1: Use specific target version info from joined list (Archive space)
        // Priority 2: Use latestDistributedVersion (Library space)
        // Priority 3: Fallback to latestVersion (WorkQueue space)
        
        $v = null;
        if (isset($doc->target_version_id)) {
            // Fake a version object or just use the attributes directly.
            // For safety with relations, we'll extract what we need.
            $status = $doc->version_status ?? 'Superseded';
            $versionNumber = $doc->version_number ?? 0;
            $distributedAt = $doc->version_distributed_at ?? null;
        } else {
            $versionObj = ($doc->relationLoaded('latestDistributedVersion') && $doc->latestDistributedVersion !== null)
                ? $doc->latestDistributedVersion
                : ($doc->relationLoaded('latestVersion') ? $doc->latestVersion : null);
            
            $v = $versionObj;
            $status = $v?->status ?? 'Draft';
            $versionNumber = $v?->version_number ?? 0;
            $distributedAt = $v?->distributed_at ?? null;
        }

        // Resolve current OPEN task assignee only if it was eager-loaded.
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
            'ownerOffice' => $this->whenLoaded('ownerOffice', function () use ($doc) {
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
            'status' => $status,

            // Who currently needs to act (office), used for UI labels like “Forward to X”
            'current_assignee_office' => $assigneeOffice ? [
                'id' => $assigneeOffice->id,
                'name' => $assigneeOffice->name,
                'code' => $assigneeOffice->code,
            ] : null,

            'version_number' => $versionNumber,
            'effective_date' => isset($doc->target_version_id) ? ($doc->version_effective_date ?? null) : $v?->effective_date,
            'distributed_at' => $distributedAt,
            'file_path' => isset($doc->target_version_id) ? ($doc->version_file_path ?? null) : $v?->file_path,
            'preview_path' => isset($doc->target_version_id) ? ($doc->version_preview_path ?? null) : $v?->preview_path,
            'original_filename' => isset($doc->target_version_id) ? ($doc->version_original_filename ?? null) : $v?->original_filename,

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
                : ($status === 'Superseded' 
                    ? 'Superseded' 
                    : ($status === 'Cancelled' ? 'Cancelled' : null)),
        ];
    }
}
