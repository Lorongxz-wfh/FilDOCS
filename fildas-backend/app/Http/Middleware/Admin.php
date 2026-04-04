<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class Admin
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || $user->role_id === null) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        if ($user->deleted_at || $user->disabled_at) {
            return response()->json(['message' => 'Account is disabled.'], 403);
        }


        $role = $user->role;
        if (! $role || ! in_array(strtolower(trim($role->name)), ['admin', 'sysadmin'])) {
            return response()->json(['message' => 'Admin access required.'], 403);
        }

        return $next($request);
    }
}
