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
echo "Testing new pending query for userOfficeId: $userOfficeId\n";

try {
    $pending = (int) WorkflowTask::query()
        ->where('workflow_tasks.status', 'open')
        ->where('workflow_tasks.assigned_office_id', $userOfficeId)
        ->whereIn('workflow_tasks.document_version_id', function ($query) {
            $query->select('id')
                ->from('document_versions')
                ->whereIn('version_number', function ($sq) {
                    $sq->selectRaw('MAX(version_number)')
                        ->from('document_versions as dv2')
                        ->whereColumn('dv2.document_id', 'document_versions.document_id');
                });
        })
        ->count();
    echo "Pending items (new logic): $pending\n";
} catch (\Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
