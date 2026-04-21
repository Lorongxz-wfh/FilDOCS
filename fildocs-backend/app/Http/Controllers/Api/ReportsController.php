<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\WorkflowTask;
use App\Models\DocumentVersion;
use App\Models\DocumentRequest;
use App\Models\DocumentRequestRecipient;
use App\Services\Reports\ClusterAnalysisService;
use App\Services\Reports\ActivityReportService;
use App\Services\WorkflowSteps;
use App\Traits\RoleNameTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReportsController extends Controller
{
    use RoleNameTrait;

    public function __construct(
        private ClusterAnalysisService $clusterAnalysis,
        private ActivityReportService $activityReport
    ) {}

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

        $qaOfficeId = (int) ($this->clusterAnalysis->officeIdByCode('QA') ?? 0);
        $isQA = ($roleName === 'qa') || ($qaOfficeId && $userOfficeId === $qaOfficeId);
        $isAdmin = in_array($roleName, ['admin', 'sysadmin'], true);
        $isOfficeHead = ($roleName === 'office_head');
        $isOfficeStaff = ($roleName === 'office_staff');
        $isPresident = ($roleName === 'president');
        $isVP = in_array($roleName, ['vpaa', 'vpad', 'vpf', 'vpr'], true);

        if (!$isQA && !$isAdmin && !$isOfficeHead && !$isOfficeStaff && !$isPresident && !$isVP) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'date_from'  => 'nullable|date',
            'date_to'    => 'nullable|date',
            'bucket'     => 'nullable|in:daily,weekly,monthly,yearly,total',
            'scope'      => 'nullable|in:clusters,offices',
            'parent'     => 'nullable|in:ALL,PO,VAd,VA,VF,VR',
            'date_field' => 'nullable|in:created,completed',
            'office_id'  => 'nullable|integer|exists:offices,id',
        ]);

        $bucket = $data['bucket'] ?? 'monthly';
        $scope  = $data['scope'] ?? 'offices';
        $parent = $data['parent'] ?? 'ALL';
        $dateField = $data['date_field'] ?? 'completed';
        $dateColumn = $dateField === 'created' ? 'created_at' : 'completed_at';

        // ── Security Hardening & Scoping ───────────────────────────────────────────
        $officeIdFilter = isset($data['office_id']) ? (int) $data['office_id'] : null;
        $clusterOfficeIds = null;

        // 1. VP Hardlock Check: VPs can only ever request data for their assigned cluster.
        if ($isVP) {
            $vpMap = ['vpaa' => 'VA', 'vpad' => 'VAd', 'vpf' => 'VF', 'vpr' => 'VR'];
            $parent = $vpMap[$roleName] ?? 'ALL';
            
            // If they tried to filter by a specific office, verify it belongs to their cluster
            if ($officeIdFilter) {
                $clusterIds = $this->clusterAnalysis->officeIdsForCluster($parent);
                $clusterOfficeIds = in_array($officeIdFilter, $clusterIds) ? [$officeIdFilter] : [0]; 
            } else {
                $clusterOfficeIds = $this->clusterAnalysis->officeIdsForCluster($parent);
            }
        } 
        // 2. Departmental Hardlock: Office Staff/Head can ONLY ever see their own office stats.
        elseif (($isOfficeHead || $isOfficeStaff) && $userOfficeId) {
            $clusterOfficeIds = [$userOfficeId];
            $scope = 'offices'; // Force office scope
            $parent = 'ALL';    // Ignore cluster parent filters
        }
        // 3. Global Filters for Admin/QA/President
        else {
            if ($officeIdFilter) {
                $clusterOfficeIds = [$officeIdFilter];
            } elseif ($parent !== 'ALL') {
                $clusterOfficeIds = $this->clusterAnalysis->officeIdsForCluster($parent);
            }
        }

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
        if ($clusterOfficeIds !== null) {
            $taskQuery->whereIn('assigned_office_id', $clusterOfficeIds);
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

        // Pre-seed the last 6 months with zeros when using monthly bucket and no explicit date range,
        // so the chart always shows a consistent range even when data is sparse.
        if ($bucket === 'monthly' && empty($data['date_from'])) {
            for ($i = 5; $i >= 0; $i--) {
                $ensureVol(\Carbon\Carbon::now()->subMonths($i)->format('Y-m'));
            }
        }

        // Created unique documents, filtered by date range and optionally by cluster
        $createdQ = DocumentVersion::query()
            ->select('document_id', DB::raw('MIN(created_at) as first_created_at'))
            ->groupBy('document_id');

        if (!empty($data['date_from'])) $createdQ->having(DB::raw('MIN(created_at)'), '>=', $data['date_from']);
        if (!empty($data['date_to']))   $createdQ->having(DB::raw('MIN(created_at)'), '<=', $data['date_to']);

        if ($clusterOfficeIds !== null) {
            $createdQ->whereExists(function ($q) use ($clusterOfficeIds) {
                $q->select(DB::raw(1))
                    ->from('documents')
                    ->whereColumn('documents.id', 'document_versions.document_id')
                    ->whereIn('documents.owner_office_id', $clusterOfficeIds);
            });
        }

        $createdRows = $createdQ->get();
        foreach ($createdRows as $v) {
            $label = $bucketLabel($v->first_created_at ?? null);
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
            // Filter approved_final by cluster or office when a filter is active
            if ($clusterOfficeIds !== null) {
                $flags = $versionFlags[(int)$v->id] ?? null;
                if (!$flags) continue; // version not touched by this cluster/office
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

        // stage buckets — split by routing_mode (default vs custom flow)
        $stageGroupDefs = WorkflowSteps::reportStageGroups();
        $initBuckets = function () use ($stageGroupDefs): array {
            $b = [];
            foreach ($stageGroupDefs as $stageName => $stepList) {
                $row = [];
                $row["steps"] = $stepList;
                $row["total_seconds"] = 0;
                $row["task_count"] = 0;
                $row["version_ids"] = [];
                $b[$stageName] = $row;
            }
            return $b;
        };
        $stageBucketsDefault = $initBuckets();
        $stageBucketsCustom  = $initBuckets();

        // Phase buckets — merged across routing modes, stores individual durations for median
        $phaseGroupDefs = WorkflowSteps::reportPhaseGroups();
        $phaseBuckets = [];
        foreach ($phaseGroupDefs as $phaseName => $stepList) {
            $phaseBuckets[$phaseName] = ['steps' => $stepList, 'durations' => [], 'version_ids' => []];
        }

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

            // earliest created_at among tasks for start time (absolute start)
            $start = null;
            foreach ($vTasks as $t) {
                $candidate = $t->created_at ?? null;
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

        // Lookup routing_mode per version so we can split default vs custom
        $versionRoutingModes = DocumentVersion::whereIn('id', $approvedVersionIds)
            ->pluck('routing_mode', 'id');

        // Stage delay: average per step group (use opened_at -> completed_at)
        foreach ($tasks as $t) {
            $vid = (int) $t->document_version_id;
            if (!isset($approvedVidSet[$vid])) continue;

            if (!$t->opened_at || !$t->completed_at) continue;
            if ($t->status !== 'completed') continue;

            $startDt = \Carbon\Carbon::parse($t->created_at);
            $endDt   = \Carbon\Carbon::parse($t->completed_at);

            $sec = $startDt->diffInSeconds($endDt, false);
            if ($sec < 0) $sec = abs($sec);

            $routingMode  = $versionRoutingModes[$vid] ?? 'default';
            $targetBuckets = ($routingMode === 'custom') ? $stageBucketsCustom : $stageBucketsDefault;

            foreach ($targetBuckets as $stageName => $cfg) {
                if (in_array($t->step, $cfg["steps"], true)) {
                    if ($routingMode === 'custom') {
                        $stageBucketsCustom[$stageName]['total_seconds'] += $sec;
                        $stageBucketsCustom[$stageName]['task_count'] += 1;
                        $stageBucketsCustom[$stageName]['version_ids'][$vid] = true;
                    } else {
                        $stageBucketsDefault[$stageName]['total_seconds'] += $sec;
                        $stageBucketsDefault[$stageName]['task_count'] += 1;
                        $stageBucketsDefault[$stageName]['version_ids'][$vid] = true;
                    }
                    break;
                }
            }

            // Fill phase buckets (merged, all routing modes)
            foreach ($phaseBuckets as $phaseName => $cfg) {
                if (in_array($t->step, $cfg['steps'], true)) {
                    $phaseBuckets[$phaseName]['durations'][] = $sec;
                    $phaseBuckets[$phaseName]['version_ids'][$vid] = true;
                    break;
                }
            }
        }

        $cycleTimeAvgDays = $cycleCount ? round(($cycleSecondsTotal / $cycleCount) / 86400, 2) : 0;

        // Helper: convert a bucket array to the output format
        $buildDelays = function (array $buckets): array {
            $out = [];
            foreach ($buckets as $stageName => $cfg) {
                $taskCount    = (int) ($cfg['task_count'] ?? 0);
                $versionCount = is_array($cfg['version_ids'] ?? null) ? count($cfg['version_ids']) : 0;
                $avgHours     = $taskCount ? round(($cfg['total_seconds'] / $taskCount) / 3600, 2) : 0;
                $out[] = [
                    'stage'      => $stageName,
                    'avg_hours'  => $avgHours,
                    'count'      => $versionCount,
                    'task_count' => $taskCount,
                ];
            }
            return $out;
        };

        $stageDelaysDefault = $buildDelays($stageBucketsDefault);
        $stageDelaysCustom  = $buildDelays($stageBucketsCustom);

        // Helper: phase-based delays with median
        $buildPhaseDelays = function (array $buckets): array {
            $out = [];
            foreach ($buckets as $phaseName => $cfg) {
                $durations    = $cfg['durations'] ?? [];
                $taskCount    = count($durations);
                $versionCount = count($cfg['version_ids'] ?? []);
                sort($durations);
                $median = 0;
                if ($taskCount > 0) {
                    $mid    = (int) floor($taskCount / 2);
                    $median = ($taskCount % 2 === 0)
                        ? round(($durations[$mid - 1] + $durations[$mid]) / 2 / 3600, 2)
                        : round($durations[$mid] / 3600, 2);
                }
                $avg = $taskCount ? round(array_sum($durations) / $taskCount / 3600, 2) : 0;
                $out[] = [
                    'stage'        => $phaseName,
                    'median_hours' => $median,
                    'avg_hours'    => $avg,
                    'count'        => $versionCount,
                    'task_count'   => $taskCount,
                ];
            }
            return $out;
        };
        $stageDelaysByPhase = $buildPhaseDelays($phaseBuckets);

        // Pooled (backwards-compatible)
        $stageBucketsPooled = $initBuckets();
        foreach ([$stageBucketsDefault, $stageBucketsCustom] as $src) {
            foreach ($src as $stageName => $cfg) {
                $stageBucketsPooled[$stageName]['total_seconds'] += $cfg['total_seconds'];
                $stageBucketsPooled[$stageName]['task_count']    += $cfg['task_count'];
                foreach ($cfg['version_ids'] as $k => $v) {
                    $stageBucketsPooled[$stageName]['version_ids'][$k] = true;
                }
            }
        }
        $stageDelays = $buildDelays($stageBucketsPooled);

        // ── Phase distribution (current status of documents, filtered by cluster + date) ────
        $phaseQuery = DocumentVersion::query()
            ->whereIn('id', function ($q) {
                $q->selectRaw('MAX(id)')
                    ->from('document_versions')
                    ->groupBy('document_id');
            });
        if ($clusterOfficeIds !== null || !empty($data['date_from']) || !empty($data['date_to'])) {
            $phaseQuery->whereExists(function ($q) use ($clusterOfficeIds, $data) {
                $q->select(DB::raw(1))
                    ->from('documents')
                    ->whereColumn('documents.id', 'document_versions.document_id');
                if ($clusterOfficeIds !== null) {
                    $q->whereIn('documents.owner_office_id', $clusterOfficeIds);
                }
                if (!empty($data['date_from'])) {
                    $q->whereDate('documents.updated_at', '>=', $data['date_from']);
                }
                if (!empty($data['date_to'])) {
                    $q->whereDate('documents.updated_at', '<=', $data['date_to']);
                }
            });
        }
        $latestVersions = $phaseQuery->get(['status']);

        $phaseMap = ['Draft' => 0, 'Review' => 0, 'Approval' => 0, 'Finalization' => 0, 'Completed' => 0, 'Cancelled' => 0];
        foreach ($latestVersions as $v) {
            $s = $v->status ?? '';
            $sl = strtolower($s);

            if ($sl === 'distributed') {
                $phaseMap['Completed']++;
            } elseif ($sl === 'cancelled' || $sl === 'superseded') {
                $phaseMap['Cancelled']++;
            } elseif (str_contains($s, 'Registration') || ($sl !== 'distributed' && str_contains($s, 'Distribution'))) {
                $phaseMap['Finalization']++;
            } elseif (str_contains($s, 'Review')) {
                $phaseMap['Review']++;
            } elseif (str_contains($s, 'Approval') || str_contains($s, 'Check')) {
                $phaseMap['Approval']++;
            } else {
                $phaseMap['Draft']++; // 'Draft', 'Office Draft', etc.
            }
        }
        $phaseDistribution = array_values(array_filter(
            array_map(fn ($k) => ['phase' => $k, 'count' => $phaseMap[$k]], array_keys($phaseMap)),
            fn ($x) => $x['count'] > 0
        ));

        // ── Waiting on QA ────────────────────────────────────────────────────
        $waitingOnQa = WorkflowTask::query()
            ->whereIn('status', ['pending', 'in_progress'])
            ->where('assigned_office_id', $qaOfficeId)
            ->count();

        // ── Revision stats (date + cluster filtered) ─────────────────────────
        $revisionBase = DB::table('document_versions as dv')
            ->selectRaw('dv.document_id, count(*) as v_count')
            ->groupBy('dv.document_id');
        if (!empty($data['date_from'])) $revisionBase->whereDate('dv.created_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $revisionBase->whereDate('dv.created_at', '<=', $data['date_to']);
        if ($clusterOfficeIds !== null) {
            $revisionBase->whereExists(function ($q) use ($clusterOfficeIds) {
                $q->select(DB::raw(1))
                    ->from('documents as d')
                    ->whereColumn('d.id', 'dv.document_id')
                    ->whereIn('d.owner_office_id', $clusterOfficeIds);
            });
        }
        $versionCounts = $revisionBase->get();
        $docsOnV2Plus = $versionCounts->where('v_count', '>=', 2)->count();
        $avgVersions  = $versionCounts->count() ? round($versionCounts->avg('v_count'), 1) : 0;

        // ── Routing split (date + cluster filtered) ───────────────────────────
        $routingBase = DB::table('document_versions as dv')
            ->selectRaw('dv.routing_mode, count(distinct dv.document_id) as cnt')
            ->whereNotNull('dv.routing_mode')
            ->groupBy('dv.routing_mode');
        if (!empty($data['date_from'])) $routingBase->whereDate('dv.created_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $routingBase->whereDate('dv.created_at', '<=', $data['date_to']);
        if ($clusterOfficeIds !== null) {
            $routingBase->whereExists(function ($q) use ($clusterOfficeIds) {
                $q->select(DB::raw(1))
                    ->from('documents as d')
                    ->whereColumn('d.id', 'dv.document_id')
                    ->whereIn('d.owner_office_id', $clusterOfficeIds);
            });
        }
        $routingCounts  = $routingBase->get()->pluck('cnt', 'routing_mode');
        $routingDefault = (int) ($routingCounts['default'] ?? 0);
        $routingCustom  = (int) ($routingCounts['custom'] ?? 0);

        // ── Live open task counts by phase (filtered by cluster if selected) ──
        $openTaskBase = WorkflowTask::whereIn('status', ['pending', 'in_progress']);
        if ($clusterOfficeIds !== null) {
            $openTaskBase->whereIn('assigned_office_id', $clusterOfficeIds);
        }
        $inReviewCount   = (clone $openTaskBase)->where('phase', 'review')->count();
        $inApprovalCount = (clone $openTaskBase)->where('phase', 'approval')->count();

        // ── Doctype distribution (unique documents) ───────────────────────────────
        $doctypeQ = DB::table('documents as d')
            ->join('document_versions as dv', 'd.id', '=', 'dv.document_id')
            ->whereIn('dv.id', function($q) {
                $q->selectRaw('MIN(id)')->from('document_versions')->groupBy('document_id');
            })
            ->selectRaw('d.doctype, count(*) as cnt')
            ->groupBy('d.doctype');
        if (!empty($data['date_from'])) $doctypeQ->whereDate('dv.created_at', '>=', $data['date_from']);
        if (!empty($data['date_to']))   $doctypeQ->whereDate('dv.created_at', '<=', $data['date_to']);
        if ($clusterOfficeIds !== null) $doctypeQ->whereIn('d.owner_office_id', $clusterOfficeIds);
        $doctypeDistribution = $doctypeQ->get()->map(fn($r) => [
            'doctype' => $r->doctype ?? 'unknown',
            'count'   => (int) $r->cnt,
        ])->values()->all();

        // ── Creation by office (unique documents, top 10, split by doctype) ──────
        $creationRawQ = DB::table('documents as d')
            ->join('offices as o', 'o.id', '=', 'd.owner_office_id')
            ->selectRaw('o.code as office_code, o.name as office_name, d.doctype, count(*) as cnt')
            ->groupBy('o.code', 'o.name', 'd.doctype')
            ->orderBy('o.code');
        
        if (!empty($data['date_from']) || !empty($data['date_to'])) {
            $creationRawQ->whereIn('d.id', function($q) use ($data) {
                $q->select('document_id')->from('document_versions');
                if (!empty($data['date_from'])) $q->whereDate('created_at', '>=', $data['date_from']);
                if (!empty($data['date_to']))   $q->whereDate('created_at', '<=', $data['date_to']);
            });
        }
        
        if ($clusterOfficeIds !== null) $creationRawQ->whereIn('d.owner_office_id', $clusterOfficeIds);

        $creationRaw = $creationRawQ->get();

        // Aggregate into per-office rows with doctype buckets
        $creationMap = [];
        foreach ($creationRaw as $r) {
            $key = $r->office_code;
            $creationMap[$key] ??= [
                'office_code' => $r->office_code,
                'office_name' => $r->office_name,
                'internal'    => 0,
                'external'    => 0,
                'forms'       => 0,
                'total'       => 0,
            ];
            $doctype = $r->doctype ?? 'internal';
            if (isset($creationMap[$key][$doctype])) {
                $creationMap[$key][$doctype] += (int) $r->cnt;
            }
            $creationMap[$key]['total'] += (int) $r->cnt;
        }

        // Sort by total desc, take top 10
        usort($creationMap, fn($a, $b) => $b['total'] - $a['total']);
        $creationByOffice = array_values(array_slice($creationMap, 0, 10));

        // ── Lifecycle funnel ──────────────────────────────────────────────────────
        $createdVersionIds = $createdRows->pluck('id')->map(fn($id) => (int) $id)->toArray();

        $passedReviewCount = empty($createdVersionIds) ? 0 :
            WorkflowTask::whereIn('document_version_id', $createdVersionIds)
                ->where('phase', 'approval')
                ->distinct('document_version_id')
                ->count('document_version_id');

        $passedApprovalCount = empty($createdVersionIds) ? 0 :
            WorkflowTask::whereIn('document_version_id', $createdVersionIds)
                ->whereIn('phase', ['finalization', 'registration'])
                ->distinct('document_version_id')
                ->count('document_version_id');

        $distributedFunnelCount = empty($createdVersionIds) ? 0 :
            DocumentVersion::whereIn('id', $createdVersionIds)
                ->whereNotNull('distributed_at')
                ->count();

        $cancelledFunnelCount = empty($createdVersionIds) ? 0 :
            DocumentVersion::whereIn('id', $createdVersionIds)
                ->whereIn('status', ['cancelled', 'superseded'])
                ->count();

        $lifecycleFunnel = [
            ['stage' => 'Created',            'count' => count($createdVersionIds)],
            ['stage' => 'Completed Review',   'count' => $passedReviewCount],
            ['stage' => 'Completed Approval', 'count' => $passedApprovalCount],
            ['stage' => 'Distributed',        'count' => $distributedFunnelCount],
            ['stage' => 'Cancelled',          'count' => $cancelledFunnelCount],
        ];

        return response()->json([
            'clusters' => array_values($acc),
            'offices'  => array_values($officeAcc),
            'series'   => $series,

            'volume_series' => $volumeSeries,
            'kpis' => [
                'total_created'        => $totalCreated,
                'total_approved_final' => $totalApprovedFinal,
                'first_pass_yield_pct' => $firstPassYieldPct,
                'pingpong_ratio'       => $pingPongRatio,
                'cycle_time_avg_days'  => $cycleTimeAvgDays,
            ],
            'stage_delays'          => $stageDelays,
            'stage_delays_default'  => $stageDelaysDefault,
            'stage_delays_custom'   => $stageDelaysCustom,
            'stage_delays_by_phase' => $stageDelaysByPhase,
            'phase_distribution'   => $phaseDistribution,
            'waiting_on_qa'      => $waitingOnQa,
            'revision_stats'     => ['docs_on_v2_plus' => $docsOnV2Plus, 'avg_versions' => $avgVersions],
            'routing_split'      => ['default_flow' => $routingDefault, 'custom_flow' => $routingCustom],
            'in_review_count'    => $inReviewCount,
            'in_approval_count'  => $inApprovalCount,
            'doctype_distribution' => $doctypeDistribution,
            'creation_by_office'   => $creationByOffice,
            'lifecycle_funnel'     => $lifecycleFunnel,
        ]);
    }

    // GET /api/reports/activity
    public function activity(Request $request)
    {
        $user     = $request->user();
        $roleName = $this->roleNameOf($user);
        $qaOfficeId = (int) ($this->clusterAnalysis->officeIdByCode('QA') ?? 0);
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $isQA = ($roleName === 'qa') || ($qaOfficeId && $userOfficeId === $qaOfficeId);
        $isAdmin = in_array($roleName, ['admin', 'sysadmin'], true);
        $isOfficeHead = ($roleName === 'office_head');
        $isOfficeStaff = ($roleName === 'office_staff');

        if (!$isQA && !$isAdmin && !$isOfficeHead && !$isOfficeStaff) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'date_from'  => 'nullable|date',
            'date_to'    => 'nullable|date',
            'days'       => 'nullable|integer|min:7|max:30',
            'office_id'  => 'nullable|integer|exists:offices,id',
            'parent'     => 'nullable|in:ALL,PO,VAd,VA,VF,VR',
        ]);

        $officeId = null;
        if (($isOfficeHead || $isOfficeStaff) && $userOfficeId) {
            // Hardlock Office users to their own office stats
            $officeId = $userOfficeId;
        } elseif (isset($data['office_id'])) {
            $officeId = (int) $data['office_id'];
        }

        $stats = $this->activityReport->getActivityStats([
            'date_from' => $data['date_from'] ?? null,
            'date_to'   => $data['date_to'] ?? null,
            'days'      => $data['days'] ?? 14,
            'office_id' => $officeId,
        ]);

        return response()->json($stats);
    }

    // GET /api/reports/flow-health
    public function flowHealth(Request $request)
    {
        $user     = $request->user();
        $roleName = $this->roleNameOf($user);
        $qaOfficeId = (int) ($this->clusterAnalysis->officeIdByCode('QA') ?? 0);
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $isQA = ($roleName === 'qa') || ($qaOfficeId && $userOfficeId === $qaOfficeId);
        $isAdmin = in_array($roleName, ['admin', 'sysadmin'], true);
        $isOfficeHead = ($roleName === 'office_head');
        $isOfficeStaff = ($roleName === 'office_staff');

        if (!$isQA && !$isAdmin && !$isOfficeHead && !$isOfficeStaff) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'date_from'  => 'nullable|date',
            'date_to'    => 'nullable|date',
            'date_field' => 'nullable|in:created,completed',
            'parent'     => 'nullable|in:ALL,PO,VAd,VA,VF,VR',
            'bucket'     => 'nullable|in:daily,weekly,monthly,yearly,total',
            'office_id'  => 'nullable|integer|exists:offices,id',
        ]);
        $dateField  = $data['date_field'] ?? 'completed';
        $dateColumn = $dateField === 'created' ? 'created_at' : 'completed_at';
        $parent     = $data['parent'] ?? 'ALL';
        $bucket     = $data['bucket'] ?? 'monthly';

        // Resolve office IDs for filtering — single office, cluster, or office_head scoped to own office
        $officeIdFilter = isset($data['office_id']) ? (int) $data['office_id'] : null;
        $clusterOfficeIds = null;

        $role = $this->roleNameOf($user);
        $isVP = in_array($role, ['vpaa', 'vpad', 'vpf', 'vpr'], true);

        if ($isVP) {
            $vpMap = ['vpaa' => 'VA', 'vpad' => 'VAd', 'vpf' => 'VF', 'vpr' => 'VR'];
            $parent = $vpMap[$role] ?? 'ALL';
            if ($officeIdFilter) {
                $clusterIds = $this->clusterAnalysis->officeIdsForCluster($parent);
                $clusterOfficeIds = in_array($officeIdFilter, $clusterIds) ? [$officeIdFilter] : [0];
            } else {
                $clusterOfficeIds = $this->clusterAnalysis->officeIdsForCluster($parent);
            }
        } elseif (($isOfficeHead || $isOfficeStaff) && $userOfficeId) {
            $clusterOfficeIds = [$userOfficeId];
            $parent = 'ALL';
        } else {
            if ($officeIdFilter) {
                $clusterOfficeIds = [$officeIdFilter];
            } elseif ($parent !== 'ALL') {
                $clusterOfficeIds = $this->clusterAnalysis->officeIdsForCluster($parent);
            }
        }

        // ── Return by stage ───────────────────────────────────────────────────
        $taskQuery = WorkflowTask::query()
            ->whereIn('status', ['returned', 'rejected', 'completed'])
            ->whereNotNull('step');
        if (!empty($data['date_from'])) $taskQuery->whereDate($dateColumn, '>=', $data['date_from']);
        if (!empty($data['date_to']))   $taskQuery->whereDate($dateColumn, '<=', $data['date_to']);
        if ($clusterOfficeIds !== null) $taskQuery->whereIn('assigned_office_id', $clusterOfficeIds);
        $allTasks = $taskQuery->get(['step', 'status', $dateColumn]);

        $stageGroups = WorkflowSteps::reportStageGroups();
        $byStage = [];
        foreach ($stageGroups as $stageName => $steps) {
            $byStage[$stageName] = ['stage' => $stageName, 'returns' => 0, 'total' => 0];
        }
        foreach ($allTasks as $t) {
            foreach ($stageGroups as $stageName => $steps) {
                if (in_array($t->step, $steps, true)) {
                    $byStage[$stageName]['total']++;
                    if (in_array($t->status, ['returned', 'rejected'], true)) {
                        $byStage[$stageName]['returns']++;
                    }
                    break;
                }
            }
        }
        $returnByStage = array_values(array_filter($byStage, fn ($s) => $s['total'] > 0));

        // ── Return trend (monthly) ─────────────────────────────────────────────
        $actorByStep = [
            'Office'    => ['qa_office_review', 'office_head_review', 'custom_office_review',
                            'qa_office_approval', 'office_head_approval', 'custom_office_approval'],
            'VP'        => ['qa_vp_review', 'qa_vp_approval', 'office_vp_review', 'office_vp_approval'],
            'President' => ['qa_pres_approval', 'office_pres_approval'],
            'QA'        => ['qa_review_final_check', 'qa_approval_final_check',
                            'office_review_final_check', 'office_approval_final_check',
                            'custom_review_back_to_owner', 'custom_approval_back_to_owner'],
        ];
        $stepToActor = [];
        foreach ($actorByStep as $actor => $steps) {
            foreach ($steps as $step) $stepToActor[$step] = $actor;
        }

        // Bucket → Carbon format + seed window
        $bucketFmt = match ($bucket) {
            'daily'   => 'Y-m-d',
            'weekly'  => 'Y-W',
            'yearly'  => 'Y',
            'total'   => 'total',
            default   => 'Y-m',  // monthly
        };
        $seedPeriods = match ($bucket) {
            'daily'   => 30,
            'weekly'  => 12,
            'yearly'  => 5,
            'total'   => 0,
            default   => 6,
        };

        $trendAcc = [];
        $emptyRow = fn ($lbl) => ['label' => $lbl, 'Office' => 0, 'VP' => 0, 'President' => 0, 'QA' => 0];

        if ($bucketFmt !== 'total') {
            for ($i = ($seedPeriods - 1); $i >= 0; $i--) {
                $label = match ($bucket) {
                    'daily'  => \Carbon\Carbon::now()->subDays($i)->format($bucketFmt),
                    'weekly' => \Carbon\Carbon::now()->subWeeks($i)->format($bucketFmt),
                    'yearly' => \Carbon\Carbon::now()->subYears($i)->format($bucketFmt),
                    default  => \Carbon\Carbon::now()->subMonths($i)->format($bucketFmt),
                };
                $trendAcc[$label] = $emptyRow($label);
            }
        } else {
            $trendAcc['All time'] = $emptyRow('All time');
        }

        $returnedQuery = WorkflowTask::query()
            ->whereIn('status', ['returned', 'rejected'])
            ->whereNotNull('completed_at')
            ->whereNotNull('step');
        if ($clusterOfficeIds !== null) $returnedQuery->whereIn('assigned_office_id', $clusterOfficeIds);
        $returnedTasks = $returnedQuery->get(['step', 'completed_at']);

        foreach ($returnedTasks as $t) {
            $label = $bucketFmt === 'total'
                ? 'All time'
                : \Carbon\Carbon::parse($t->completed_at)->format($bucketFmt);
            if (!isset($trendAcc[$label])) {
                $trendAcc[$label] = $emptyRow($label);
            }
            $actor = $stepToActor[$t->step] ?? null;
            if ($actor) $trendAcc[$label][$actor]++;
        }
        $returnTrend = array_values($trendAcc);
        if ($bucketFmt !== 'total') {
            usort($returnTrend, fn ($a, $b) => strcmp($a['label'], $b['label']));
        }

        // ── Bottleneck (current pending tasks) ─────────────────────────────────
        $bottleneckQuery = WorkflowTask::query()
            ->whereIn('status', ['pending', 'in_progress'])
            ->whereNotNull('assigned_office_id')
            ->whereNotNull('opened_at')
            ->with('assignedOffice:id,name');
        if ($clusterOfficeIds !== null) $bottleneckQuery->whereIn('assigned_office_id', $clusterOfficeIds);
        $pendingTasks = $bottleneckQuery->get(['assigned_office_id', 'opened_at']);

        $bottleneckAcc = [];
        $now = \Carbon\Carbon::now();
        foreach ($pendingTasks as $t) {
            $oid = (int) $t->assigned_office_id;
            $bottleneckAcc[$oid] ??= [
                'office'      => $t->assignedOffice?->name ?? "Office #$oid",
                'total_hours' => 0,
                'task_count'  => 0,
            ];
            $bottleneckAcc[$oid]['total_hours'] += \Carbon\Carbon::parse($t->opened_at)->diffInHours($now);
            $bottleneckAcc[$oid]['task_count']++;
        }
        $bottleneck = collect($bottleneckAcc)
            ->map(fn ($row) => [
                'office'     => $row['office'],
                'avg_hours'  => $row['task_count'] ? round($row['total_hours'] / $row['task_count'], 1) : 0,
                'task_count' => $row['task_count'],
            ])
            ->sortByDesc('avg_hours')
            ->values()
            ->all();

        return response()->json([
            'return_by_stage' => $returnByStage,
            'return_trend'    => $returnTrend,
            'bottleneck'      => $bottleneck,
        ]);
    }

    // GET /api/reports/requests
    public function requests(Request $request)
    {
        $user     = $request->user();
        $roleName = $this->roleNameOf($user);
        $qaOfficeId = (int) ($this->clusterAnalysis->officeIdByCode('QA') ?? 0);
        $userOfficeId = (int) ($user?->office_id ?? 0);
        $isQA    = ($roleName === 'qa') || ($qaOfficeId && $userOfficeId === $qaOfficeId);
        $isAdmin = in_array($roleName, ['admin', 'sysadmin'], true);
        $isOfficeHead = ($roleName === 'office_head');
        $isOfficeStaff = ($roleName === 'office_staff');

        if (!$isQA && !$isAdmin && !$isOfficeHead && !$isOfficeStaff) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'date_from' => 'nullable|date',
            'date_to'   => 'nullable|date',
            'bucket'    => 'nullable|in:daily,weekly,monthly,yearly,total',
        ]);
        $bucket   = $data['bucket'] ?? 'monthly';
        $dateFrom = $data['date_from'] ?? null;
        $dateTo   = $data['date_to'] ?? null;

        $reqQuery = DocumentRequest::query();
        if ($dateFrom) $reqQuery->whereDate('created_at', '>=', $dateFrom);
        if ($dateTo)   $reqQuery->whereDate('created_at', '<=', $dateTo);
        // Office heads/staff see only requests where their office is a recipient
        if (($isOfficeHead || $isOfficeStaff) && $userOfficeId) {
            $reqQuery->whereHas('recipients', fn ($q) => $q->where('office_id', $userOfficeId));
        }
        $requests = $reqQuery->get(['id', 'status', 'mode', 'due_at', 'created_at']);

        $total     = $requests->count();
        $open      = $requests->where('status', 'open')->count();
        $closed    = $requests->where('status', 'closed')->count();
        $cancelled = $requests->where('status', 'cancelled')->count();
        $overdue   = $requests->where('status', 'open')
            ->filter(fn ($r) => $r->due_at && \Carbon\Carbon::parse($r->due_at)->isPast())
            ->count();

        $requestIds = $requests->pluck('id')->toArray();
        $recipients = DocumentRequestRecipient::query()
            ->whereIn('request_id', $requestIds)
            ->with(['submissions', 'office:id,name'])
            ->get(['id', 'request_id', 'status', 'office_id']);

        $totalRecipients = $recipients->count();
        $submitted       = $recipients->filter(fn ($r) => $r->submissions->isNotEmpty())->count();
        $accepted        = $recipients->where('status', 'accepted')->count();
        $rejected        = $recipients->where('status', 'rejected')->count();
        $acceptanceRate  = $submitted ? round(($accepted / $submitted) * 100) : 0;
        $avgResubmissions = $recipients->count()
            ? round($recipients->avg(fn ($r) => $r->submissions->count()), 1)
            : 0;

        // Attempt distribution
        $submissionCounts = $recipients->map(fn ($r) => $r->submissions->count());
        $attempt1    = $submissionCounts->filter(fn ($c) => $c === 1)->count();
        $attempt2    = $submissionCounts->filter(fn ($c) => $c === 2)->count();
        $attempt3plus = $submissionCounts->filter(fn ($c) => $c >= 3)->count();

        // Mode split
        $multiOffice = $requests->filter(fn ($r) => $r->isMultiOffice())->count();
        $multiDoc    = $requests->filter(fn ($r) => $r->isMultiDoc())->count();

        // Volume series
        $bucketLabel = function (?string $iso) use ($bucket): ?string {
            if (!$iso) return null;
            $dt = \Carbon\Carbon::parse($iso);
            return match ($bucket) {
                'total'   => 'Total',
                'daily'   => $dt->format('Y-m-d'),
                'weekly'  => $dt->copy()->startOfWeek(\Carbon\Carbon::MONDAY)->format('Y-m-d'),
                'yearly'  => $dt->format('Y'),
                default   => $dt->format('Y-m'),
            };
        };
        $volumeAcc = [];
        if ($bucket === 'monthly' && !$dateFrom) {
            for ($i = 5; $i >= 0; $i--) {
                $l = \Carbon\Carbon::now()->subMonths($i)->format('Y-m');
                $volumeAcc[$l] = ['label' => $l, 'created' => 0, 'approved_final' => 0];
            }
        }
        foreach ($requests as $r) {
            $l = $bucketLabel($r->created_at?->toISOString());
            if (!$l) continue;
            $volumeAcc[$l] ??= ['label' => $l, 'created' => 0, 'approved_final' => 0];
            $volumeAcc[$l]['created']++;
            if ($r->status === 'closed') $volumeAcc[$l]['approved_final']++;
        }
        $volumeSeries = array_values($volumeAcc);
        usort($volumeSeries, fn ($a, $b) => strcmp($a['label'], $b['label']));

        // Office acceptance rate
        $officeAcc = [];
        foreach ($recipients as $r) {
            $oid  = (int) $r->office_id;
            $name = $r->office?->name ?? "Office #$oid";
            $officeAcc[$oid] ??= ['office' => $name, 'sent' => 0, 'accepted' => 0, 'rejected' => 0];
            $officeAcc[$oid]['sent']++;
            if ($r->status === 'accepted') $officeAcc[$oid]['accepted']++;
            if ($r->status === 'rejected') $officeAcc[$oid]['rejected']++;
        }
        $officeAcceptance = collect($officeAcc)
            ->map(fn ($row) => [
                ...$row,
                'rate' => $row['sent'] ? round(($row['accepted'] / $row['sent']) * 100) : 0,
            ])
            ->sortBy('rate')
            ->values()
            ->all();

        return response()->json([
            'kpis' => [
                'total'              => $total,
                'open'               => $open,
                'closed'             => $closed,
                'cancelled'          => $cancelled,
                'acceptance_rate'    => $acceptanceRate,
                'avg_resubmissions'  => $avgResubmissions,
                'overdue'            => $overdue,
            ],
            'status_distribution' => [
                ['phase' => 'Open',      'count' => $open],
                ['phase' => 'Closed',    'count' => $closed],
                ['phase' => 'Cancelled', 'count' => $cancelled],
            ],
            'funnel' => [
                ['stage' => 'Recipients sent', 'count' => $totalRecipients, 'color' => '#94a3b8'],
                ['stage' => 'Submitted',       'count' => $submitted,       'color' => '#38bdf8'],
                ['stage' => 'Accepted',        'count' => $accepted,        'color' => '#34d399'],
                ['stage' => 'Rejected',        'count' => $rejected,        'color' => '#f43f5e'],
            ],
            'attempt_distribution' => [
                ['attempt' => '1st pass',      'count' => $attempt1],
                ['attempt' => '2nd attempt',   'count' => $attempt2],
                ['attempt' => '3rd+ attempt',  'count' => $attempt3plus],
            ],
            'mode_split'       => ['multi_office' => $multiOffice, 'multi_doc' => $multiDoc],
            'volume_series'    => $volumeSeries,
            'office_acceptance' => $officeAcceptance,
        ]);
    }
}
