<?php

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\WorkflowTask;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

$user = User::first(); // Assuming a user exists
if (!$user) {
    echo "No user found\n";
    exit;
}

$date_from = '2026-04-05';
$date_to = '2026-04-05';

$userOfficeId = $user->office_id;

$qaOfficeId = Cache::remember('office_id:QA', 3600, function () {
    return \App\Models\Office::where('code', 'QA')->value('id');
});

$visibleDocs = Document::query();

// Simple simulation of stats logic
if ($qaOfficeId && (int) $userOfficeId !== (int) $qaOfficeId) {
    $visibleDocs->whereHas('latestVersion', function ($v) use ($userOfficeId) {
        $v->whereHas('tasks', function ($t) use ($userOfficeId) {
            $t->where('status', 'open')
                ->where('assigned_office_id', $userOfficeId);
        });
    });
}

// Apply date filters if provided
if (!empty($date_from)) {
    $visibleDocs->where('created_at', '>=', $date_from);
}
if (!empty($date_to)) {
    $visibleDocs->where('created_at', '<=', $date_to);
}

try {
    $total = (clone $visibleDocs)->count();
    echo "Total: $total\n";

    $distributed = (clone $visibleDocs)->whereHas('latestVersion', function ($v) use ($date_from, $date_to) {
        $v->where('status', 'Distributed');
        if (!empty($date_from)) {
            $v->where('distributed_at', '>=', $date_from);
        }
        if (!empty($date_to)) {
            $v->where('distributed_at', '<=', $date_to);
        }
    })->count();
    echo "Distributed: $distributed\n";

} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
