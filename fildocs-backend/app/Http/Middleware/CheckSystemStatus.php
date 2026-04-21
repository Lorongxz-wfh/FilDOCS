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
        // Define critical routes that must ALWAYS be accessible (Auth & UI Status)
        // We check this FIRST to avoid any side-effects from $request->user() or DB lookups
        $isExempt = $request->is('api/login*') || 
                    $request->is('api/auth/logout') ||
                    $request->is('api/forgot-password') || 
                    $request->is('api/reset-password') ||
                    $request->is('api/system/maintenance') ||
                    $request->is('api/system/restore-status');

        if ($isExempt) {
            return $next($request);
        }

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

        // Hard Lock: Block everything except exemptions
        if ($mode === 'hard') {
            if ($isExempt) {
                return $next($request);
            }
            
            return response()->json([
                'message' => $message,
                'maintenance_mode' => 'hard',
                'force_logout' => $forceLogout || ($status->maintenance_mode === 'hard'),
                'expires_at' => $status->maintenance_expires_at ? $status->maintenance_expires_at->toIso8601String() : null
            ], 503);
        }

        // Soft Read-Only: Block mutations except for exemptions
        if ($mode === 'soft') {
            $isMutation = in_array($request->method(), ['POST', 'PUT', 'PATCH', 'DELETE']);
            
            if ($isMutation && !$isExempt) {
                return response()->json([
                    'message' => $message,
                    'maintenance_mode' => 'soft'
                ], 403);
            }
        }

        return $next($request);
    }
}
