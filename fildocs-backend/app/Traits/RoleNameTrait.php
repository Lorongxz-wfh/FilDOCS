<?php

namespace App\Traits;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * Provides normalized role-name extraction and common role checks.
 * Use in any Controller or Service that needs to inspect the user's role.
 */
trait RoleNameTrait
{
    /**
     * Extract the normalized role name from the authenticated user in a Request.
     * Returns e.g. "qa", "admin", "office_staff".
     */
    protected function roleName(Request $request): string
    {
        return $this->roleNameOf($request->user());
    }

    /**
     * Extract the normalized role name from a User model instance.
     * Handles all known storage forms: role relation, role_name column, raw string.
     */
    protected function roleNameOf(?User $user): string
    {
        $raw =
            (optional($user?->role)->name ?? null) ??
            ($user?->role_name ?? null) ??
            ($user?->role ?? null) ??
            '';

        return strtolower(trim((string) $raw));
    }

    /**
     * Returns true if the given role string is QA, sysadmin, or admin.
     */
    protected function isQaOrAdmin(string $role): bool
    {
        return in_array($role, ['qa', 'sysadmin', 'admin'], true);
    }

    /**
     * Aborts with 403 unless the request user is QA, sysadmin, or admin.
     */
    protected function assertQaOrSysadmin(Request $request): void
    {
        if (!$this->isQaOrAdmin($this->roleName($request))) {
            abort(403, 'Forbidden.');
        }
    }
}
