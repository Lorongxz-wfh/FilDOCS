<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Models\SystemStatus;
use Carbon\Carbon;

class CheckSystemStatus
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $status = SystemStatus::first();
        if (!$status) {
            return $next($request);
        }

        $user = $request->user();
        $isAdmin = false;
        
        if ($user && $user->role) {
            $roleName = strtolower(trim($user->role->name));
            $isAdmin = in_array($roleName, ['admin', 'sysadmin']);
        }

        // Admins bypass maintenance
        if ($isAdmin) {
            return $next($request);
        }

        $mode = $status->maintenance_mode;
        $message = $status->maintenance_message ?? 'System is currently under maintenance.';
        $forceLogout = false;

        // Check scheduling
        if ($status->maintenance_starts_at) {
            $now = now();
            $startsAt = Carbon::parse($status->maintenance_starts_at);

            if ($now->greaterThanOrEqualTo($startsAt)) {
                // Timer reached: Use the saved mode and logout only if hard mode
                $mode = $status->maintenance_mode;
                $forceLogout = ($mode === 'hard');
            } else {
                // Countdown in progress: Force SOFT mode (grace period)
                // This prevents users from starting new work during the countdown
                $mode = 'soft';
                $message = "Scheduled maintenance starts in " . $now->diffInMinutes($startsAt) . " minutes. Please save your work.";
            }
        }

        // Hard Lock: Block everything
        if ($mode === 'hard') {
            // Allow only logout for everyone
            if ($request->is('api/auth/logout')) {
                return $next($request);
            }
            
            return response()->json([
                'message' => $message,
                'maintenance_mode' => 'hard',
                'force_logout' => $forceLogout || ($status->maintenance_mode === 'hard'),
                'expires_at' => $status->maintenance_expires_at ? $status->maintenance_expires_at->toIso8601String() : null
            ], 503);
        }

        // Soft Read-Only: Block mutations
        if ($mode === 'soft') {
            $isMutation = in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE']);
            
            // Allow login/logout even in soft mode
            $isAuth = $request->is('api/auth/*');

            if ($isMutation && !$isAuth) {
                return response()->json([
                    'message' => $message,
                    'maintenance_mode' => 'soft'
                ], 403);
            }
        }

        return $next($request);
    }
}
