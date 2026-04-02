<?php

namespace App\Policies;

use App\Models\DocumentVersion;
use App\Models\User;
use App\Models\WorkflowTask;
use App\Models\Office;
use Illuminate\Auth\Access\Response;
use Illuminate\Support\Facades\Cache;

class DocumentVersionPolicy
{
    private function vpRoleToOfficeCode(?string $roleName): ?string
    {
        $roleName = $roleName ? strtolower(trim($roleName)) : null;

        return match ($roleName) {
            'vpaa' => 'VA',
            'vpadmin' => 'VAd',
            'vpfinance' => 'VF',
            'vpreqa' => 'VR',
            default => null,
        };
    }

    private function canSeeAll(?string $roleName): bool
    {
        $roleName = $roleName ? strtolower(trim($roleName)) : null;
        return in_array($roleName, ['admin', 'president', 'qa'], true);
    }

    /**
     * Core access check for "user can access the document family at all".
     */
    public function access(User $user, DocumentVersion $version): Response
    {
        $roleName = $user->role?->name ? strtolower(trim($user->role->name)) : null;

        // Admin/sysadmin — full access, no office required
        if (in_array($roleName, ['admin', 'sysadmin'], true)) {
            return Response::allow();
        }

        // Auditor: only Distributed
        if ($roleName === 'auditor') {
            return $version->status === 'Distributed'
                ? Response::allow()
                : Response::deny('Only Distributed versions are accessible for Auditor.');
        }

        if (!$user->office_id) {
            return Response::deny('Your account has no office assigned.');
        }

        if ($this->canSeeAll($roleName)) {
            return Response::allow();
        }

        $document = $version->document()->first();
        if (!$document) {
            return Response::deny('Document not found.');
        }

        $userOfficeId = (int) $user->office_id;

        // 1) Owner office
        if ((int) ($document->owner_office_id ?? 0) === $userOfficeId) {
            return Response::allow();
        }

        // 2) Shared to my office
        $isShared = $document->sharedOffices()
            ->where('offices.id', $userOfficeId)
            ->exists();

        if ($isShared) {
            return Response::allow();
        }

        // 3a) Open task assigned to my office on LATEST version
        $latestVersionNumber = $document->versions()
            ->max('version_number');

        $hasOpenTaskOnLatest = WorkflowTask::query()
            ->where('workflow_tasks.status', 'open')
            ->where('workflow_tasks.assigned_office_id', $userOfficeId)
            ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
            ->where('document_versions.document_id', (int) $document->id)
            ->where('document_versions.version_number', (int) $latestVersionNumber)
            ->exists();

        if ($hasOpenTaskOnLatest) {
            return Response::allow();
        }

        // 3b) Office participated in the workflow at any point (any task, any status)
        //     Allows offices to view Distributed documents they helped process.
        $wasWorkflowParticipant = WorkflowTask::query()
            ->where('workflow_tasks.assigned_office_id', $userOfficeId)
            ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
            ->where('document_versions.document_id', (int) $document->id)
            ->exists();

        if ($wasWorkflowParticipant) {
            return Response::allow();
        }

        // 4) VP scope (owner office under VP office)
        $vpOfficeCode = $this->vpRoleToOfficeCode($roleName);
        if ($vpOfficeCode) {
            $vpOfficeId = Cache::remember("office_id:{$vpOfficeCode}", 3600, function () use ($vpOfficeCode) {
                return Office::where('code', $vpOfficeCode)->value('id');
            });

            if ($vpOfficeId) {
                $vpOfficeIds = Cache::remember("vp_office_ids:{$vpOfficeId}", 3600, function () use ($vpOfficeId) {
                    return Office::where('parent_office_id', $vpOfficeId)
                        ->pluck('id')
                        ->push($vpOfficeId)
                        ->values()
                        ->all();
                });

                if (in_array((int) ($document->owner_office_id ?? 0), array_map('intval', $vpOfficeIds), true)) {
                    return Response::allow();
                }
            }
        }

        return Response::deny('Forbidden.');
    }

    public function view(User $user, DocumentVersion $version): Response
    {
        return $this->access($user, $version);
    }

    public function preview(User $user, DocumentVersion $version): Response
    {
        // Same rule as "access"
        return $this->access($user, $version);
    }

    public function download(User $user, DocumentVersion $version): Response
    {
        // Same rule as "access"
        return $this->access($user, $version);
    }

    public function updateDraft(User $user, DocumentVersion $version): Response
    {
        $base = $this->access($user, $version);
        if ($base->denied()) return $base;

        $isDraft = in_array($version->status, ['Draft', 'Office Draft'], true);
        $isRegistration = str_contains($version->status, 'Registration');

        if (!$isDraft && !$isRegistration) {
            return Response::deny('Draft fields can only be updated during Draft or Registration phase.');
        }

        // Optional: restrict to QA only, but you didn’t ask for that, so keep it open to anyone who has access.
        return Response::allow();
    }

    public function replaceFile(User $user, DocumentVersion $version): Response
    {
        $base = $this->access($user, $version);
        if ($base->denied()) return $base;

        // Admin / sysadmin bypass — no workflow restrictions in dev mode
        $roleName = strtolower(trim($user->role?->name ?? ''));
        if (in_array($roleName, ['admin', 'sysadmin'], true)) {
            return Response::allow();
        }

        // Allow in Draft
        if ($version->status === 'Draft' || $version->status === 'Office Draft') {
            return Response::allow();
        }

        // Allow during approval phase — user must have an open task assigned to their office
        $approvalStatuses = [
            'For Office Approval',
            'For VP Approval',
            "For President's Approval",
            'For QA Approval Check',
            'For Office Head Approval',
            'For Staff Approval Check',
            'For Owner Approval Check',
            'For Owner Review Check',
            'For QA Review Check',
            'For Staff Review Check',
        ];

        // Also allow custom flow dynamic statuses: "For {code} Approval"
        $isApprovalStatus = in_array($version->status, $approvalStatuses, true)
            || preg_match('/^For .+ Approval$/', $version->status);

        if ($isApprovalStatus) {
            $userOfficeId = (int) ($user->office_id ?? 0);
            $hasOpenTask = \App\Models\WorkflowTask::where('document_version_id', $version->id)
                ->where('status', 'open')
                ->where('assigned_office_id', $userOfficeId)
                ->exists();
            if ($hasOpenTask) return Response::allow();
        }

        return Response::deny('File replacement is only allowed during Draft or when you have an active approval task.');
    }

    public function cancel(User $user, DocumentVersion $version): Response
    {
        // cancelRevision currently only allows Draft anyway; keep same rule here
        return $this->updateDraft($user, $version);
    }

    public function destroy(User $user, DocumentVersion $version): Response
    {
        return $this->updateDraft($user, $version);
    }
}
