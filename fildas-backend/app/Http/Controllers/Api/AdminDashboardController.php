<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Document;
use App\Models\User;
use App\Models\Office;
use App\Services\Reports\ActivityReportService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    public function __construct(private ActivityReportService $activityReport) {}

    public function stats(Request $request)
    {
        $data = $request->validate([
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
        ]);

        // User counts (Global counts usually remain absolute, but we can filter recent)
        $totalUsers     = User::count();
        $activeUsers    = User::whereNull('disabled_at')->count();
        $onlineUsers    = User::whereNull('disabled_at')
            ->whereNotNull('last_active_at')
            ->where('last_active_at', '>=', now()->subMinutes(30))
            ->count();

        // Office counts
        $totalOffices  = Office::count();
        $activeOffices = Office::whereNull('deleted_at')->count();

        // Document totals (Filtered by date)
        $docQuery = Document::query();
        if (!empty($data['date_from'])) {
            $docQuery->where('created_at', '>=', $data['date_from']);
        }
        if (!empty($data['date_to'])) {
            $docQuery->where('created_at', '<=', $data['date_to']);
        }

        $totalDocuments = $docQuery->count();
        
        $distQuery = Document::whereHas('latestVersion', function ($v) use ($data) {
            $v->where('status', 'Distributed');
            if (!empty($data['date_from'])) $v->where('distributed_at', '>=', $data['date_from']);
            if (!empty($data['date_to']))   $v->where('distributed_at', '<=', $data['date_to']);
        });
        $distributedDocuments = $distQuery->count();

        $progQuery = Document::whereHas('latestVersion', function ($v) use ($data) {
            $v->whereNotIn('status', ['Distributed', 'Cancelled', 'Superseded', 'Draft', 'Office Draft']);
            // For in-progress, we usually count those active in the period, 
            // but created_at filter on the document is safer for "Volume" charts.
        });
        if (!empty($data['date_from'])) $progQuery->where('created_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $progQuery->where('created_at', '<=', $data['date_to']);
        
        $inProgressDocuments = $progQuery->count();

        // Document phase breakdown (Filtered by creation date)
        $phaseBase = Document::query();
        if (!empty($data['date_from'])) $phaseBase->where('created_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $phaseBase->where('created_at', '<=', $data['date_to']);

        $docsByPhase = [
            'draft'        => (clone $phaseBase)->whereHas('latestVersion', fn($q) => $q->whereIn('status', ['Draft', 'Office Draft']))->count(),
            'review'       => (clone $phaseBase)->whereHas('latestVersion', fn($q) => $q->where('status', 'like', '%Review%')->orWhere('status', 'like', '%Check%'))->count(),
            'approval'     => (clone $phaseBase)->whereHas('latestVersion', fn($q) => $q->where('status', 'like', '%Approval%'))->count(),
            'finalization' => (clone $phaseBase)->whereHas('latestVersion', fn($q) => $q->where(function ($r) { $r->where('status', 'like', '%Registration%')->orWhere('status', 'like', '%Distribution%'); }))->count(),
            'distributed'  => $distributedDocuments,
        ];

        // Recent user registrations (last 8)
        $recentUsers = User::query()
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->leftJoin('offices', 'users.office_id', '=', 'offices.id')
            ->select(
                'users.id',
                'users.first_name',
                'users.last_name',
                'users.email',
                'users.created_at',
                'users.disabled_at',
                'roles.name as role',
                'offices.name as office_name'
            )
            ->orderByDesc('users.created_at')
            ->limit(8)
            ->get()
            ->map(fn($u) => [
                'id'          => $u->id,
            'name'        => trim($u->first_name . ' ' . $u->last_name),
            'email'       => $u->email,
            'role'        => $u->role,
            'office_name' => $u->office_name,
            'is_active'   => is_null($u->disabled_at),
            'created_at'  => $u->created_at,
            ]);

        // Consolidated activity stats
        $activityStats = $this->activityReport->getActivityStats([
            'date_from' => $data['date_from'] ?? null,
            'date_to'   => $data['date_to'] ?? null,
        ]);

        return response()->json([
            'users' => [
                'total'        => $totalUsers,
                'active'       => $activeUsers,
                'inactive'     => $totalUsers - $activeUsers,
                'online'       => $onlineUsers,
                'recent'       => $recentUsers,
            ],
            'offices' => [
                'total'  => $totalOffices,
                'active' => $activeOffices,
            ],
            'documents' => [
                'total'       => $totalDocuments,
                'distributed' => $distributedDocuments,
                'in_progress' => $inProgressDocuments,
                'by_phase'    => $docsByPhase,
            ],
            'activity' => $activityStats,
        ]);
    }
}
