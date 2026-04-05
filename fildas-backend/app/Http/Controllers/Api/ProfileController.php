<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\WorkflowNotificationMail;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ProfileController extends Controller
{
    use LogsActivityTrait;

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

        $this->logActivity('profile.updated', 'Updated profile information', $user->id, $user->office_id, ['changed_fields' => array_keys($data)]);

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

        $this->logActivity('profile.password_changed', 'Changed account password', $user->id, $user->office_id);

        // Security email — always sent regardless of notification preferences
        if ($user->email) {
            try {
                $name    = trim($user->first_name . ' ' . $user->last_name) ?: $user->email;
                $appUrl  = rtrim(env('FRONTEND_URL', config('app.url')), '/');
                $appName = config('app.name', 'FilDAS');
                Mail::to($user->email)->queue(new WorkflowNotificationMail(
                    recipientName:  $name,
                    notifTitle:     'Your password was changed',
                    notifBody:      'Your ' . $appName . ' account password was successfully changed. If you did not make this change, contact your administrator immediately.',
                    documentTitle:  'Account Security',
                    documentStatus: 'Password Changed',
                    isReject:       false,
                    actorName:      $name,
                    documentId:     null,
                    cardLabel:      'Account',
                    appUrl:         $appUrl,
                    appName:        $appName,
                ));
            } catch (\Throwable) {}
        }

        return response()->json(['message' => 'Password updated successfully.']);
    }

    // GET /api/profile/signature-file
    public function getSignatureFile(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if (!$user->signature_path) {
            return response()->json(['message' => 'No signature found.'], 404);
        }

        // If stored as Data URI (Base64 in DB)
        if (str_starts_with($user->signature_path, 'data:')) {
            try {
                // Format: data:image/png;base64,xxxx
                $parts = explode(',', $user->signature_path);
                if (count($parts) < 2) throw new \Exception("Invalid data URI");
                
                $header = $parts[0]; // data:image/png;base64
                $data = base64_decode($parts[1]);
                
                $mimeParts = explode(':', $header);
                $mimeType = explode(';', $mimeParts[1] ?? 'image/png')[0];

                return response($data)->header('Content-Type', $mimeType);
            } catch (\Throwable $e) {
                return response()->json(['message' => 'Failed to decode signature data.'], 500);
            }
        }

        $disk = config('filesystems.default') === 's3' ? 's3' : 'public';
        if (!Storage::disk($disk)->exists($user->signature_path)) {
            return response()->json(['message' => 'No signature found on disk.'], 404);
        }

        return Storage::disk($disk)->response($user->signature_path);
    }

    // POST /api/profile/photo
    public function uploadPhoto(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $request->validate([
            'photo' => ['required', 'image', 'max:2048'],
        ]);

        try {
            $file = $request->file('photo');
            $data = base64_encode(file_get_contents($file->getRealPath()));
            $mime = $file->getClientMimeType();
            $user->profile_photo_path = 'data:' . $mime . ';base64,' . $data;
            $user->save();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Profile Photo DB Upload Failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);
            return response()->json(['message' => 'Failed to process photo.'], 500);
        }

        $this->logActivity('profile.photo_updated', 'Updated profile photo (Database)', $user->id, $user->office_id);

        return response()->json(['user' => $this->userPayload($user)]);
    }

    // POST /api/profile/signature
    public function uploadSignature(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $request->validate([
            'signature' => ['required', 'image', 'max:1024'],
        ]);

        try {
            $file = $request->file('signature');
            $data = base64_encode(file_get_contents($file->getRealPath()));
            $mime = $file->getClientMimeType();
            $user->signature_path = 'data:' . $mime . ';base64,' . $data;
            $user->save();
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Signature DB Upload Failed', [
                'error' => $e->getMessage(),
                'user_id' => $user->id
            ]);
            return response()->json(['message' => 'Failed to process signature.'], 500);
        }

        $this->logActivity('profile.signature_updated', 'Updated signature (Database)', $user->id, $user->office_id);

        return response()->json(['user' => $this->userPayload($user)]);
    }

    // DELETE /api/profile/signature
    public function removeSignature(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if ($user->signature_path) {
            $user->signature_path = null;
            $user->save();

            $this->logActivity('profile.signature_removed', 'Removed signature', $user->id, $user->office_id);
        }

        return response()->json(['user' => $this->userPayload($user)]);
    }

    // DELETE /api/profile/photo
    public function removePhoto(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        if ($user->profile_photo_path) {
            $user->profile_photo_path = null;
            $user->save();

            $this->logActivity('profile.photo_removed', 'Removed profile photo', $user->id, $user->office_id);
        }

        return response()->json(['user' => $this->userPayload($user)]);
    }

    // PATCH /api/profile/notification-preferences
    public function updateNotificationPreferences(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();

        $data = $request->validate([
            'email_doc_updates' => ['required', 'boolean'],
            'email_approvals'   => ['required', 'boolean'],
            'email_requests'    => ['required', 'boolean'],
        ]);

        $user->fill($data);
        $user->save();

        return response()->json([
            'email_doc_updates' => (bool) $user->email_doc_updates,
            'email_approvals'   => (bool) $user->email_approvals,
            'email_requests'    => (bool) $user->email_requests,
        ]);
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
            'signature_path'      => $user->signature_path,
            'signature_url'       => $user->signature_url,
            'role'                => strtolower($user->role?->name ?? ''),
            'office_id'           => $user->office_id,
            'office'              => $user->office ? [
                'id'   => $user->office->id,
                'name' => $user->office->name,
                'code' => $user->office->code,
            ] : null,
            'email_doc_updates'   => (bool) ($user->email_doc_updates ?? true),
            'email_approvals'     => (bool) ($user->email_approvals ?? true),
            'email_requests'      => (bool) ($user->email_requests ?? true),
        ];
    }
}
