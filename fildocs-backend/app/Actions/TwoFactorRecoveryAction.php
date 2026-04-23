<?php

namespace App\Actions;

use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class TwoFactorRecoveryAction
{
    /**
     * Generate 10 secure, one-time-use recovery codes for the user.
     */
    public function generate(User $user): void
    {
        $codes = Collection::times(10, fn() => Str::random(10) . '-' . Str::random(10))
            ->map(fn($code) => encrypt($code))
            ->all();

        $user->forceFill([
            'two_factor_recovery_codes' => $codes,
        ])->save();
    }

    /**
     * Decrypt and return the recovery codes for viewing.
     */
    public function view(User $user): array
    {
        return collect($user->two_factor_recovery_codes ?? [])
            ->map(function ($code) {
                try {
                    return decrypt($code);
                } catch (\Throwable) {
                    return null;
                }
            })
            ->filter()
            ->all();
    }
}
