<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Laravel\Sanctum\PersonalAccessToken;

class SessionController extends Controller
{
    /**
     * List all active sessions for the user.
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $sessions = $user->tokens()
            ->orderBy('last_used_at', 'desc')
            ->get()
            ->map(function ($token) use ($currentTokenId) {
                return [
                    'id' => $token->id,
                    'ip_address' => $token->ip_address,
                    'user_agent' => $token->user_agent,
                    'last_used_at' => $token->last_used_at,
                    'created_at' => $token->created_at,
                    'is_current' => $token->id === $currentTokenId,
                ];
            });

        return response()->json($sessions);
    }

    /**
     * Revoke a specific session.
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $token = $user->tokens()->where('id', $id)->first();

        if (!$token) {
            return response()->json(['message' => 'Session not found.'], 404);
        }

        $token->delete();

        return response()->json(['message' => 'Session revoked successfully.']);
    }

    /**
     * Revoke all other sessions except the current one.
     */
    public function revokeOthers(Request $request)
    {
        $user = $request->user();
        $currentTokenId = $user->currentAccessToken()->id;

        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => 'All other sessions revoked successfully.']);
    }

    /**
     * ADMIN: List all active sessions in the system.
     */
    public function adminIndex(Request $request)
    {
        $sessions = PersonalAccessToken::with('tokenable.office')
            ->orderBy('last_used_at', 'desc')
            ->get()
            ->map(function ($token) {
                return [
                    'id' => $token->id,
                    'user' => $token->tokenable,
                    'ip_address' => $token->ip_address,
                    'user_agent' => $token->user_agent,
                    'last_used_at' => $token->last_used_at,
                    'created_at' => $token->created_at,
                ];
            });

        return response()->json($sessions);
    }

    /**
     * ADMIN: Revoke any specific session.
     */
    public function adminDestroy(Request $request, $id)
    {
        PersonalAccessToken::where('id', $id)->delete();
        return response()->json(['message' => 'Session terminated by administrator.']);
    }

    /**
     * ADMIN: Get activity logs for a specific session.
     */
    public function adminSessionActivity(Request $request, $id)
    {
        $logs = \App\Models\ActivityLog::with(['document', 'version'])
            ->where('personal_access_token_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($logs);
    }
}
