<?php

namespace App\Repositories;

use Illuminate\Support\Facades\DB;

class DocumentRequestRepository
{
    /**
     * Get a unified list of individual document requests (multi_office recipients & multi_doc items).
     */
    public function getIndividualRequests(array $filters, int $perPage, int $page, bool $isQa, int $officeId, int $userId): array
    {
        $offset    = ($page - 1) * $perPage;
        $term      = !empty($filters['q']) ? trim($filters['q']) : null;
        $direction = $filters['direction'] ?? null;
        $reqSt     = $filters['request_status'] ?? null;
        $status    = $filters['status'] ?? null;
        $fOfficeId = $filters['office_id'] ?? null;
        $batchType = $filters['batch_type'] ?? null;

        // ── Sub-query A: multi_office recipients ──────────────────────────
        $q1 = DB::table('document_request_recipients as rr')
            ->join('document_requests as r', 'r.id', '=', 'rr.request_id')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            // Join with creator's office
            ->leftJoin('users as u_cre', 'u_cre.id', '=', 'r.created_by_user_id')
            ->leftJoin('offices as o_cre', 'o_cre.id', '=', 'u_cre.office_id')
            ->where('r.mode', 'multi_office')
            ->select([
                DB::raw("'recipient' as row_type"),
                'rr.id as row_id',
                'r.id as request_id',
                'r.title as batch_title',
                'r.mode as batch_mode',
                'r.status as batch_status',
                DB::raw('COALESCE(rr.due_at, r.due_at) as due_at'),
                'rr.created_at',
                'rr.status as item_status',
                // Directional office logic (null-safe creator office)
                DB::raw("CASE WHEN r.created_by_user_id = {$userId} THEN o.name ELSE COALESCE(o_cre.name, 'Admin / System') END as office_name"),
                DB::raw("CASE WHEN r.created_by_user_id = {$userId} THEN o.code ELSE COALESCE(o_cre.code, 'N/A') END as office_code"),
                DB::raw('NULL as item_title'),
                'rr.id as recipient_id',
                DB::raw('NULL as item_id'),
                'rr.office_id',
                DB::raw("CASE WHEN r.created_by_user_id = {$userId} THEN 'outgoing' ELSE 'incoming' END as direction"),
                DB::raw("CASE 
                    WHEN r.created_by_user_id = {$userId} THEN 
                        (SELECT COUNT(*) FROM document_request_recipients rr_act WHERE rr_act.request_id = r.id AND rr_act.status = 'submitted') > 0
                    ELSE 
                        rr.status IN ('pending', 'rejected')
                END as can_act")
            ]);

        if (!$isQa) {
            $q1->where(function($qq) use ($officeId, $userId) {
                $qq->where('rr.office_id', $officeId)
                   ->orWhere('r.created_by_user_id', $userId);
            });
        }

        if ($direction === 'incoming') {
            if (!$isQa) {
                $q1->where('rr.office_id', $officeId);
            }
            $q1->where('r.created_by_user_id', '!=', $userId);
        } elseif ($direction === 'outgoing') {
            $q1->where('r.created_by_user_id', $userId);
        }
        if ($term)  $q1->where(function ($qq) use ($term) {
            $qq->where('r.title', 'like', "%{$term}%")
               ->orWhere('r.description', 'like', "%{$term}%");
            if (is_numeric($term)) {
                $qq->orWhere('r.id', (int)$term);
            }
        });
        if ($fOfficeId) {
            $q1->where(function($qq) use ($fOfficeId, $userId, $isQa) {
                if ($isQa) {
                    // Privileged: see everything related to this office
                    $qq->where('rr.office_id', $fOfficeId)
                       ->orWhere('u_cre.office_id', $fOfficeId);
                } else {
                    // Regular: directional logic relative to current user
                    $qq->where(function($sub) use ($fOfficeId, $userId) {
                        $sub->where('r.created_by_user_id', $userId)
                            ->where('rr.office_id', $fOfficeId);
                    })->orWhere(function($sub) use ($fOfficeId, $userId) {
                        $sub->where('r.created_by_user_id', '!=', $userId)
                            ->where('u_cre.office_id', $fOfficeId);
                    });
                }
            });
        }
        if ($reqSt) $q1->where('r.status', $reqSt);
        if ($status) $q1->where('rr.status', $status);
        if ($batchType) $q1->where('r.mode', $batchType);

        // ── Sub-query B: multi_doc items ──────────────────────────────────
        $q2 = DB::table('document_request_items as dri')
            ->join('document_requests as r', 'r.id', '=', 'dri.request_id')
            ->join('document_request_recipients as rr', 'rr.request_id', '=', 'r.id')
            ->join('offices as o', 'o.id', '=', 'rr.office_id')
            // Join with creator's office
            ->leftJoin('users as u_cre', 'u_cre.id', '=', 'r.created_by_user_id')
            ->leftJoin('offices as o_cre', 'o_cre.id', '=', 'u_cre.office_id')
            ->where('r.mode', 'multi_doc')
            ->select([
                DB::raw("'item' as row_type"),
                'dri.id as row_id',
                'r.id as request_id',
                'r.title as batch_title',
                'r.mode as batch_mode',
                'r.status as batch_status',
                DB::raw('COALESCE(dri.due_at, r.due_at) as due_at'),
                'dri.created_at',
                DB::raw("COALESCE((SELECT s.status FROM document_request_submissions s WHERE s.item_id = dri.id AND s.recipient_id = rr.id ORDER BY s.attempt_no DESC LIMIT 1), rr.status) as item_status"),
                // Directional office logic (null-safe creator office)
                DB::raw("CASE WHEN r.created_by_user_id = {$userId} THEN o.name ELSE COALESCE(o_cre.name, 'Admin / System') END as office_name"),
                DB::raw("CASE WHEN r.created_by_user_id = {$userId} THEN o.code ELSE COALESCE(o_cre.code, 'N/A') END as office_code"),
                'dri.title as item_title',
                'rr.id as recipient_id',
                'dri.id as item_id',
                'rr.office_id',
                DB::raw("CASE WHEN r.created_by_user_id = {$userId} THEN 'outgoing' ELSE 'incoming' END as direction"),
                DB::raw("CASE 
                    WHEN r.created_by_user_id = {$userId} THEN 
                        (SELECT COUNT(*) FROM document_request_recipients rr_act WHERE rr_act.request_id = r.id AND rr_act.status = 'submitted') > 0
                    ELSE 
                        COALESCE((SELECT s.status FROM document_request_submissions s WHERE s.item_id = dri.id AND s.recipient_id = rr.id ORDER BY s.attempt_no DESC LIMIT 1), rr.status) IN ('pending', 'rejected')
                END as can_act")
            ]);

        if (!$isQa) {
            $q2->where(function($qq) use ($officeId, $userId) {
                $qq->where('rr.office_id', $officeId)
                   ->orWhere('r.created_by_user_id', $userId);
            });
        }

        if ($direction === 'incoming') {
            if (!$isQa) {
                $q2->where('rr.office_id', $officeId);
            }
            $q2->where('r.created_by_user_id', '!=', $userId);
        } elseif ($direction === 'outgoing') {
            $q2->where('r.created_by_user_id', $userId);
        }

        if ($fOfficeId) {
            $q2->where(function($qq) use ($fOfficeId, $userId, $isQa) {
                if ($isQa) {
                    $qq->where('rr.office_id', $fOfficeId)
                       ->orWhere('u_cre.office_id', $fOfficeId);
                } else {
                    $qq->where(function($sub) use ($fOfficeId, $userId) {
                        $sub->where('r.created_by_user_id', $userId)
                            ->where('rr.office_id', $fOfficeId);
                    })->orWhere(function($sub) use ($fOfficeId, $userId) {
                        $sub->where('r.created_by_user_id', '!=', $userId)
                            ->where('u_cre.office_id', $fOfficeId);
                    });
                }
            });
        }

        if ($term)  $q2->where(function ($qq) use ($term) {
            $qq->where('r.title', 'like', "%{$term}%")
               ->orWhere('dri.title', 'like', "%{$term}%");
            if (is_numeric($term)) {
                $qq->orWhere('r.id', (int)$term);
            }
        });
        if ($reqSt) $q2->where('r.status', $reqSt);
        if ($batchType) $q2->where('r.mode', $batchType);

        // ── UNION ALL + optional status outer filter ───────────────────────
        $unionSql      = "({$q1->toSql()}) UNION ALL ({$q2->toSql()})";
        $unionBindings = array_merge($q1->getBindings(), $q2->getBindings());

        if ($status) {
            $outerSql      = "SELECT * FROM ({$unionSql}) as combined WHERE item_status = ?";
            $outerBindings = array_merge($unionBindings, [$status]);
        } else {
            $outerSql      = $unionSql;
            $outerBindings = $unionBindings;
        }

        $total = DB::selectOne("SELECT COUNT(*) as agg FROM ({$outerSql}) as t", $outerBindings)->agg ?? 0;

        $allowedSorts = [
            'id' => 'request_id',
            'title' => 'batch_title',
            'created_at' => 'created_at',
            'due_at' => 'due_at',
            'office_code' => 'office_code',
            'status' => 'item_status'
        ];
        $sortBy = $allowedSorts[$filters['sort_by'] ?? ''] ?? 'created_at';
        $sortDir = ($filters['sort_dir'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        $rows  = DB::select(
            "SELECT * FROM ({$outerSql}) as t ORDER BY {$sortBy} {$sortDir} LIMIT {$perPage} OFFSET {$offset}",
            $outerBindings
        );

        return [
            'data'         => $rows,
            'current_page' => $page,
            'last_page'    => max(1, (int) ceil($total / $perPage)),
            'per_page'     => $perPage,
            'total'        => (int) $total,
        ];
    }
}
