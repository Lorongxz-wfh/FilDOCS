<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class OnboardingController extends Controller
{
    /**
     * Update the authenticated user's onboarding progress.
     */
    public function update(Request $request)
    {
        $request->validate([
            'progress' => 'required|array',
        ]);

        $user = Auth::user();
        $user->update([
            'onboarding_progress' => $request->progress,
        ]);

        return response()->json([
            'message' => 'Progress synced successfully.',
            'progress' => $user->onboarding_progress,
        ]);
    }
}
