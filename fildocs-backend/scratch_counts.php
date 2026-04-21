<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

// logic for space=library from DocumentIndexService
$distCount = DB::table('documents')
    ->whereNull('archived_at')
    ->whereExists(function ($query) {
        $query->select(DB::raw(1))
            ->from('document_versions as v1')
            ->whereColumn('v1.id', 'documents.latest_version_id')
            ->whereNotIn('v1.status', ['Cancelled', 'Superseded']);
    })
    ->whereExists(function ($query) {
        $query->select(DB::raw(1))
            ->from('document_versions as v2')
            ->whereColumn('v2.document_id', 'documents.id')
            ->where('v2.status', 'Distributed');
    })
    ->count();

// Logic for accepted requests from DocumentRequestRepository (simplified)
// q1: multi_office recipients
$q1Cnt = DB::table('document_request_recipients as rr')
    ->join('document_requests as r', 'r.id', '=', 'rr.request_id')
    ->where('r.mode', 'multi_office')
    ->where('rr.status', 'accepted')
    ->count();

// q2: multi_doc items
// In multi_doc, item_status is: COALESCE((SELECT s.status FROM document_request_submissions s WHERE s.item_id = dri.id AND s.recipient_id = rr.id ORDER BY s.attempt_no DESC LIMIT 1), rr.status)
$q2Cnt = DB::table('document_request_items as dri')
    ->join('document_requests as r', 'r.id', '=', 'dri.request_id')
    ->join('document_request_recipients as rr', 'rr.request_id', '=', 'r.id')
    ->where('r.mode', 'multi_doc')
    ->where(function($q) {
        $q->whereExists(function($sub) {
            $sub->select('status')
                ->from('document_request_submissions as s')
                ->whereColumn('s.item_id', 'dri.id')
                ->whereColumn('s.recipient_id', 'rr.id')
                ->where('s.status', 'accepted')
                ->orderByDesc('s.attempt_no')
                ->limit(1);
        })
        ->orWhere(function($sub) {
            // No submission yet, so fall back to recipient status (unlikely for "accepted" but for completeness)
            $sub->whereNotExists(function($ss) {
                $ss->select(DB::raw(1))->from('document_request_submissions as s2')->whereColumn('s2.item_id', 'dri.id')->whereColumn('s2.recipient_id', 'rr.id');
            })
            ->where('rr.status', 'accepted');
        });
    })
    ->count();

echo "Distributed Documents (Library): " . $distCount . "\n";
echo "Accepted Requests (Library): " . ($q1Cnt + $q2Cnt) . "\n";
echo "Total in 'All' Tab: " . ($distCount + $q1Cnt + $q2Cnt) . "\n";
