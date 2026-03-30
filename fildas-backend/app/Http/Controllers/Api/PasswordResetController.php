<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Mail\PasswordResetMail;

class PasswordResetController extends Controller
{
    use LogsActivityTrait;

    /**
     * Send a password-reset link to the given email.
     */
    public function forgot(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
        ]);

        $email = $request->input('email');
        $user  = User::where('email', $email)->whereNull('deleted_at')->first();

        // Always return 200 to prevent email enumeration
        if (! $user) {
            return response()->json([
                'message' => 'If that email exists in our system, a reset link has been sent.',
            ]);
        }

        if ($user->disabled_at) {
            return response()->json([
                'message' => 'If that email exists in our system, a reset link has been sent.',
            ]);
        }

        // Check throttle
        $recent = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if ($recent && $recent->created_at) {
            $createdAt = \Carbon\Carbon::parse($recent->created_at);
            $throttle  = config('auth.passwords.users.throttle', 60);

            if ($createdAt->addSeconds($throttle)->isFuture()) {
                return response()->json([
                    'message' => 'A reset link was already sent recently. Please wait a moment before requesting another.',
                ], 429);
            }
        }

        // Generate token
        $token = Str::random(64);

        // Upsert into password_reset_tokens
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $email],
            ['token' => Hash::make($token), 'created_at' => now()],
        );

        // Build the reset URL — use the request Origin so the link always
        // matches the frontend the user is actually on (localhost vs production).
        $frontendUrl = rtrim(
            $request->header('Origin')
                ?: config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5173')),
            '/',
        );
        $resetUrl = $frontendUrl . '/reset-password?' . http_build_query([
            'token' => $token,
            'email' => $email,
        ]);

        $appUrl  = rtrim(config('app.url', 'http://localhost'), '/');
        $appName = config('app.name', 'FilDAS');

        Mail::to($email)->queue(new PasswordResetMail(
            recipientName:    $user->full_name,
            resetUrl:         $resetUrl,
            appUrl:           $appUrl,
            appName:          $appName,
            expiresInMinutes: config('auth.passwords.users.expire', 60),
        ));

        $this->logActivity('auth.password_reset_requested', 'Password reset requested', $user->id, $user->office_id, [
            'email' => $email,
        ]);

        return response()->json([
            'message' => 'If that email exists in our system, a reset link has been sent.',
        ]);
    }

    /**
     * Reset the user's password using a valid token.
     */
    public function reset(Request $request)
    {
        $request->validate([
            'token'    => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $email = $request->input('email');
        $token = $request->input('token');

        // Look up the token record
        $record = DB::table('password_reset_tokens')
            ->where('email', $email)
            ->first();

        if (! $record) {
            return response()->json([
                'message' => 'This password reset link is invalid.',
            ], 422);
        }

        // Verify token hash
        if (! Hash::check($token, $record->token)) {
            return response()->json([
                'message' => 'This password reset link is invalid.',
            ], 422);
        }

        // Check expiry
        $expireMinutes = config('auth.passwords.users.expire', 60);
        $createdAt     = \Carbon\Carbon::parse($record->created_at);

        if ($createdAt->addMinutes($expireMinutes)->isPast()) {
            DB::table('password_reset_tokens')->where('email', $email)->delete();

            return response()->json([
                'message' => 'This password reset link has expired. Please request a new one.',
            ], 422);
        }

        // Find user
        $user = User::where('email', $email)->whereNull('deleted_at')->first();

        if (! $user) {
            return response()->json([
                'message' => 'This password reset link is invalid.',
            ], 422);
        }

        // Update password
        $user->password = $request->input('password');
        $user->save();

        // Delete the used token
        DB::table('password_reset_tokens')->where('email', $email)->delete();

        // Revoke all existing Sanctum tokens (force re-login)
        $user->tokens()->delete();

        $this->logActivity('auth.password_reset', 'Password reset completed', $user->id, $user->office_id, [
            'email' => $email,
        ]);

        return response()->json([
            'message' => 'Your password has been reset successfully. You can now log in with your new password.',
        ]);
    }
}
