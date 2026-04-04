<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;



return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        channels: __DIR__ . '/../routes/channels.php',
        health: '/up',
    )
    ->withBroadcasting(
        '/api/broadcasting/auth',
        ['middleware' => ['auth:sanctum']],
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'admin' => \App\Http\Middleware\Admin::class,
        ]);

        $middleware->api(append: [
            \App\Http\Middleware\CheckSystemStatus::class,
        ]);

        // Trust proxies for Render/Vercel (required for correct protocol/IP detection)
        $middleware->trustProxies(at: '*');
    })


    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
