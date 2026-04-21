<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;

class UpdateLastActive
{
    // Only stamp once per minute per user to avoid hammering the DB on every request
    private const THROTTLE_SECONDS = 60;

    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user) {
            $cacheKey = "last_active_stamped:{$user->id}";

            if (!Cache::has($cacheKey)) {
                $user->timestamps = false;
                $user->last_active_at = now();
                $user->save();

                Cache::put($cacheKey, true, self::THROTTLE_SECONDS);
            }
        }

        return $next($request);
    }
}
