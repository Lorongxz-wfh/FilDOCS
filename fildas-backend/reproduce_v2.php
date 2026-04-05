<?php

use App\Models\User;
use App\Http\Controllers\Api\DocumentRequestController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

// Force error reporting
error_reporting(E_ALL);
ini_set('display_errors', 1);

try {
    // Find a QA user
    $user = User::whereHas('role', function($q) { $q->where('name', 'qa'); })->first();
    if (!$user) {
        $user = User::whereHas('role', function($q) { $q->where('name', 'admin'); })->first();
    }
    
    if (!$user) {
        echo "No QA/Admin user found.\n";
        exit;
    }

    Auth::login($user);
    
    // Create a request object that mimics a real HTTP request
    $request = Request::create('/api/document-requests', 'GET', [
        'per_page' => 10,
        'page' => 1,
        'sort_by' => 'created_at',
        'sort_dir' => 'desc'
    ]);
    
    // Crucial: Set the user on the request manually since we aren't going through middleware
    $request->setUserResolver(fn() => $user);

    $controller = app(DocumentRequestController::class);
    $response = $controller->index($request);
    
    echo "Status: " . $response->getStatusCode() . "\n";
    echo "Content Preview: " . substr($response->getContent(), 0, 500) . "\n";

} catch (\Throwable $e) {
    echo "EXCEPTION: " . $e->getMessage() . "\n";
    echo "FILE: " . $e->getFile() . " (Line " . $e->getLine() . ")\n";
    echo $e->getTraceAsString() . "\n";
}
