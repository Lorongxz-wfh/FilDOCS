<?php

use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Http\Controllers\Api\DocumentRequestController;
use Illuminate\Http\Request;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';

$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$user = User::whereHas('role', function($q) { $q->where('name', 'Admin'); })->first();

if (!$user) {
    echo "No admin user found.\n";
    exit(1);
}

$controller = new DocumentRequestController();
$request = new Request();
$request->setUserResolver(fn() => $user);

$response = $controller->activeOffices($request);

echo "STATUS: " . $response->status() . "\n";
echo "DATA: " . json_encode($response->getData(), JSON_PRETTY_PRINT) . "\n";
