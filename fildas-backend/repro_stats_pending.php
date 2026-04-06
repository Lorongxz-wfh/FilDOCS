<?php

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\WorkflowTask;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;

$user = User::where('office_id', '!=', null)->first(); 
if (!$user) {
    echo "No user found\n";
    exit;
}

$userOfficeId = $user->office_id;
$roleName = 'office_staff'; // Simulate a role

echo "Testing pending query for userOfficeId: $userOfficeId\n";

try {
    $pending = (int) (WorkflowTask::query()
        ->where('workflow_tasks.status', 'open')
        ->where('workflow_tasks.assigned_office_id', $userOfficeId)
        ->join('document_versions', 'workflow_tasks.document_version_id', '=', 'document_versions.id')
        ->join('documents', 'document_versions.document_id', '=', 'documents.id')
        ->joinSub(
            DocumentVersion::query()
                ->selectRaw('document_id, MAX(version_number) as max_version_number')
                ->groupBy('document_id'),
            'dv_max',
            function ($join) {
                $join->on('dv_max.document_id', '=', 'document_versions.document_id')
                    ->on('dv_max.max_version_number', '=', 'document_versions.version_number');
            }
        )
        ->selectRaw('COUNT(DISTINCT documents.id) as cnt')
        ->value('cnt') ?? 0);
    echo "Pending items: $pending\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
