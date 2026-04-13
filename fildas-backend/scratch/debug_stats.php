<?php

use App\Models\Document;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$df = '2026-04-13';
$dt = '2026-04-13';

try {
    $visibleDocsQuery = Document::query();
    
    // Simulate the query in the controller
    $stats = $visibleDocsQuery
        ->leftJoin('document_versions as lv', 'lv.id', '=', 'documents.latest_version_id')
        ->selectRaw("
            COUNT(CASE 
                WHEN (documents.created_at >= ? OR ? IS NULL) 
                AND (documents.created_at <= ? OR ? IS NULL) 
                THEN 1 END) as total,
            COUNT(CASE 
                WHEN lv.status = 'Distributed' 
                AND (lv.distributed_at >= ? OR ? IS NULL) 
                AND (lv.distributed_at <= ? OR ? IS NULL) 
                THEN 1 END) as distributed_count,
            COUNT(CASE 
                WHEN lv.status IN ('Draft', 'Office Draft') 
                AND (documents.created_at >= ? OR ? IS NULL) 
                AND (documents.created_at <= ? OR ? IS NULL) 
                THEN 1 END) as draft_count,
            COUNT(CASE 
                WHEN (LOWER(lv.status) LIKE '%review%' OR LOWER(lv.status) LIKE '%check%') 
                AND (documents.created_at >= ? OR ? IS NULL) 
                AND (documents.created_at <= ? OR ? IS NULL) 
                THEN 1 END) as review_count,
            COUNT(CASE 
                WHEN (LOWER(lv.status) LIKE '%approval%') 
                AND (documents.created_at >= ? OR ? IS NULL) 
                AND (documents.created_at <= ? OR ? IS NULL) 
                THEN 1 END) as approval_count,
            COUNT(CASE 
                WHEN (LOWER(lv.status) LIKE '%registration%' OR LOWER(lv.status) LIKE '%distribution%') 
                AND (documents.created_at >= ? OR ? IS NULL) 
                AND (documents.created_at <= ? OR ? IS NULL) 
                THEN 1 END) as finalization_count
        ", [
            $df, $df, $dt, $dt, // total
            $df, $df, $dt, $dt, // distributed
            $df, $df, $dt, $dt, // draft
            $df, $df, $dt, $dt, // review
            $df, $df, $dt, $dt, // approval
            $df, $df, $dt, $dt, // finalization
        ])
        ->first();

    echo "Stats: " . json_encode($stats) . "\n";
} catch (\Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Trace: " . $e->getTraceAsString() . "\n";
}
