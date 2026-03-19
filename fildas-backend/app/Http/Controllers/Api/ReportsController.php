<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\WorkflowTask;
use App\Models\DocumentVersion;
use App\Services\Reports\ClusterAnalysisService;
use App\Services\WorkflowSteps;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
    use RoleNameTrait;

    public function __construct(private ClusterAnalysisService $clusterAnalysis) {}

    // Backward-compatible alias (old endpoint name)
    public function compliance(Request $request)
    {
        return $this->approval($request);
    }


    // GET /api/reports/approval?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD
    public function approval(Request $request)
    {

        $user = $request->user();
        $roleName = $this->roleNameOf($user);
        $userOfficeId = (int) ($user?->office_id ?? 0);

        // QA-only for now (your requirement)
        $qaOfficeId = (int) ($this->clusterAnalysis->officeIdByCode('QA') ?? 0);
        $isQA = ($roleName === 'qa') || ($qaOfficeId && $userOfficeId === $qaOfficeId);

        $isAdmin = in_array($roleName, ['admin', 'sysadmin'], true);

        if (!$isQA && !$isAdmin) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }
        $data = $request->validate([
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
            'bucket'    => 'nullable|in:daily,weekly,monthly,yearly,total',
            'scope'     => 'nullable|in:clusters,offices',
            'parent'    => 'nullable|in:ALL,PO,VAd,VA,VF,VR',
            'date_field' => 'nullable|in:created,completed',

        ]);

        $bucket = $data['bucket'] ?? 'monthly';
        $scope  = $data['scope'] ?? 'clusters';
        $parent = $data['parent'] ?? 'ALL';
        $dateField = $data['date_field'] ?? 'completed';
        $dateColumn = $dateField === 'created' ? 'created_at' : 'completed_at';

        $offices = Office::query()->get(['id', 'code', 'parent_office_id']);
        $officeById = $offices->keyBy('id')->map(function ($o) {
            return [
                'code' => $o->code,
                'parent_office_id' => $o->parent_office_id,
            ];
        })->all();

        $clusters = $this->clusterAnalysis->clusters();

        // If parent filter is set, only include that cluster in the output (exclude others).
        $allowedClusters = ($parent !== 'ALL') ? [$parent] : $clusters;

        $acc = [];
        foreach ($allowedClusters as $c) {
            $acc[$c] = ['cluster' => $c, 'in_review' => 0, 'sent_to_qa' => 0, 'approved' => 0, 'returned' => 0];
        }

        $officeAcc = []; // [officeId => ['office_id'=>..,'office_code'=>..,'cluster'=>..,'assigned'=>..,'approved'=>..,'returned'=>..]]


        $reviewSteps      = WorkflowSteps::reviewSteps();
        $approvalSteps    = WorkflowSteps::approvalSteps();
        $finalizationSteps = WorkflowSteps::finalizationSteps();

        $allTrackedSteps = array_merge($reviewSteps, $approvalSteps, $finalizationSteps);

        $taskQuery = WorkflowTask::query()
            ->whereIn('phase', ['review', 'approval', 'finalization', 'registration'])
            ->whereIn('status', ['completed', 'returned', 'rejected'])
            ->whereNotNull('assigned_office_id');

        // For completed-based analytics, ignore rows without completed_at
        if ($dateColumn === 'completed_at') {
            $taskQuery->whereNotNull('completed_at');
        }

        if (!empty($data['date_from'])) {
            $taskQuery->whereDate($dateColumn, '>=', $data['date_from']);
        }
        if (!empty($data['date_to'])) {
            $taskQuery->whereDate($dateColumn, '<=', $data['date_to']);
        }

        $tasks = $taskQuery->get([
            'document_version_id',
            'phase',
            'step',
            'status',
            'assigned_office_id',
            'created_at',
            'opened_at',
            'completed_at',
        ]);

        $versionFlags = []; // [versionId => flags]

        foreach ($tasks as $t) {
            $vid = (int) $t->document_version_id;
            if (!isset($versionFlags[$vid])) {
                $versionFlags[$vid] = [
                    'inReview'    => false,   // office head OR vp review hit
                    'sentToQa'    => false,   // qa approval hit
                    'returned'    => false,
                    'distributed' => false,
                    'clusters'       => [],
                    'offices'        => [],
                ];
            }

            $assignedOfficeId = (int) ($t->assigned_office_id ?? 0);
            $cluster = $this->clusterAnalysis->clusterByOfficeId($assignedOfficeId ?: null, $officeById);
            if ($cluster) {
                $versionFlags[$vid]['clusters'][$cluster] = true;

                // office scope: only track offices inside allowed clusters (parent filter)
                if (isset($acc[$cluster]) && $assignedOfficeId) {
                    $versionFlags[$vid]['offices'][$assignedOfficeId] = true;
                }
            }


            if ($t->status === 'returned' || $t->status === 'rejected') {
                $versionFlags[$vid]['returned'] = true;
                continue;
            }

            if (in_array($t->step, $reviewSteps, true)) {
                $versionFlags[$vid]['inReview'] = true;
            }

            if (in_array($t->step, $approvalSteps, true)) {
                $versionFlags[$vid]['sentToQa'] = true;
            }

            if (in_array($t->step, $finalizationSteps, true)) {
                $versionFlags[$vid]['distributed'] = true;
            }
        }

        foreach ($versionFlags as $flags) {
            $clustersTouched = array_keys($flags['clusters'] ?? []);
            if (empty($clustersTouched)) continue;

            $clusterKey = in_array('PO', $clustersTouched, true)
                ? 'PO'
                : $clustersTouched[0];

            if (!isset($acc[$clusterKey])) continue;

            if (!empty($flags['returned'])) {
                $acc[$clusterKey]['returned']++;
                continue;
            }

            if (!empty($flags['inReview'])) {
                $acc[$clusterKey]['in_review']++;
            }

            if (!empty($flags['sentToQa'])) {
                $acc[$clusterKey]['sent_to_qa']++;
            }

            if (!empty($flags['distributed'])) {
                $acc[$clusterKey]['approved']++;
            }
        }

        if ($scope === 'offices') {
            foreach ($versionFlags as $flags) {
                $officeIdsTouched = array_keys($flags['offices'] ?? []);
                if (empty($officeIdsTouched)) continue;

                // If version was returned anywhere, count it as returned for each touched office (same rule style as clusters)
                if (!empty($flags['returned'])) {
                    foreach ($officeIdsTouched as $oid) {
                        $oid = (int) $oid;
                        $o = $officeById[$oid] ?? null;
                        if (!$o) continue;

                        $officeAcc[$oid] ??= [
                            'office_id' => $oid,
                            'office_code' => $o['code'] ?? null,
                            'cluster' => $this->clusterAnalysis->clusterByOfficeId($oid, $officeById),
                            'in_review' => 0,
                            'sent_to_qa' => 0,
                            'approved' => 0,
                            'returned' => 0,
                        ];

                        $officeAcc[$oid]['returned']++;
                    }
                    continue;
                }

                foreach ($officeIdsTouched as $oid) {
                    $oid = (int) $oid;
                    $o = $officeById[$oid] ?? null;
                    if (!$o) continue;

                    $officeAcc[$oid] ??= [
                        'office_id' => $oid,
                        'office_code' => $o['code'] ?? null,
                        'cluster' => $this->clusterAnalysis->clusterByOfficeId($oid, $officeById),
                        'in_review' => 0,
                        'sent_to_qa' => 0,
                        'approved' => 0,
                        'returned' => 0,
                    ];

                    if (!empty($flags['inReview'])) {
                        $officeAcc[$oid]['in_review']++;
                    }

                    if (!empty($flags['sentToQa'])) {
                        $officeAcc[$oid]['sent_to_qa']++;
                    }

                    if (!empty($flags['distributed'])) {
                        $officeAcc[$oid]['approved']++;
                    }
                }
            }
        }

        // Build timeline series (QA flow only) based on selected bucket and $dateColumn
        $seriesAcc = []; // [label => ['label'=>..., 'assigned'=>0, 'approved'=>0, 'returned'=>0]]

        // Helper: compute bucket label from a datetime string
        $bucketLabel = function (?string $iso) use ($bucket) {
            if (!$iso) return null;
            $dt = \Carbon\Carbon::parse($iso);

            if ($bucket === 'total') return 'Total';
            if ($bucket === 'daily') return $dt->format('Y-m-d');

            if ($bucket === 'weekly') {
                // Monday-start week
                $start = $dt->copy()->startOfWeek(\Carbon\Carbon::MONDAY);
                return $start->format('Y-m-d');
            }

            if ($bucket === 'monthly') return $dt->format('Y-m');
            if ($bucket === 'yearly') return $dt->format('Y');

            return $dt->format('Y-m');
        };

        // Track unique versions per label per metric
        $seenSeries = []; // [$label => ['in_review'=>[vid=>true], 'sent_to_qa'=>[vid=>true], 'approved'=>[vid=>true], 'returned'=>[vid=>true]]]

        foreach ($tasks as $t) {
            // Parent filter: only include tasks routed to allowed clusters
            $assignedOfficeId = (int) ($t->assigned_office_id ?? 0);
            $cluster = $this->clusterAnalysis->clusterByOfficeId($assignedOfficeId ?: null, $officeById);
            if (!$cluster) continue;
            if (!isset($acc[$cluster])) continue;

            $label = $bucketLabel($t->{$dateColumn} ?? null);
            if (!$label) continue;

            if (!isset($seriesAcc[$label])) {
                $seriesAcc[$label] = ['label' => $label, 'in_review' => 0, 'sent_to_qa' => 0, 'approved' => 0, 'returned' => 0];
                $seenSeries[$label] = ['in_review' => [], 'sent_to_qa' => [], 'approved' => [], 'returned' => []];
            }

            $vid = (int) $t->document_version_id;

            if ($t->status === 'returned' || $t->status === 'rejected') {
                if (!isset($seenSeries[$label]['returned'][$vid])) {
                    $seenSeries[$label]['returned'][$vid] = true;
                    $seriesAcc[$label]['returned']++;
                }
                continue;
            }

            if (in_array($t->step, $reviewSteps, true)) {
                if (!isset($seenSeries[$label]['in_review'][$vid])) {
                    $seenSeries[$label]['in_review'][$vid] = true;
                    $seriesAcc[$label]['in_review']++;
                }
            }

            if (in_array($t->step, $approvalSteps, true)) {
                if (!isset($seenSeries[$label]['sent_to_qa'][$vid])) {
                    $seenSeries[$label]['sent_to_qa'][$vid] = true;
                    $seriesAcc[$label]['sent_to_qa']++;
                }
            }

            if (in_array($t->step, $finalizationSteps, true)) {
                if (!isset($seenSeries[$label]['approved'][$vid])) {
                    $seenSeries[$label]['approved'][$vid] = true;
                    $seriesAcc[$label]['approved']++;
                }
            }
        }

        $series = array_values($seriesAcc);
        usort($series, fn($a, $b) => strcmp($a['label'], $b['label']));

        // Volume: created vs final approved (distributed) per bucket
        $volumeAcc = []; // [label => ['label'=>..., 'created'=>0, 'approved_final'=>0]]

        // Helper to init a bucket row
        $ensureVol = function (string $label) use (&$volumeAcc) {
            if (!isset($volumeAcc[$label])) {
                $volumeAcc[$label] = ['label' => $label, 'created' => 0, 'approved_final' => 0];
            }
        };

        // Created versions (ALL created versions; not filtered by parent)
        $createdQ = DocumentVersion::query()->select(['id', 'created_at']);
        if (!empty($data['date_from'])) $createdQ->whereDate('created_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $createdQ->whereDate('created_at', '<=', $data['date_to']);

        $createdRows = $createdQ->get();
        foreach ($createdRows as $v) {
            $label = $bucketLabel($v->created_at?->toISOString() ?? null);
            if (!$label) continue;
            $ensureVol($label);
            $volumeAcc[$label]['created']++;
        }

        // Approved(final) versions (distributed_at), filtered by date range and parent (via tasks)
        $approvedQ = DocumentVersion::query()
            ->whereNotNull('distributed_at')
            ->select(['id', 'distributed_at']);

        if (!empty($data['date_from'])) $approvedQ->whereDate('distributed_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $approvedQ->whereDate('distributed_at', '<=', $data['date_to']);

        $approvedRows = $approvedQ->get();

        foreach ($approvedRows as $v) {
            // Parent filter for approved_final: require that version touched an allowed cluster (if parent != ALL)
            if ($parent !== 'ALL') {
                $flags = $versionFlags[(int)$v->id] ?? null;
                $clustersTouched = array_keys($flags['clusters'] ?? []);
                $clusterKey = in_array('PO', $clustersTouched, true) ? 'PO' : ($clustersTouched[0] ?? null);
                if (!$clusterKey || !isset($acc[$clusterKey])) continue;
            }

            $label = $bucketLabel($v->distributed_at?->toISOString() ?? null);
            if (!$label) continue;
            $ensureVol($label);
            $volumeAcc[$label]['approved_final']++;
        }

        $volumeSeries = array_values($volumeAcc);
        usort($volumeSeries, fn($a, $b) => strcmp($a['label'], $b['label']));

        // KPIs
        $totalCreated = count($createdRows);
        $totalApprovedFinal = 0;
        $approvedFinalWithZeroReturns = 0;
        $totalReturnEvents = 0;

        foreach ($tasks as $t) {
            if ($t->status === 'returned') $totalReturnEvents++;
        }

        $approvedVersionIds = [];

        foreach ($approvedRows as $v) {
            // same parent filter rule as above
            if ($parent !== 'ALL') {
                $flags = $versionFlags[(int)$v->id] ?? null;
                $clustersTouched = array_keys($flags['clusters'] ?? []);
                $clusterKey = in_array('PO', $clustersTouched, true) ? 'PO' : ($clustersTouched[0] ?? null);
                if (!$clusterKey || !isset($acc[$clusterKey])) continue;
            }

            $totalApprovedFinal++;
            $approvedVersionIds[] = (int) $v->id;

            $flags = $versionFlags[(int)$v->id] ?? null;
            $hasReturn = !empty($flags['returned']);
            if (!$hasReturn) $approvedFinalWithZeroReturns++;
        }


        $firstPassYieldPct = $totalApprovedFinal
            ? round(($approvedFinalWithZeroReturns / $totalApprovedFinal) * 100)
            : 0;

        $uniqueVersionsTouched = count($versionFlags); // based on tasks in current filter
        $pingPongRatio = $uniqueVersionsTouched ? round($totalReturnEvents / $uniqueVersionsTouched, 2) : 0;

        // Cycle time + stage delays
        $cycleSecondsTotal = 0;
        $cycleCount = 0;

        // stage buckets — build tracking structure from canonical step groupings
        $stageBuckets = [];
        foreach (WorkflowSteps::reportStageGroups() as $stageName => $steps) {
            $stageBuckets[$stageName] = [
                'steps'         => $steps,
                'total_seconds' => 0,
                'task_count'    => 0,
                'version_ids'   => [],
            ];
        }


        // If you choose Option B later, we’ll add: 'Drafting' => ['steps' => ['office_draft'], ...]

        // Index tasks per version for quick lookup
        $tasksByVersion = [];
        foreach ($tasks as $t) {
            $vid = (int) $t->document_version_id;
            $tasksByVersion[$vid] ??= [];
            $tasksByVersion[$vid][] = $t;
        }

        foreach ($approvedVersionIds as $vid) {
            $vTasks = $tasksByVersion[$vid] ?? [];
            if (empty($vTasks)) continue;

            // earliest opened_at among tasks for start time (fallback to created_at)
            $start = null;
            foreach ($vTasks as $t) {
                $candidate = $t->opened_at ?? $t->created_at ?? null;
                if (!$candidate) continue;
                $dt = \Carbon\Carbon::parse($candidate);
                if (!$start || $dt->lt($start)) $start = $dt;
            }

            // end time = distributed task completed_at OR DocumentVersion distributed_at (more reliable)
            $end = null;
            foreach ($vTasks as $t) {
                if ($t->phase === 'registration' && $t->step === 'distributed') {
                    $candidate = $t->completed_at ?? $t->opened_at ?? null;
                    if ($candidate) $end = \Carbon\Carbon::parse($candidate);
                    break;
                }
            }

            if (!$end) {
                // fallback to distributed_at from document_versions
                $dv = DocumentVersion::find($vid);
                if ($dv && $dv->distributed_at) $end = \Carbon\Carbon::parse($dv->distributed_at);
            }

            if ($start && $end && $end->gte($start)) {
                $sec = $start->diffInSeconds($end, false);
                if ($sec < 0) $sec = abs($sec);
                $cycleSecondsTotal += $sec;
                $cycleCount++;
            }
        }

        // Stage delay (B): only tasks belonging to final-distributed versions
        $approvedVidSet = array_fill_keys($approvedVersionIds, true);

        // Stage delay: average per step group (use opened_at -> completed_at)
        foreach ($tasks as $t) {
            $vid = (int) $t->document_version_id;
            if (!isset($approvedVidSet[$vid])) continue;

            if (!$t->opened_at || !$t->completed_at) continue;
            if ($t->status !== 'completed') continue;

            $startDt = \Carbon\Carbon::parse($t->opened_at);
            $endDt   = \Carbon\Carbon::parse($t->completed_at);

            $sec = $startDt->diffInSeconds($endDt, false);
            if ($sec < 0) $sec = abs($sec);

            foreach ($stageBuckets as $stageName => $cfg) {
                if (in_array($t->step, $cfg['steps'], true)) {
                    $stageBuckets[$stageName]['total_seconds'] += $sec;
                    $stageBuckets[$stageName]['task_count'] += 1;
                    $stageBuckets[$stageName]['version_ids'][$vid] = true; // unique versions per stage
                    break;
                }
            }
        }

        $cycleTimeAvgDays = $cycleCount ? round(($cycleSecondsTotal / $cycleCount) / 86400, 2) : 0;

        $stageDelays = [];
        foreach ($stageBuckets as $stageName => $cfg) {
            $taskCount = (int) ($cfg['task_count'] ?? 0);
            $versionCount = is_array($cfg['version_ids'] ?? null) ? count($cfg['version_ids']) : 0;

            $avgHours = $taskCount ? round(($cfg['total_seconds'] / $taskCount) / 3600, 2) : 0;

            $stageDelays[] = [
                'stage' => $stageName,
                'avg_hours' => $avgHours,        // avg duration per task (still meaningful)
                'count' => $versionCount,        // unique distributed versions that hit this stage
                'task_count' => $taskCount,      // (optional) keep for debugging/insight
            ];
        }

        return response()->json([
            'clusters' => array_values($acc),
            'offices'  => array_values($officeAcc),
            'series'   => $series,

            'volume_series' => $volumeSeries,
            'kpis' => [
                'total_created' => $totalCreated,
                'total_approved_final' => $totalApprovedFinal,
                'first_pass_yield_pct' => $firstPassYieldPct,
                'pingpong_ratio' => $pingPongRatio,
                'cycle_time_avg_days' => $cycleTimeAvgDays,
            ],
            'stage_delays' => $stageDelays,

        ]);
    }
}
