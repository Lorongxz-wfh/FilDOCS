<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use App\Models\User;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use App\Mail\TwoFactorChallengeMail;

class AuthController extends Controller
{
    use LogsActivityTrait;

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email'    => 'required|email',
            'password' => 'required|string',
        ]);

        $throttleKey = Str::lower($credentials['email']) . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 5)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            $this->logActivity('auth.throttled', 'Login throttled due to too many attempts', null, null, [
                'email' => $credentials['email'],
                'seconds' => $seconds
            ]);
            return response()->json([
                'message' => 'Too many login attempts. Please try again in ' . $seconds . ' seconds.',
                'retry_after' => $seconds,
            ], 429);
        }

        $user = User::with(['role', 'office'])
            ->where('email', $credentials['email'])
            ->whereNull('deleted_at')
            ->first();


        Log::info('Login debug', [
            'email_input' => $credentials['email'],
            'user_found' => !!$user,
            'user_id' => $user?->id,
            'user_email' => $user?->email,
            'password_match' => $user ? Hash::check($credentials['password'], $user->password) : false,
            'deleted_at' => $user?->deleted_at,
            'disabled_at' => $user?->disabled_at,
        ]);

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            RateLimiter::hit($throttleKey, 60);

            $this->logActivity('auth.login_failed', 'Failed login attempt', null, null, [
                'email'  => $credentials['email'],
                'reason' => ! $user ? 'user_not_found' : 'invalid_password',
            ]);
            return response()->json([
                'message' => 'Invalid credentials',
            ], 422);
        }

        RateLimiter::clear($throttleKey);


        if ($user->disabled_at) {
            return response()->json([
                'message' => 'Account is disabled.',
            ], 403);
        }

        // If 2FA is enabled and confirmed
        if ($user->two_factor_confirmed_at) {
            $challengeId = Str::random(60);
            // Store user_id in cache for 5 minutes
            \Illuminate\Support\Facades\Cache::put('2fa_challenge_' . $challengeId, $user->id, 300);

            return response()->json([
                'two_factor_required' => true,
                'challenge_id'        => $challengeId,
            ]);
        }

        if (!$user instanceof User) {
            return response()->json(['message' => 'Login failed.'], 422);
        }

        return $this->issueToken($user);
    }

    /**
     * Handle 2FA login challenge.
     */
    public function loginTwoFactor(Request $request)
    {
        $data = $request->validate([
            'challenge_id' => 'required|string',
            'code'         => 'nullable|string',
            'recovery_code' => 'nullable|string',
        ]);

        $throttleKey = '2fa:' . $data['challenge_id'] . '|' . $request->ip();

        if (RateLimiter::tooManyAttempts($throttleKey, 3)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json([
                'message' => 'Too many 2FA attempts. Please try again in ' . $seconds . ' seconds.',
                'retry_after' => $seconds,
            ], 429);
        }

        $userId = \Illuminate\Support\Facades\Cache::get('2fa_challenge_' . $data['challenge_id']);

        Log::info('2FA Challenge debug', [
            'challenge_id' => $data['challenge_id'] ?? 'MISSING',
            'has_cache' => !!($userId ?? null),
            'user_id' => $userId ?? null,
            'has_code' => !empty($data['code']),
            'has_recovery' => !empty($data['recovery_code']),
            'code_length' => strlen($data['code'] ?? ''),
        ]);

        if (!$userId) {
            Log::warning('2FA Session Expired', ['challenge_id' => $data['challenge_id']]);
            return response()->json(['message' => 'The 2FA session has expired.'], 422);
        }

        $user = User::with(['role', 'office'])->find($userId);
        if (!$user) {
            Log::error('2FA User Not Found', ['user_id' => $userId]);
            return response()->json(['message' => 'User not found.'], 422);
        }

        $valid = false;

        $recoveryCode = $data['recovery_code'] ?? null;
        $otpCode = $data['code'] ?? null;

        if ($recoveryCode) {
            // Check recovery codes
            $codes = json_decode(decrypt($user->two_factor_recovery_codes), true);
            foreach ($codes as $index => $code) {
                if ($code === $recoveryCode) {
                    unset($codes[$index]);
                    $user->two_factor_recovery_codes = encrypt(json_encode(array_values($codes)));
                    $user->save();
                    $valid = true;
                    break;
                }
            }
        } else if ($otpCode) {
            // 1. Try TOTP code
            $google2fa = new \PragmaRX\Google2FA\Google2FA();
            // Remove any spaces from code
            $cleanCode = str_replace(' ', '', $otpCode);
            
            // Standard window is 1 (30s before/after). Widen to 2 for robustness.
            $valid = $google2fa->verifyKey($user->two_factor_secret, $cleanCode, 2);
            
            Log::info('2FA TOTP verification result', [
                'user_id' => $user->id,
                'valid' => $valid,
                'secret_set' => filled($user->two_factor_secret),
                'input_code' => $cleanCode,
                'window' => 2
            ]);

            // 2. Fallback to Email OTP if TOTP fails (and code is 6 digits)
            if (!$valid && strlen($cleanCode) === 6) {
                $cachedCode = Cache::get('2fa_email_code_' . $data['challenge_id']);
                if ($cachedCode && (string)$cachedCode === (string)$cleanCode) {
                    Cache::forget('2fa_email_code_' . $data['challenge_id']);
                    $valid = true;
                    Log::info('2FA Email OTP fallback success', ['user_id' => $user->id]);
                }
            }
        }

        if (!$valid) {
            RateLimiter::hit($throttleKey, 300); // 5 minute penalty for 2FA fail
            return response()->json(['message' => 'Invalid verification code.'], 422);
        }

        RateLimiter::clear($throttleKey);

        if (!$user instanceof User) {
            Log::error('Invalid user object in 2FA logout', ['user_id' => $userId]);
            return response()->json(['message' => 'Internal server error.'], 500);
        }

        // Success - remove challenge and issue token
        \Illuminate\Support\Facades\Cache::forget('2fa_challenge_' . $data['challenge_id']);

        return $this->issueToken($user);
    }

    /**
     * Send 2FA code to email as a fallback.
     */
    public function sendTwoFactorEmailCode(Request $request)
    {
        $data = $request->validate([
            'challenge_id' => 'required|string',
        ]);

        $challengeKey = '2fa_challenge_' . $data['challenge_id'];
        $userId = Cache::get($challengeKey);
        
        if (!$userId) {
            return response()->json(['message' => 'The 2FA session has expired.'], 422);
        }

        $user = User::find($userId);
        if (!$user || !$user->email) {
            return response()->json(['message' => 'User not found or has no email address.'], 422);
        }

        $throttleKey = '2fa_email:' . $user->id;
        if (RateLimiter::tooManyAttempts($throttleKey, 2)) {
            $seconds = RateLimiter::availableIn($throttleKey);
            return response()->json(['message' => "Please wait {$seconds}s before requesting a new email code."], 429);
        }
        RateLimiter::hit($throttleKey, 60);

        // Generate 6-digit numeric code
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        
        // Cache code for 5 minutes linked to challenge_id
        Cache::put('2fa_email_code_' . $data['challenge_id'], $code, 300);

        try {
            Mail::to($user->email)->send(new TwoFactorChallengeMail($user->full_name, $code));
            
            $this->logActivity('auth.2fa_email_sent', 'Requested 2FA code via email', $user->id, $user->office_id);

            return response()->json(['message' => 'Verification code sent to your email.']);
        } catch (\Exception $e) {
            Log::error('Failed to send 2FA email code', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Failed to send email. Please try again later.'], 500);
        }
    }

    private function issueToken(\App\Models\User $user)
    {
        $tokenInstance = $user->createToken('api-token');
        $token = $tokenInstance->plainTextToken;

        // Save IP and User Agent to the token record
        $tokenInstance->accessToken->forceFill([
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ])->save();

        $roleName = $user->role ? strtolower(trim($user->role->name)) : null;

        if (!$roleName) {
            return response()->json([
                'message' => 'User has no role assigned.',
            ], 403);
        }

        $this->logActivity('auth.login', 'Logged in', $user->id, $user->office_id, ['role' => $roleName]);

        return response()->json([
            'token' => $token,
            'user'  => [
                'id'                 => $user->id,
                'full_name'          => $user->full_name,
                'first_name'         => $user->first_name,
                'middle_name'        => $user->middle_name,
                'last_name'          => $user->last_name,
                'suffix'             => $user->suffix,
                'profile_photo_path' => $user->profile_photo_path,
                'profile_photo_url'  => $user->profile_photo_url,
                'signature_url'      => $user->signature_url,
                'email'              => $user->email,
                'role'               => $roleName,
                'office'             => $user->office ? [
                    'id'   => $user->office->id,
                    'name' => $user->office->name,
                    'code' => $user->office->code,
                ] : null,
                'office_id'          => $user->office_id,
                'two_factor_enabled' => $user->two_factor_enabled,
            ],
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();
        $reason = $request->input('reason', 'manual'); // default to manual

        $this->logActivity('auth.logout', 'Logged out', $user->id, $user->office_id, [
            'reason' => $reason
        ]);

        $user->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out',
        ]);
    }
}
