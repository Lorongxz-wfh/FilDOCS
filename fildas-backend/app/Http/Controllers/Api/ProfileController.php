<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    // PATCH /api/profile
    public function update(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $data = $request->validate([
            'first_name'  => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name'   => ['required', 'string', 'max:100'],
            'suffix'      => ['nullable', 'string', 'max:20'],
            'email'       => [
                'required', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($user->id),
            ],
        ]);

        $user->fill($data);
        $user->save();

        \App\Models\ActivityLog::create([
            'document_id'         => null,
            'document_version_id' => null,
            'actor_user_id'       => $user->id,
            'actor_office_id'     => $user->office_id,
            'target_office_id'    => null,
            'event'               => 'profile.updated',
            'label'               => 'Updated profile information',
            'meta'                => ['changed_fields' => array_keys($data)],
        ]);

        return response()->json(['user' => $this->userPayload($user)]);
    }

    // POST /api/profile/password
    public function changePassword(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password'         => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        if (!Hash::check($data['current_password'], $user->password)) {
            return response()->json(['message' => 'Current password is incorrect.'], 422);
        }

        $user->password = $data['password'];
        $user->save();

        \App\Models\ActivityLog::create([
            'document_id'         => null,
            'document_version_id' => null,
            'actor_user_id'       => $user->id,
            'actor_office_id'     => $user->office_id,
            'target_office_id'    => null,
            'event'               => 'profile.password_changed',
            'label'               => 'Changed account password',
            'meta'                => null,
        ]);

        return response()->json(['message' => 'Password updated successfully.']);
    }

    // POST /api/profile/photo
    public function uploadPhoto(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $request->validate([
            'photo' => ['required', 'image', 'max:2048'],
        ]);

        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
        }

        $path = $request->file('photo')->store('profile-photos', 'public');
        $user->profile_photo_path = $path;
        $user->save();

        \App\Models\ActivityLog::create([
            'actor_user_id'  => $user->id,
            'actor_office_id' => $user->office_id,
            'event'          => 'profile.photo_updated',
            'label'          => 'Updated profile photo',
        ]);

        return response()->json(['user' => $this->userPayload($user)]);
    }

    // DELETE /api/profile/photo
    public function removePhoto(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if ($user->profile_photo_path) {
            Storage::disk('public')->delete($user->profile_photo_path);
            $user->profile_photo_path = null;
            $user->save();

            \App\Models\ActivityLog::create([
                'actor_user_id'  => $user->id,
                'actor_office_id' => $user->office_id,
                'event'          => 'profile.photo_removed',
                'label'          => 'Removed profile photo',
            ]);
        }

        return response()->json(['user' => $this->userPayload($user)]);
    }

    private function userPayload(\App\Models\User $user): array
    {
        $user->load(['role', 'office']);

        return [
            'id'                  => $user->id,
            'full_name'           => $user->full_name,
            'first_name'          => $user->first_name,
            'middle_name'         => $user->middle_name,
            'last_name'           => $user->last_name,
            'suffix'              => $user->suffix,
            'email'               => $user->email,
            'profile_photo_path'  => $user->profile_photo_path,
            'profile_photo_url'   => $user->profile_photo_url,
            'role'                => strtolower($user->role?->name ?? ''),
            'office_id'           => $user->office_id,
            'office'              => $user->office ? [
                'id'   => $user->office->id,
                'name' => $user->office->name,
                'code' => $user->office->code,
            ] : null,
        ];
    }
}
