<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\Office;
use App\Models\Notification;
use App\Mail\WorkflowNotificationMail;
use App\Actions\Admin\CanModifyUserAction;
use App\Traits\LogsActivityTrait;
use Illuminate\Support\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;

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

    /**
     * Enforce uniqueness rules:
     *  - president   → only 1 active user total
     *  - office_head → only 1 active user per office
     *  - vp          → only 1 active user per office (each VP cluster has its own office)
     *
     * $excludeUserId — the user being updated/enabled (exclude them from the count).
     */
    private function assertRoleUnique(?int $roleId, ?int $officeId, ?int $excludeUserId = null): void
    {
        if (!$roleId) return;

        $roleName = strtolower(Role::query()->whereKey($roleId)->value('name') ?? '');

        if (!in_array($roleName, ['office_head', 'vp', 'president'], true)) return;

        $query = User::where('role_id', $roleId)->whereNull('disabled_at');

        if ($excludeUserId) {
            $query->where('id', '!=', $excludeUserId);
        }

        if ($roleName === 'president') {
            if ($query->exists()) {
                abort(422, 'An active President already exists. Disable the current President before assigning a new one.');
            }
            return;
        }

        // office_head and vp: unique per office
        if (!$officeId) return;

        if ($query->where('office_id', $officeId)->exists()) {
            $label = $roleName === 'office_head' ? 'Office Head' : 'VP';
            abort(422, "An active {$label} already exists for this office. Disable the current one before assigning a new one.");
        }
    }

    public function index(Request $request)
    {
        $allowedSorts = ['first_name', 'last_name', 'email', 'created_at'];
        $sortBy  = in_array($request->query('sort_by'), $allowedSorts, true)
            ? $request->query('sort_by') : 'created_at';
        $sortDir = $request->query('sort_dir') === 'asc' ? 'asc' : 'desc';

        $query = User::with(['role', 'office'])
            ->select('id', 'first_name', 'middle_name', 'last_name', 'suffix', 'email', 'profile_photo_path', 'role_id', 'office_id', 'disabled_at', 'disabled_by', 'last_active_at', 'created_at', 'updated_at', 'deleted_at')
            ->orderBy($sortBy, $sortDir);

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
                    ->orWhere('middle_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('suffix', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhereHas('office', function($o) use ($search) {
                        $o->where('name', 'like', "%{$search}%")
                          ->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        $perPage = (int) $request->get('per_page', 10);
        $perPage = max(1, min($perPage, 100));
        $users = $query->paginate($perPage)->appends($request->query());

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

            'office_id' => ['nullable', 'integer', 'exists:offices,id'],
            'role_id' => ['nullable', 'integer', 'exists:roles,id'],
        ]);

        $roleId = $data['role_id'] ?? null;
        $officeId = $data['office_id'] ?? null;

        if ($this->roleDisablesOffice($roleId)) {
            $officeId = null;
        }

        $this->assertRoleUnique($roleId, $officeId);

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

        // Generate a random temporary password — sent to user via email
        $tempPassword = \Illuminate\Support\Str::random(12);
        $user->password = $tempPassword; // hashed automatically by cast
        $user->save();

        $user->load(['role', 'office']);

        try {
            \Illuminate\Support\Facades\Mail::to($user->email)->send(new \App\Mail\WelcomePasswordMail(
                recipientName: trim($user->first_name . ' ' . $user->last_name) ?: $user->email,
                tempPassword:  $tempPassword,
                appUrl:        rtrim(env('FRONTEND_URL', config('app.url')), '/'),
                appName:       config('app.name', 'FilDAS'),
            ));
        } catch (\Throwable) {}

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
            'password' => [
                'nullable', 
                'string', 
                'min:8', 
                'regex:/[a-z]/',      // at least one lowercase
                'regex:/[A-Z]/',      // at least one uppercase
                'regex:/[0-9]/',      // at least one number
                'regex:/[@$!%*#?&_]/', // at least one symbol
            ],
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

        // Enforce role uniqueness when role or office is being changed.
        if (array_key_exists('role_id', $data) || array_key_exists('office_id', $data)) {
            $effectiveRoleId   = $data['role_id']   ?? $user->role_id;
            $effectiveOfficeId = $payload['office_id'] ?? ($data['office_id'] ?? $user->office_id);
            $this->assertRoleUnique($effectiveRoleId, $effectiveOfficeId, $user->id);
        }

        $oldValues = $user->only(['first_name', 'last_name', 'email', 'role_id', 'office_id']);

        $user->fill($payload);

        if (array_key_exists('password', $data) && $data['password']) {
            $user->password = $data['password']; 
        }

        $user->save();
        $user->load(['role', 'office']);

        $changes = [];
        foreach ($payload as $key => $newValue) {
            $oldValue = $oldValues[$key] ?? null;
            if ($oldValue != $newValue) {
                $changes[$key] = [
                    'from' => $oldValue,
                    'to'   => $newValue
                ];
            }
        }

        if (!empty($changes)) {
            $this->logActivity('user.updated', 'Updated a user account', $request->user()->id, $request->user()->office_id, [
                'target_user_id' => $user->id,
                'name'           => trim("{$user->first_name} {$user->last_name}"),
                'changes'        => $changes,
            ]);
        }

        // If role changed, add a dedicated role-change log entry
        $newRoleId = $user->role_id;
        if (array_key_exists('role_id', $data) && (int) $oldRoleId !== (int) $newRoleId) {
            $this->logActivity('user.role_changed', 'Changed user role', $request->user()->id, $request->user()->office_id, [
                'target_user_id' => $user->id,
                'name'           => trim("{$user->first_name} {$user->last_name}"),
                'role'           => [
                    'from' => $oldRoleId, // better if we had names, but IDs are the core data
                    'to'   => $newRoleId,
                    'name' => $user->role?->name
                ]
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

        // Re-enabling this user must not violate role uniqueness constraints.
        $this->assertRoleUnique($user->role_id, $user->office_id);

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

    // PATCH /api/admin/users/{user}/reset-2fa
    public function resetTwoFactor(Request $request, User $user)
    {
        /** @var \App\Models\User $actor */
        $actor = $request->user();

        $user->two_factor_secret = null;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_confirmed_at = null;
        $user->save();

        $this->logActivity('admin.2fa_reset', "Reset 2FA for user: {$user->full_name}", $request->user()->id, $request->user()->office_id);

        // Notify user
        Notification::create([
            'user_id' => $user->id,
            'event'   => 'admin.2fa_reset',
            'title'   => 'Two-Factor Authentication Reset by Admin',
            'body'    => 'An administrator has reset your 2FA settings. You can now log in with your password and re-enable 2FA if desired.',
            'meta'    => ['type' => 'security_alert']
        ]);

        if ($user->email) {
            try {
                $appUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
                $appName = config('app.name', 'FilDAS');
                Mail::to($user->email)->queue(new WorkflowNotificationMail(
                    recipientName: $user->full_name,
                    notifTitle: '2FA Reset by Administrator',
                    notifBody: 'An administrator has reset the two-factor authentication for your ' . $appName . ' account. If you did not request this, please contact the IT department immediately.',
                    documentTitle: 'Account Security',
                    documentStatus: '2FA Reset',
                    isReject: true,
                    actorName: 'System Administrator',
                    documentId: null,
                    appUrl: $appUrl,
                    appName: $appName,
                    cardLabel: 'Critical'
                ));
            } catch (\Throwable $e) {}
        }
 
        return response()->json([
            'message' => 'Two-factor authentication has been reset.',
            'user' => [
                'id' => $user->id,
                'two_factor_enabled' => false,
            ]
        ]);
    }

    // POST /api/admin/users/{user}/photo
    public function uploadPhoto(Request $request, User $user)
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:2048'],
        ]);

        try {
            if ($user->profile_photo_path && !str_starts_with($user->profile_photo_path, 'data:')) {
                Storage::disk()->delete($user->profile_photo_path);
            }

            $file = $request->file('photo');
            $ext = strtolower($file->getClientOriginalExtension());
            $path = "avatars/user_{$user->id}." . $ext;

            Storage::disk()->putFileAs('avatars', $file, "user_{$user->id}.{$ext}");
            
            $user->profile_photo_path = $path;
            $user->save();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('User Photo R2 Upload Failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);
            return response()->json(['message' => 'Failed to process photo.'], 500);
        }

        $this->logActivity('admin.user_photo_updated', "Updated profile photo for user: {$user->full_name}", $request->user()->id, $request->user()->office_id, [
            'target_user_id' => $user->id,
            'target_user' => $user->full_name
        ]);

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

        $this->logActivity('admin.user_photo_removed', "Removed profile photo for user: {$user->full_name}", auth()->id(), auth()->user()->office_id ?? null, [
            'target_user_id' => $user->id,
            'target_user' => $user->full_name
        ]);

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
