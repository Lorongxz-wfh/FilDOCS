<?php

namespace App\Services;

use App\Models\Office;
use App\Models\Role;
use App\Models\User;

class OfficeHierarchyService
{
    public function findClusterHeadFromOfficeId(?int $officeId, string $clusterKind): ?Office
    {
        if (!$officeId) return null;

        $cur = Office::query()->find($officeId);
        if (!$cur) return null;

        $seen = [];

        while ($cur) {
            if (isset($seen[$cur->id])) {
                return null; // cycle protection
            }
            $seen[$cur->id] = true;

            if (($cur->cluster_kind ?? null) === $clusterKind) {
                return $cur;
            }

            if (!$cur->parent_office_id) {
                return null;
            }

            $cur = Office::query()->find($cur->parent_office_id);
        }

        return null;
    }

    public function findVpOfficeForOfficeId(?int $officeId): ?Office
    {
        return $this->findClusterHeadFromOfficeId($officeId, 'vp');
    }

    public function findPresidentOffice(): ?Office
    {
        return Office::query()->where('cluster_kind', 'president')->first();
    }

    public function roleId(string $roleName): ?int
    {
        $id = Role::query()->where('name', $roleName)->value('id');
        return $id ? (int) $id : null;
    }

    public function findSingleActiveUser(int $officeId, string $roleName): ?User
    {
        $roleId = $this->roleId($roleName);
        if (!$roleId) return null;

        return User::query()
            ->where('office_id', $officeId)
            ->where('role_id', $roleId)
            ->whereNull('deleted_at')
            ->first();
    }

    /**
     * Map a VP role name to its corresponding office code.
     * Returns null if the role is not a VP role.
     */
    public function vpRoleToOfficeCode(?string $roleName): ?string
    {
        return match ($roleName) {
            'vpaa'      => 'VA',
            'vpadmin'   => 'VAd',
            'vpfinance' => 'VF',
            'vpreqa'    => 'VR',
            default     => null,
        };
    }
}
