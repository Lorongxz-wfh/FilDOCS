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

    public function applyVisibility($query, User $user)
    {
        $roleName = $this->roleNameOf($user) ?: null;
        $userOfficeId = $user->office_id;
        $canSeeAll = in_array($roleName, ['admin', 'sysadmin', 'president', 'qa'], true);
        $vpOfficeIds = $this->vpOfficeIdsForRole($roleName);

        // Auditor: only docs whose current version is Distributed
        if ($roleName === 'auditor') {
            $query->where(function ($q) {
                // Auditor: only docs whose current version is Distributed
                $q->whereHas('latestVersion', fn($v) => $v->where('status', 'Distributed'));
            });
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

                // Was a workflow participant (had a task at any point)
                $q->orWhereHas('versions', function ($v) use ($userOfficeId) {
                    $v->whereHas('tasks', fn($t) => $t->where('assigned_office_id', $userOfficeId));
                });
            });
        }
        
        return $query;
    }

    public function paginateForUser(User $user, array $data)
    {
        $roleName = $this->roleNameOf($user) ?: null;
        $userOfficeId = $user->office_id;

        $qaOfficeId = Cache::remember('office_id:QA', 3600, function () {
            return Office::where('code', 'QA')->value('id');
        });

        $canSeeAll = in_array($roleName, ['admin', 'sysadmin', 'president', 'qa'], true);
        $vpOfficeIds = $this->vpOfficeIdsForRole($roleName);

        $query = Document::query();

        // prefer owner_office_id (new), fallback to office_id (legacy)
        $ownerOfficeFilter = (int) ($data['owner_office_id'] ?? 0);
        if (!$ownerOfficeFilter && !empty($data['office_id'])) {
            $ownerOfficeFilter = (int) $data['office_id'];
        }

        $scope = $data['scope'] ?? 'all';
        $space = $data['space'] ?? 'all'; // workqueue, library, archive, all

        // Filters
        if (!empty($data['doctype'])) $query->where('doctype', $data['doctype']);
        if (!empty($data['visibility_scope'])) $query->where('visibility_scope', $data['visibility_scope']);
        if ($ownerOfficeFilter > 0) $query->where('owner_office_id', $ownerOfficeFilter);

        // ── Space-based Filtering ───────────────────────────────────────────
        if ($space === 'workqueue') {
            // Ongoing documents: not distributed, not cancelled, not superseded
            $query->whereHas('latestVersion', function ($v) {
                $v->whereNotIn('status', ['Distributed', 'Cancelled', 'Superseded']);
            });
        } elseif ($space === 'library') {
            // Active distributed documents: Distributed status and not manually archived
            $query->where('documents.archived_at', null)
                ->whereHas('latestVersion', function ($v) {
                    $v->where('status', 'Distributed');
                });
        } elseif ($space === 'archive') {
            // Terminated or manually archived documents
            $query->where(function ($q) {
                $q->whereNotNull('documents.archived_at')
                    ->orWhereHas('latestVersion', function ($v) {
                        $v->whereIn('status', ['Cancelled', 'Superseded']);
                    });
            });
        } else {
            // 'all' space (legacy/default): respect explicit status filter if provided, 
            // otherwise just apply the status filters below. 
            // Note: we removed the global 'whereNotIn(Cancelled, Superseded)' 
            // to allow full visibility in Admin views if needed.
        }

        if (!empty($data['status'])) {
            $query->whereHas('latestVersion', function ($v) use ($data) {
                $statusArr = is_array($data['status']) 
                    ? $data['status'] 
                    : array_map('trim', explode(',', $data['status']));
                $v->whereIn('status', $statusArr);
            });
        }

        if (!empty($data['phase'])) {
            $phase = strtolower($data['phase']);
            $query->whereHas('latestVersion', function ($v) use ($phase) {
                if ($phase === 'draft') {
                    $v->whereIn('status', ['Draft', 'Office Draft']);
                } elseif ($phase === 'review') {
                    $v->where(fn($q) => $q->where('status', 'like', '%Review%')->orWhere('status', 'like', '%Check%'));
                } elseif ($phase === 'approval') {
                    $v->where('status', 'like', '%Approval%');
                } elseif ($phase === 'finalization') {
                    $v->where(fn($q) => $q->where('status', 'like', '%Registration%')->orWhere('status', 'like', '%Distribution%'));
                } elseif ($phase === 'distributed') {
                    $v->where('status', 'Distributed');
                }
            });
        }

        if (isset($data['version_number']) && strlen($data['version_number']) > 0) {
            $query->whereHas('latestVersion', fn($v) => $v->where('version_number', (int) $data['version_number']));
        }

        if (isset($data['assigned_office_id']) && strlen($data['assigned_office_id']) > 0) {
            $query->whereHas('latestVersion', function ($v) use ($data) {
                $v->whereHas('tasks', function ($t) use ($data) {
                    $t->where('status', 'open')->where('assigned_office_id', (int) $data['assigned_office_id']);
                });
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

        // Apply base visibility rules
        $query = $this->applyVisibility($query, $user);

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
        } elseif ($scope === 'participant') {
            // Had a workflow task in any version (was a participant in the flow)
            $query->whereHas('versions', function ($v) use ($userOfficeId) {
                $v->whereHas('tasks', fn($t) => $t->where('assigned_office_id', $userOfficeId));
            });
        }

        $perPage = (int) ($data['per_page'] ?? 25);
        $perPage = max(1, min(100, $perPage));

        $allowedSorts = ['title', 'created_at', 'code', 'updated_at', 'distributed_at'];
        $sortBy  = in_array($data['sort_by'] ?? '', $allowedSorts, true)
            ? $data['sort_by'] : 'created_at';
        $sortDir = ($data['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $versionFields = [
            'document_versions.id',
            'document_versions.document_id',
            'document_versions.version_number',
            'document_versions.status',
            'document_versions.workflow_type',
            'document_versions.updated_at',
            'document_versions.created_at',
            'document_versions.distributed_at',
        ];

        $withs = [
            'ownerOffice:id,code,name',
            'reviewOffice:id,code,name',
            'latestVersion' => function ($q) use ($versionFields) {
                $q->select($versionFields)->with(['tasks' => function ($t) {
                    $t->where('status', 'open')->with('assignedOffice:id,code,name');
                }]);
            },
            'tags:id,name',
        ];

        // When filtering by Distributed status, also load the latest Distributed version
        // so DocumentResource can show correct version data even after a revision draft exists.
        // Note: do NOT add select() here — ofMany() builds an internal aggregation join that
        // requires its own columns; constraining via callback select breaks that join.
        if (!empty($data['status']) && $data['status'] === 'Distributed') {
            $withs[] = 'latestDistributedVersion';
        }

        $query->select([
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
            'documents.updated_at',
        ]);

        if ($sortBy === 'distributed_at') {
            $query->orderBy(
                DocumentVersion::select('distributed_at')
                    ->whereColumn('document_id', 'documents.id')
                    ->where('status', 'Distributed')
                    ->latest('version_number')
                    ->take(1),
                $sortDir
            );
        } else {
            $query->orderBy('documents.' . $sortBy, $sortDir);
        }

        return $query->with($withs)->paginate($perPage);
    }
}
