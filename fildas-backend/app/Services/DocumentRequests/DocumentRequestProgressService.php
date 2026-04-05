<?php

namespace App\Services\DocumentRequests;

use Illuminate\Support\Facades\DB;

class DocumentRequestProgressService
{
    /**
     * Calculate progress totals for a document request.
     *
     * Returns an array with keys: total, submitted, accepted.
     */
    public function buildProgress(int $requestId, ?string $mode = 'multi_office'): array
    {
        $requestId = (int) $requestId;
        $mode = $mode ?: 'multi_office';

        if ($mode === 'multi_office') {
            $recipients = DB::table('document_request_recipients')
                ->where('request_id', $requestId)
                ->get(['id', 'status']);

            $total     = $recipients->count();
            $submitted = $recipients->whereIn('status', ['submitted', 'accepted', 'rejected'])->count();
            $accepted  = $recipients->where('status', 'accepted')->count();

            return compact('total', 'submitted', 'accepted');
        }

        // multi_doc — progress is per item
        $items = DB::table('document_request_items')
            ->where('request_id', $requestId)
            ->get(['id']);

        $total = $items->count();

        // For multi_doc there's 1 recipient — get their id
        $recipient = DB::table('document_request_recipients')
            ->where('request_id', $requestId)
            ->first(['id']);

        if (!$recipient) return ['total' => $total, 'submitted' => 0, 'accepted' => 0];

        $itemIds = $items->pluck('id')->all();

        // Latest submission per item for this recipient
        $latestStatuses = DB::table('document_request_submissions as s')
            ->whereIn('s.item_id', $itemIds)
            ->where('s.recipient_id', $recipient->id)
            ->orderByDesc('s.attempt_no')
            ->get(['s.item_id', 's.status'])
            ->unique('item_id');

        $submitted = $latestStatuses->whereIn('status', ['submitted', 'accepted', 'rejected'])->count();
        $accepted  = $latestStatuses->where('status', 'accepted')->count();

        return compact('total', 'submitted', 'accepted');
    }
}
