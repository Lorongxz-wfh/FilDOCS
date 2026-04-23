<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Traits\LogsActivityTrait;
use App\Models\Notification;
use App\Mail\WorkflowNotificationMail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use PragmaRX\Google2FALaravel\Support\Authenticator;
use PragmaRX\Google2FA\Google2FA;
use Illuminate\Support\Str;
use App\Actions\TwoFactorRecoveryAction;

class TwoFactorController extends Controller
{
    use LogsActivityTrait;

    protected $google2fa;
    protected $recovery;

    public function __construct(TwoFactorRecoveryAction $recovery)
    {
        $this->google2fa = new Google2FA();
        $this->recovery = $recovery;
    }

    /**
     * Start 2FA setup: generate secret and QR code.
     */
    public function setup(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        // If already confirmed, don't allow re-setup without disabling first
        if ($user->two_factor_confirmed_at) {
            return response()->json(['message' => '2FA is already enabled. Provide password to disable first.'], 400);
        }

        // Generate a new secret if not already in session/scratch
        $secret = $this->google2fa->generateSecretKey();
        
        // We'll return the secret and the SVG/URL for the QR
        $qrUrl = $this->google2fa->getQRCodeUrl(
            config('app.name'),
            $user->email,
            $secret
        );

        // Use a more reliable QR code generator API (QRServer)
        $qrImage = "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" . urlencode($qrUrl);

        return response()->json([
            'secret' => $secret,
            'qr_image' => $qrImage,
            'qr_url' => $qrUrl
        ]);
    }

    /**
     * Confirm 2FA setup with a code.
     */
    public function confirm(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'secret' => 'required|string',
            'code' => 'required|string|size:6',
        ]);

        $valid = $this->google2fa->verifyKey($request->secret, $request->code);

        if (!$valid) {
            return response()->json(['message' => 'Invalid verification code.'], 422);
        }

        // Save secret and generate recovery codes
        $user->two_factor_secret = $request->secret;
        $user->two_factor_confirmed_at = now();
        $user->save();

        $this->recovery->generate($user);
        $cleanCodes = $this->recovery->view($user);

        $this->logActivity('auth.2fa_enabled', 'Enabled Two-Factor Authentication', $user->id, $user->office_id);

        // Notify user
        Notification::create([
            'user_id' => $user->id,
            'event'   => 'auth.2fa_enabled',
            'title'   => 'Two-Factor Authentication Enabled',
            'body'    => 'You have successfully secured your account with 2FA. Remember to keep your recovery codes safe.',
            'meta'    => ['type' => 'security']
        ]);

        if ($user->email) {
            try {
                $appUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
                $appName = config('app.name', 'FilDOCS');
                Mail::to($user->email)->queue(new WorkflowNotificationMail(
                    recipientName: $user->full_name,
                    notifTitle: '2FA Enabled',
                    notifBody: 'Two-factor authentication has been successfully enabled for your ' . $appName . ' account.',
                    documentTitle: 'Account Security',
                    documentStatus: '2FA Active',
                    isReject: false,
                    actorName: $user->full_name,
                    documentId: null,
                    appUrl: $appUrl,
                    appName: $appName,
                    cardLabel: 'Security'
                ));
            } catch (\Throwable $e) {}
        }

        return response()->json([
            'message' => 'Two-factor authentication enabled successfully.',
            'recovery_codes' => $cleanCodes
        ]);
    }

    /**
     * Disable 2FA.
     */
    public function disable(Request $request)
    {
        /** @var User $user */
        $user = $request->user();

        $request->validate([
            'password' => 'required|string',
            'code' => 'nullable|string|size:6',
            'recovery_code' => 'nullable|string',
        ]);

        if (!Hash::check($request->password, $user->password)) {
            return response()->json(['message' => 'Incorrect password.'], 422);
        }

        // Must provide 2FA code if it's already confirmed
        if ($user->two_factor_confirmed_at) {
            $valid = false;
            
            if ($request->recovery_code) {
                // Check recovery codes
                $codes = $this->recovery->view($user);
                foreach ($codes as $index => $code) {
                    if ($code === $request->recovery_code) {
                        $remaining = collect($codes)->except($index)->map(fn($c) => encrypt($c))->all();
                        $user->two_factor_recovery_codes = $remaining;
                        // We don't save yet, we'll save at the end when resetting everything
                        $valid = true;
                        break;
                    }
                }
            } else if ($request->code) {
                // Check TOTP code
                $valid = $this->google2fa->verifyKey($user->two_factor_secret, $request->code);
            } else {
                return response()->json(['message' => 'Verification code is required to disable 2FA.'], 422);
            }

            if (!$valid) {
                return response()->json(['message' => 'Invalid verification code.'], 422);
            }
        }

        $user->two_factor_secret = null;
        $user->two_factor_recovery_codes = null;
        $user->two_factor_confirmed_at = null;
        $user->save();

        $this->logActivity('auth.2fa_disabled', 'Disabled Two-Factor Authentication', $user->id, $user->office_id);

        // Notify user
        Notification::create([
            'user_id' => $user->id,
            'event'   => 'auth.2fa_disabled',
            'title'   => 'Two-Factor Authentication Disabled',
            'body'    => 'Warning: Two-factor authentication has been disabled for your account. It is now less secure.',
            'meta'    => ['type' => 'security_alert']
        ]);

        if ($user->email) {
            try {
                $appUrl = rtrim(env('FRONTEND_URL', config('app.url')), '/');
                $appName = config('app.name', 'FilDOCS');
                Mail::to($user->email)->queue(new WorkflowNotificationMail(
                    recipientName: $user->full_name,
                    notifTitle: '2FA Disabled (Warning)',
                    notifBody: 'Two-factor authentication has been disabled for your account. If you did not do this, please contact your administrator immediately.',
                    documentTitle: 'Account Security',
                    documentStatus: '2FA Disabled',
                    isReject: true,
                    actorName: $user->full_name,
                    documentId: null,
                    appUrl: $appUrl,
                    appName: $appName,
                    cardLabel: 'Critical'
                ));
            } catch (\Throwable $e) {}
        }

        return response()->json(['message' => 'Two-factor authentication disabled.']);
    }

    /**
     * Get or regenerate recovery codes.
     */
    public function getRecoveryCodes(Request $request)
    {
         /** @var User $user */
         $user = $request->user();

         if (!$user->two_factor_confirmed_at) {
             return response()->json(['message' => '2FA not enabled.'], 400);
         }

         $request->validate(['password' => 'required|string']);
         if (!Hash::check($request->password, $user->password)) {
             return response()->json(['message' => 'Incorrect password.'], 422);
         }

         $codes = $this->recovery->view($user);

         $this->logActivity('auth.recovery_viewed', 'Viewed 2FA recovery codes', $user->id, $user->office_id);

         return response()->json(['recovery_codes' => $codes]);
    }

    /**
     * Regenerate recovery codes.
     */
    public function regenerateRecoveryCodes(Request $request)
    {
         /** @var User $user */
         $user = $request->user();

         if (!$user->two_factor_confirmed_at) {
             return response()->json(['message' => '2FA not enabled.'], 400);
         }

         $request->validate(['password' => 'required|string']);
         if (!Hash::check($request->password, $user->password)) {
             return response()->json(['message' => 'Incorrect password.'], 422);
         }

         $this->recovery->generate($user);
         $codes = $this->recovery->view($user);

         $this->logActivity('auth.recovery_regenerated', 'Regenerated 2FA recovery codes', $user->id, $user->office_id);

         return response()->json([
             'message' => 'New recovery codes generated.',
             'recovery_codes' => $codes
         ]);
    }
}
