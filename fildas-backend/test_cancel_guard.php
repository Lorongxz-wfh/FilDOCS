<?php
use Illuminate\Support\Facades\DB;

$requestId = 3; // The request from user's screenshot
// Force an accepted recipient for testing
DB::table('document_request_recipients')->where('request_id', $requestId)->limit(1)->update(['status' => 'accepted']);

$controller = app(\App\Http\Controllers\Api\DocumentRequestController::class);
$request = new \Illuminate\Http\Request();
$request->replace(['status' => 'cancelled', 'reason' => 'Testing guard']);
$reqRow = DB::table('document_requests')->where('id', $requestId)->first();
$user = \App\Models\User::find($reqRow->created_by_user_id) ?? \App\Models\User::first();
auth()->login($user);

try {
    $response = $controller->updateStatus($request, $requestId);
    echo "Response status: " . $response->getStatusCode() . "\n";
    echo "Response body: " . $response->getContent() . "\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
