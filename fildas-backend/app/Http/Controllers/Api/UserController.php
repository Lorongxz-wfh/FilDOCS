<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\Office;
use App\Actions\Admin\CanModifyUserAction;
use App\Traits\LogsActivityTrait;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;

class UserController extends Controller
{
    use LogsActivityTrait;

    private function roleDisablesOffice(?int $roleId): bool
    {
        if (!$roleId) return false;

        $name = Role::query()->whereKey($roleId)->value('name');
        if (!$name) return false;

        $name = strtolower($name);
        return in_array($name, ['admin', 'auditor'], true);
    }

    public function index(Request $request)
    {
        $query = User::with(['role', 'office'])
            ->select('id', 'first_name', 'middle_name', 'last_name', 'suffix', 'email', 'profile_photo_path', 'role_id', 'office_id', 'disabled_at', 'disabled_by', 'created_at', 'updated_at', 'deleted_at')
            ->orderByDesc('id');

        $showDeleted = $request->boolean('deleted', false);
        if ($showDeleted) {
            $query->withTrashed();
        }

        // status: active | disabled | (empty = all)
        $status = $request->get('status', '');
        if ($status === 'active') {
            $query->whereNull('disabled_at');
        } elseif ($status === 'disabled') {
            $query->whereNotNull('disabled_at');
        }

        // role_id filter
        if ($roleId = $request->get('role_id')) {
            $query->where('role_id', (int) $roleId);
        }

        if ($search = $request->get('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $query->paginate(25)->appends($request->query());

        return response()->json($users);
    }

    // GET /api/admin/roles
    public function roles()
    {
        $roles = Role::query()
            ->orderBy('label')
            ->orderBy('name')
            ->get(['id', 'name', 'label']);

        return response()->json($roles);
    }

    // POST /api/admin/users
    public function store(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'suffix' => ['nullable', 'string', 'max:20'],

            'email' => ['required', 'email', 'max:255', Rule::unique('users', 'email')],
            'password' => ['required', 'string', 'min:6'],

            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        $roleId = $data['role_id'] ?? null;
        $officeId = $data['office_id'] ?? null;

        if ($this->roleDisablesOffice($roleId)) {
            $officeId = null;
        }

        $user = new User();
        $user->fill([
            'first_name' => $data['first_name'],
            'middle_name' => $data['middle_name'] ?? null,
            'last_name' => $data['last_name'],
            'suffix' => $data['suffix'] ?? null,
            'email' => $data['email'],
            'office_id' => $officeId,
            'role_id' => $roleId,
        ]);

        // hashed automatically by cast
        $user->password = $data['password'];
        $user->save();

        $user->load(['role', 'office']);

        $this->logActivity('user.created', 'Created a user account', $request->user()->id, $request->user()->office_id, [
            'target_user_id' => $user->id,
            'name'           => trim("{$user->first_name} {$user->last_name}"),
            'email'          => $user->email,
            'role'           => $user->role?->name,
            'office'         => $user->office?->code,
        ]);

        return response()->json([
            'user' => $user,
        ], 201);
    }

    // PATCH /api/admin/users/{user}
    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'first_name' => ['nullable', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['nullable', 'string', 'max:100'],
            'suffix' => ['nullable', 'string', 'max:20'],
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],

            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],

            // If present and non-empty, reset password
            'password' => ['nullable', 'string', 'min:6'],
        ]);

        // Only update fields that were sent (PATCH semantics)
        $payload = collect($data)->except(['password'])->toArray();

        // Capture old role before update for audit log
        $oldRoleId = $user->role_id;

        // If role is being changed, enforce office nulling for admin/auditor.
        if (array_key_exists('role_id', $data)) {
            $incomingRoleId = $data['role_id'] ?? null;

            if ($this->roleDisablesOffice($incomingRoleId)) {
                $payload['office_id'] = null;
            }
        }

        $user->fill($payload);

        if (array_key_exists('password', $data) && $data['password']) {
            $user->password = $data['password']; // cast('password' => 'hashed') will hash
        }

        $user->save();

        $user->load(['role', 'office']);

        $this->logActivity('user.updated', 'Updated a user account', $request->user()->id, $request->user()->office_id, [
            'target_user_id' => $user->id,
            'name'           => trim("{$user->first_name} {$user->last_name}"),
            'changed_fields' => array_keys($payload),
        ]);

        // If role changed, add a dedicated role-change log entry
        $newRoleId = $user->role_id;
        if (array_key_exists('role_id', $data) && (int) $oldRoleId !== (int) $newRoleId) {
            $this->logActivity('user.role_changed', 'Changed user role', $request->user()->id, $request->user()->office_id, [
                'target_user_id' => $user->id,
                'name'           => trim("{$user->first_name} {$user->last_name}"),
                'old_role_id'    => $oldRoleId,
                'new_role_id'    => $newRoleId,
                'new_role_name'  => $user->role?->name,
            ]);
        }

        return response()->json([
            'user' => $user,
        ]);
    }

    // PATCH /api/admin/users/{user}/disable
    public function disable(Request $request, User $user, CanModifyUserAction $guard)
    {
        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $guard->assertCanDisableOrDelete($actor, $user);

        if ($user->disabled_at) {
            return response()->json(['user' => $user]);
        }

        $user->disabled_at = Carbon::now();
        $user->disabled_by = $actor->id;
        $user->save();

        $user->load(['role', 'office']);

        $this->logActivity('user.disabled', 'Disabled a user account', $actor->id, $actor->office_id, [
            'target_user_id' => $user->id,
            'name'           => trim("{$user->first_name} {$user->last_name}"),
        ]);

        return response()->json(['user' => $user]);
    }

    // PATCH /api/admin/users/{user}/enable
    public function enable(Request $request, User $user)
    {
        /** @var \App\Models\User $actor */
        $actor = $request->user();

        if ($actor->id === $user->id) {
            abort(422, 'You cannot enable/disable your own account here.');
        }

        $user->disabled_at = null;
        $user->disabled_by = null;
        $user->save();

        $user->load(['role', 'office']);

        $this->logActivity('user.enabled', 'Re-enabled a user account', $actor->id, $actor->office_id, [
            'target_user_id' => $user->id,
            'name'           => trim("{$user->first_name} {$user->last_name}"),
        ]);

        return response()->json(['user' => $user]);
    }

    // DELETE /api/admin/users/{user}  (soft delete)
    public function destroy(Request $request, User $user, CanModifyUserAction $guard)
    {
        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $guard->assertCanDisableOrDelete($actor, $user);

        $this->logActivity('user.deleted', 'Deleted a user account', $actor->id, $actor->office_id, [
            'target_user_id' => $user->id,
            'name'           => trim("{$user->first_name} {$user->last_name}"),
            'email'          => $user->email,
        ]);

        $user->delete();

        return response()->json(['message' => 'User deleted.']);
    }

    // POST /api/admin/users/{user}/photo
    public function uploadPhoto(Request $request, User $user)
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:2048'],
        ]);

        // Delete old photo if exists
        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        $path = $request->file('photo')->store('profile-photos', 'public');
        $user->profile_photo_path = $path;
        $user->save();

        $user->load(['role', 'office']);
        return response()->json(['user' => $user]);
    }

    // DELETE /api/admin/users/{user}/photo
    public function removePhoto(User $user)
    {
        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
            $user->profile_photo_path = null;
            $user->save();
        }

        $user->load(['role', 'office']);
        return response()->json(['user' => $user]);
    }

    // GET /api/admin/offices
    public function offices()
    {
        $offices = Office::query()
            ->orderBy('code')
            ->orderBy('name')
            ->get(['id', 'code', 'name']);

        return response()->json($offices);
    }
}
