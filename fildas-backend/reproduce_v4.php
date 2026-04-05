<?php

use App\Models\User;
use App\Models\Office;
use App\Http\Controllers\Api\DocumentRequestController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

try {
    DB::enableQueryLog();

    $user = User::whereHas('role', function($q) { $q->where('name', 'admin'); })->first();
    if (!$user) $user = User::first();
    
    Auth::login($user);
    $request = new Request([
        'per_page' => 10,
        'page' => 1,
        'direction' => 'incoming',
        'sort_by' => 'created_at',
        'sort_dir' => 'desc'
    ]);
    $request->setUserResolver(fn() => $user);

    $controller = app(DocumentRequestController::class);
    $response = $controller->index($request);
    
    echo "STATUS: " . $response->getStatusCode() . "\n";
    if ($response->getStatusCode() !== 200) {
        echo "BODY: " . $response->getContent() . "\n";
    }

    $queries = DB::getQueryLog();
    foreach ($queries as $q) {
        echo "SQL: " . $q['query'] . " [" . implode(',', $q['bindings']) . "]\n";
    }

} catch (\Throwable $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "FILE: " . $e->getFile() . " LINE: " . $e->getLine() . "\n";
    
    $queries = DB::getQueryLog();
    foreach ($queries as $q) {
        echo "SQL: " . $q['query'] . " [" . implode(',', $q['bindings']) . "]\n";
    }
}
