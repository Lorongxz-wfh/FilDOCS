<?php

namespace App\Services\Reports;

use App\Models\Office;

class ClusterAnalysisService
{
    /** All top-level cluster office codes. */
    public function clusters(): array
    {
        return ['VAd', 'VA', 'VF', 'VR', 'PO'];
    }

    /** Resolve the office ID for a given office code. */
    public function officeIdByCode(string $code): ?int
    {
        return Office::where('code', $code)->value('id');
    }

    /**
     * Walk up the office hierarchy to find the cluster code for a given office.
     *
     * @param array $officeById  Keyed by office ID, each value: ['code'=>..., 'parent_office_id'=>...]
     */
    public function clusterByOfficeId(?int $officeId, array $officeById): ?string
    {
        if (!$officeId) return null;
        $o = $officeById[$officeId] ?? null;
        if (!$o) return null;

        $code = strtoupper((string) ($o['code'] ?? ''));
        if (in_array($code, $this->clusters(), true)) return $code;

        // Walk up parent chain until we hit a cluster office code
        $guard = 0;
        $parentId = $o['parent_office_id'] ?? null;
        while ($parentId && $guard < 10) {
            $guard++;
            $p = $officeById[$parentId] ?? null;
            if (!$p) break;

            $pCode = strtoupper((string) ($p['code'] ?? ''));
            if (in_array($pCode, $this->clusters(), true)) return $pCode;

            $parentId = $p['parent_office_id'] ?? null;
        }

        return null;
    }
}
