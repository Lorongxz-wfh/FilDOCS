<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\Document;
use Illuminate\Support\Facades\DB;

// Fetch any user whose role is QA to test the logic
$users = User::all();
$qaUser = null;
foreach($users as $u) {
    $role = strtolower($u->role?->name ?? '');
    if ($role === 'qa') {
        $qaUser = $u;
        break;
    }
}

if (!$qaUser) {
    echo "No QA user found. Testing with first user.\n";
    $qaUser = User::first();
}

$u = $qaUser;
$officeId = $u->office_id;
$role = strtolower($u->role?->name ?? 'unknown');

echo "Testing for User: " . $u->email . " (Office: " . $officeId . ", Role: " . $role . ")\n\n";

function getDocCount($user, $scope) {
    $service = new \App\Services\DocumentIndexService();
    $query = Document::query();
    
    // Space: library
    $query->whereNull('documents.archived_at')
        ->whereHas('latestVersion', function ($v) {
            $v->whereNotIn('status', ['Cancelled', 'Superseded']);
        })
        ->whereHas('versions', function ($v) {
            $v->where('status', 'Distributed');
        });

    $data = ['scope' => $scope, 'space' => 'library'];
    
    if ($scope === 'owned') {
        $query->where('owner_office_id', $user->office_id);
    } elseif ($scope === 'shared') {
        $query->whereHas('sharedOffices', fn($s) => $s->where('offices.id', $user->office_id));
    }
    
    $query = $service->applyVisibility($query, $user);
    
    return $query->count();
}

$owned = getDocCount($u, 'owned');
$shared = getDocCount($u, 'shared');
$all = getDocCount($u, 'all');

$reqCount = DB::table('document_request_recipients')
    ->where('status', 'accepted')
    ->where('office_id', $officeId)
    ->count();

echo "1. Created Tab Count: " . $owned . "\n";
echo "2. Shared with Me Count: " . $shared . "\n";
echo "3. Requested (Accepted) Count: " . $reqCount . "\n";
echo "------------------------------------\n";
echo "Sum of individual tabs: " . ($owned + $shared + $reqCount) . "\n";
echo "Actual 'All Documents' Result: " . ($all + $reqCount) . "\n";
echo "Extra visibility items: " . ($all - ($owned + $shared)) . "\n\n";

if (($all - ($owned + $shared)) > 0) {
   echo "Explanation: Because your role is " . strtoupper($role) . ", you have institutional visibility.\n";
   echo "The 'All' tab shows everything you can see, which includes documents from other offices that aren't specifically shared with you.\n";
}
