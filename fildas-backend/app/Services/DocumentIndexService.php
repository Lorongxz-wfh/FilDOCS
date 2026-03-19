<?php

namespace App\Services;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\WorkflowTask;
use App\Models\Office;
use App\Models\User;
use App\Traits\RoleNameTrait;
use Illuminate\Support\Facades\Cache;

class DocumentIndexService
{
    use RoleNameTrait;


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

    /**
     * @return array<int>|null
     */
    private function vpOfficeIdsForRole(?string $roleName): ?array
    {
        $vpOfficeCode = $this->vpRoleToOfficeCode($roleName);
        if (!$vpOfficeCode) return null;

        $vpOfficeId = Cache::remember("office_id:{$vpOfficeCode}", 3600, function () use ($vpOfficeCode) {
            return Office::where('code', $vpOfficeCode)->value('id');
        });

        if (!$vpOfficeId) return [];

        return Cache::remember("vp_office_ids:{$vpOfficeId}", 3600, function () use ($vpOfficeId) {
            return Office::where('parent_office_id', $vpOfficeId)
                ->pluck('id')
                ->push($vpOfficeId)
                ->values()
                ->all();
        });
    }

    public function paginateForUser(User $user, array $data)
    {
        $roleName = $this->roleNameOf($user) ?: null;
        $userOfficeId = $user->office_id;

        $qaOfficeId = Cache::remember('office_id:QA', 3600, function () {
            return Office::where('code', 'QA')->value('id');
        });

        $canSeeAll = in_array($roleName, ['admin', 'president', 'qa'], true);
        $vpOfficeIds = $this->vpOfficeIdsForRole($roleName);

        $query = Document::query();

        // prefer owner_office_id (new), fallback to office_id (legacy)
        $ownerOfficeFilter = (int) ($data['owner_office_id'] ?? 0);
        if (!$ownerOfficeFilter && !empty($data['office_id'])) {
            $ownerOfficeFilter = (int) $data['office_id'];
        }

        $scope = $data['scope'] ?? 'all';

        // Filters
        if (!empty($data['doctype'])) $query->where('doctype', $data['doctype']);
        if (!empty($data['visibility_scope'])) $query->where('visibility_scope', $data['visibility_scope']);
        if ($ownerOfficeFilter > 0) $query->where('owner_office_id', $ownerOfficeFilter);

        if (!empty($data['status'])) {
            $query->whereHas('latestVersion', function ($v) use ($data) {
                $v->where('status', $data['status']);
            });
        }

        // Date range filter (created_at of the document)
        if (!empty($data['date_from'])) {
            $query->where('documents.created_at', '>=', $data['date_from'] . ' 00:00:00');
        }
        if (!empty($data['date_to'])) {
            $query->where('documents.created_at', '<=', $data['date_to'] . ' 23:59:59');
        }

        if (!empty($data['q'])) {
            $term = trim($data['q']);
            $like = '%' . str_replace('%', '\\%', $term) . '%';

            $query->where(function ($qq) use ($like) {
                $qq->where('documents.title', 'like', $like)
                    ->orWhere('documents.code', 'like', $like)
                    ->orWhereHas('latestVersion', function ($v) use ($like) {
                        $v->where('description', 'like', $like);
                    })
                    ->orWhereHas('ownerOffice', function ($o) use ($like) {
                        $o->where('name', 'like', $like)->orWhere('code', 'like', $like);
                    })
                    ->orWhereHas('reviewOffice', function ($o) use ($like) {
                        $o->where('name', 'like', $like)->orWhere('code', 'like', $like);
                    });
            });
        }

        // Auditor: only docs whose latest version is Distributed
        if ($roleName === 'auditor') {
            $query->whereHas('latestVersion', fn($v) => $v->where('status', 'Distributed'));
        } else if (!$canSeeAll) {
            $query->where(function ($q) use ($vpOfficeIds, $userOfficeId) {
                // Has an open task assigned to this office on the latest version
                $q->orWhereHas('latestVersion', function ($v) use ($userOfficeId) {
                    $v->whereHas('tasks', function ($t) use ($userOfficeId) {
                        $t->where('status', 'open')->where('assigned_office_id', $userOfficeId);
                    });
                });

                // Owns the document
                if (is_array($vpOfficeIds)) $q->orWhereIn('documents.owner_office_id', $vpOfficeIds);
                else $q->orWhere('documents.owner_office_id', $userOfficeId);

                // Shared directly to this office
                $q->orWhereHas('sharedOffices', fn($s) => $s->where('offices.id', $userOfficeId));

                // Was a workflow participant (had a task at any point) and doc is now Distributed
                $q->orWhere(function ($inner) use ($userOfficeId) {
                    $inner->whereHas('latestVersion', fn($v) => $v->where('status', 'Distributed'))
                        ->whereHas('versions', function ($v) use ($userOfficeId) {
                            $v->whereHas('tasks', fn($t) => $t->where('assigned_office_id', $userOfficeId));
                        });
                });
            });
        }

        // Apply scope filter AFTER base visibility rules
        if ($scope === 'owned') {
            if (is_array($vpOfficeIds)) $query->whereIn('documents.owner_office_id', $vpOfficeIds);
            else $query->where('documents.owner_office_id', $userOfficeId);
        } elseif ($scope === 'shared') {
            $query->whereHas('sharedOffices', fn($s) => $s->where('offices.id', $userOfficeId));
        } elseif ($scope === 'assigned') {
            $query->whereHas('latestVersion', function ($v) use ($userOfficeId) {
                $v->whereHas('tasks', function ($t) use ($userOfficeId) {
                    $t->where('status', 'open')->where('assigned_office_id', $userOfficeId);
                });
            });
        }

        $perPage = (int) ($data['per_page'] ?? 25);
        $perPage = max(1, min(100, $perPage));

        return $query
            ->select([
                'documents.id',
                'documents.title',
                'documents.code',
                'documents.doctype',
                'documents.owner_office_id',
                'documents.review_office_id',
                'documents.visibility_scope',
                'documents.school_year',
                'documents.semester',
                'documents.created_at',
            ])
            ->with([
                'ownerOffice:id,code,name',
                'reviewOffice:id,code,name',
                'latestVersion' => function ($q) {
                    $q->select([
                        'document_versions.id',
                        'document_versions.document_id',
                        'document_versions.version_number',
                        'document_versions.status',
                        'document_versions.workflow_type',
                        'document_versions.updated_at',
                        'document_versions.created_at',
                    ]);
                },
                'tags:id,name',
            ])
            ->orderByDesc('documents.created_at')
            ->paginate($perPage);
    }
}
