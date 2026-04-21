<?php

namespace App\Services\Reports;

use App\Models\ActivityLog;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class ActivityReportService
{
    /**
     * Categorize an event into Workflows, Access, or System.
     */
    public static function categorizeEvent(string $event): string
    {
        if (str_starts_with($event, 'document.') || 
            str_starts_with($event, 'workflow.') || 
            str_starts_with($event, 'version.') || 
            str_starts_with($event, 'document_request.') ||
            str_starts_with($event, 'template.')) {
            return 'Workflows';
        }

        if (str_starts_with($event, 'auth.')) {
            return 'Access';
        }

        if (str_starts_with($event, 'user.') || 
            str_starts_with($event, 'profile.') || 
            str_starts_with($event, 'office.') || 
            str_starts_with($event, 'announcement.') || 
            str_starts_with($event, 'settings.')) {
            return 'System';
        }

        return 'Others';
    }

    /**
     * Get activity statistics for the dashboard or reports.
     */
    public function getActivityStats(array $filters = [])
    {
        $dateFrom = isset($filters['date_from']) ? Carbon::parse($filters['date_from'])->startOfDay() : null;
        $dateTo   = isset($filters['date_to']) ? Carbon::parse($filters['date_to'])->endOfDay() : null;
        $officeId = isset($filters['office_id']) ? (int) $filters['office_id'] : null;

        if (!$dateFrom) {
            $days = $filters['days'] ?? 14;
            $dateFrom = Carbon::now()->subDays($days - 1)->startOfDay();
        }

        if (!$dateTo) {
            $dateTo = Carbon::now()->endOfDay();
        }

        $query = ActivityLog::query()
            ->whereBetween('created_at', [$dateFrom, $dateTo]);

        if ($officeId) {
            $query->where('actor_office_id', $officeId);
        }

        // Fetch logs for trend and distribution
        $logs = $query->get(['event', 'created_at', 'actor_user_id', 'actor_office_id']);

        // Group by day and category
        $dailyTrend = [];
        $current = $dateFrom->copy();
        while ($current <= $dateTo) {
            $dateStr = $current->format('Y-m-d');
            $dailyTrend[$dateStr] = [
                'date' => $dateStr,
                'Workflows' => 0,
                'Access' => 0,
                'System' => 0,
                'Others' => 0,
                'total' => 0
            ];
            $current->addDay();
        }

        $distribution = [
            'Workflows' => 0,
            'Access' => 0,
            'System' => 0,
            'Others' => 0
        ];

        foreach ($logs as $log) {
            $category = self::categorizeEvent($log->event);
            $date = $log->created_at->format('Y-m-d');

            if (isset($dailyTrend[$date])) {
                $dailyTrend[$date][$category]++;
                $dailyTrend[$date]['total']++;
            }

            $distribution[$category]++;
        }

        // Top Actors (Users)
        $topActors = ActivityLog::query()
            ->whereBetween('created_at', [$dateFrom, $dateTo]);
        
        if ($officeId) {
            $topActors->where('actor_office_id', $officeId);
        }

        $topActors = $topActors->select('actor_user_id', DB::raw('count(*) as count'))
            ->groupBy('actor_user_id')
            ->orderByDesc('count')
            ->limit(10)
            ->with(['actorUser:id,first_name,middle_name,last_name,suffix,office_id', 'actorUser.office:id,code'])
            ->get()
            ->map(function($item) {
                return [
                    'user_id' => $item->actor_user_id,
                    'full_name' => $item->actorUser?->full_name ?? 'Unknown System Action',
                    'office' => $item->actorUser?->office?->code ?? 'N/A',
                    'count' => $item->count,
                ];
            });

        return [
            'daily_trend' => array_values($dailyTrend),
            'distribution' => array_map(function($count, $label) {
                return ['label' => $label, 'count' => $count];
            }, $distribution, array_keys($distribution)),
            'total_actions' => $logs->count(),
            'top_actors' => $topActors,
        ];
    }
}
