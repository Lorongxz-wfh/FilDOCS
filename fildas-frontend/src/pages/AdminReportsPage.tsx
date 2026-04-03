import React, { useEffect, useState } from "react";
import PageFrame from "../components/layout/PageFrame";
import Alert from "../components/ui/Alert";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import ReportStatCard from "../components/reports/ReportStatCard";
import ReportChartCard from "../components/reports/ReportChartCard";
import VolumeTrendChart from "../components/charts/VolumeTrendChart";
import PhaseDistributionChart from "../components/charts/PhaseDistributionChart";
import StageDelayChart from "../components/charts/StageDelayChart";
import ActivityDistributionChart from "../components/charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../components/charts/DailyActivityStackedBarChart";
import {
  getComplianceReport,
} from "../services/documents";
import {
  getAdminDashboardStats,
  getActivityReport,
} from "../services/reportsApi";
import type { ActivityReportResponse } from "../services/types";
import type {
  ComplianceKpis,
  ComplianceVolumeSeriesDatum,
  ComplianceOfficeDatum,
  ComplianceStageDelayDatum,
  AdminDashboardStats,
} from "../services/documents";
import Skeleton from "../components/ui/loader/Skeleton";
import SelectDropdown from "../components/ui/SelectDropdown";

import { filterSelectCls, tabCls } from "../utils/formStyles";
import {
  FileText,
  CheckCircle2,
  Activity,
  Clock,
  Users,
  Building2,
  SlidersHorizontal,
  X,
  Wifi,
  Percent,
  RotateCcw,
  AlertCircle,
  History,
  UserCheck,
  UserX,
} from "lucide-react";

type Tab = "overview" | "offices" | "users" | "activity";
type Bucket = "daily" | "weekly" | "monthly" | "yearly" | "total";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "offices", label: "By Office" },
  { key: "users", label: "Users" },
  { key: "activity", label: "Activity" },
];

// ── Office table ─────────────────────────────────────────────────────────────
const OfficeTable: React.FC<{ rows: ComplianceOfficeDatum[] }> = ({ rows }) => {
  const sorted = [...rows].sort((a, b) => b.in_review - a.in_review);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-surface-400">
            {["Office", "In review", "Approved", "Approval %", "Returned"].map((h) => (
              <th
                key={h}
                className="pb-3 pr-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-surface-400">
          {sorted.length === 0 ? (
            <tr>
              <td colSpan={5} className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                No data for selected filters
              </td>
            </tr>
          ) : (
            sorted.map((row) => {
              const total = row.in_review + row.approved + row.returned;
              const approvalRate = total ? Math.round((row.approved / total) * 100) : 0;
              return (
                <tr key={row.office_id} className="hover:bg-slate-50 dark:hover:bg-surface-400 transition">
                  <td className="py-2.5 pr-6 font-medium text-slate-900 dark:text-slate-100">
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mr-1.5">
                      {row.office_code}
                    </span>
                  </td>
                  <td className="py-2.5 pr-6 tabular-nums text-slate-700 dark:text-slate-300">{row.in_review}</td>
                  <td className="py-2.5 pr-6 tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">{row.approved}</td>
                  <td className="py-2.5 pr-6">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100 dark:bg-surface-400">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{ width: `${approvalRate}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400">{approvalRate}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-6 tabular-nums text-rose-500 dark:text-rose-400">{row.returned}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const AdminReportsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("overview");
  const [bucket, setBucket] = useState<Bucket>("monthly");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data
  const [volumeSeries, setVolumeSeries] = useState<ComplianceVolumeSeriesDatum[]>([]);
  const [officeData, setOfficeData] = useState<ComplianceOfficeDatum[]>([]);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [activityReport, setActivityReport] = useState<ActivityReportResponse | null>(null);
  const [kpis, setKpis] = useState<ComplianceKpis>({ total_created: 0, total_approved_final: 0, first_pass_yield_pct: 0, pingpong_ratio: 0, cycle_time_avg_days: 0 });
  const [phaseDist, setPhaseDist] = useState<{ phase: string; count: number }[]>([]);
  const [stageDelays, setStageDelays] = useState<ComplianceStageDelayDatum[]>([]);

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const [report, stats, activity] = await Promise.all([
        getComplianceReport({
          bucket,
          scope: "offices",
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        }),
        getAdminDashboardStats(),
        getActivityReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        })
      ]);
      setVolumeSeries(report.volume_series);
      setOfficeData(report.offices);
      setAdminStats(stats);
      setActivityReport(activity);
      setKpis((prev) => report.kpis ?? prev);
      setPhaseDist(report.phase_distribution ?? []);
      setStageDelays(report.stage_delays_by_phase ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [bucket, dateFrom, dateTo, refreshKey]); // eslint-disable-line

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setBucket("monthly");
  };

  const activeFilterCount = [
    bucket !== "monthly",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;


  return (
    <PageFrame
      title="Reports"
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
      right={
        <PageActions>
          <RefreshAction
            loading={loading}
            onRefresh={async () => {
              setRefreshKey((k) => k + 1);
              return "Report data refreshed.";
            }}
          />
        </PageActions>
      }
    >
      {error && (
        <div className="shrink-0 px-4 pt-3">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {/* Tab nav */}
      <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={tabCls(tab === t.key)}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-3 -mb-px">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500 transition-colors"
          >
            <SlidersHorizontal size={12} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content + filter panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Scrollable main content */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4 sm:p-5">

            {/* ── Overview tab ──────────────────────────────────────────────── */}
            {tab === "overview" && (
              <>
                {/* Row 1 — System stat cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <ReportStatCard
                    label="Documents created"
                    value={loading ? <Skeleton className="h-8 w-12" /> : kpis.total_created}
                    sub="In selected period"
                    color="default"
                    icon={<FileText size={16} />}
                  />
                  <ReportStatCard
                    label="Distributed"
                    value={loading ? <Skeleton className="h-8 w-12" /> : kpis.total_approved_final}
                    sub={kpis.total_created ? `${Math.round((kpis.total_approved_final / kpis.total_created) * 100)}% completion rate` : "In selected period"}
                    color="emerald"
                    icon={<CheckCircle2 size={16} />}
                  />
                  <ReportStatCard
                    label="In progress"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.documents.in_progress ?? 0)}
                    sub="Currently active"
                    color="sky"
                    icon={<Activity size={16} />}
                  />
                  <ReportStatCard
                    label="Total users"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.users.total ?? 0)}
                    sub={`${adminStats?.users.active ?? 0} accounts enabled`}
                    color="default"
                    icon={<Users size={16} />}
                  />
                  <ReportStatCard
                    label="Online now"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.users.online ?? 0)}
                    sub="Active in last 30 minutes"
                    color="emerald"
                    icon={<Wifi size={16} />}
                  />
                  <ReportStatCard
                    label="Total offices"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.offices.total ?? 0)}
                    sub={`${adminStats?.offices.active ?? 0} active`}
                    color="violet"
                    icon={<Building2 size={16} />}
                  />
                </div>

                {/* Row 2 — Quality KPI strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ReportStatCard
                    label="First-pass yield"
                    value={loading ? <Skeleton className="h-8 w-12" /> : `${kpis.first_pass_yield_pct}%`}
                    sub="Distributed with zero returns"
                    color="emerald"
                    icon={<Percent size={16} />}
                  />
                  <ReportStatCard
                    label="Avg cycle time"
                    value={loading ? <Skeleton className="h-8 w-12" /> : `${kpis.cycle_time_avg_days}d`}
                    sub="Draft to distributed"
                    color="sky"
                    icon={<Clock size={16} />}
                  />
                  <ReportStatCard
                    label="Ping-pong ratio"
                    value={loading ? <Skeleton className="h-8 w-12" /> : kpis.pingpong_ratio}
                    sub="Avg returns per document"
                    color="rose"
                    icon={<RotateCcw size={16} />}
                  />
                </div>

                {/* Row 3 — Volume trend + Phase donut */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div className="lg:col-span-2">
                    <ReportChartCard
                      title={`Document volume · ${bucket}`}
                      subtitle="Created vs distributed per period."
                      loading={loading}
                    >
                      <VolumeTrendChart data={volumeSeries} height={220} loading={loading} />
                    </ReportChartCard>
                  </div>
                  <div className="lg:col-span-1">
                    <ReportChartCard
                      title="Documents by phase"
                      subtitle="Current status of documents in selected period."
                      loading={loading}
                    >
                      <PhaseDistributionChart
                        data={phaseDist}
                        variant="donut"
                        height={220}
                      />
                    </ReportChartCard>
                  </div>
                </div>

                {/* Row 4 — Activity Distribution + Stage Delays */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <ReportChartCard
                    title="Activity Distribution"
                    subtitle="System actions by category in selected period."
                    loading={loading}
                  >
                    <ActivityDistributionChart 
                      data={activityReport?.distribution ?? []} 
                      height={180} 
                      loading={loading} 
                    />
                  </ReportChartCard>
                  <ReportChartCard
                    title="Stage delay by phase"
                    subtitle="Median task hold time per workflow phase."
                    loading={loading}
                  >
                    <StageDelayChart data={stageDelays} height={180} loading={loading} />
                  </ReportChartCard>
                </div>

                {/* Row 5 — Daily Activity Trend */}
                <ReportChartCard
                  title="Daily Activity Trend"
                  subtitle="System actions categorized over the selected period."
                  loading={loading}
                >
                  <DailyActivityStackedBarChart 
                    data={activityReport?.daily_trend ?? []} 
                    height={220} 
                    loading={loading} 
                  />
                </ReportChartCard>
              </>
            )}

            {/* ── By Office tab ─────────────────────────────────────────────── */}
            {tab === "offices" && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ReportStatCard
                    label="Total offices"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.offices.total ?? 0)}
                    sub={`${adminStats?.offices.active ?? 0} active`}
                    color="default"
                    icon={<Building2 size={16} />}
                  />
                  <ReportStatCard
                    label="With active docs"
                    value={loading ? <Skeleton className="h-8 w-12" /> : officeData.filter((o) => o.in_review + o.approved + o.returned > 0).length}
                    sub="Offices participating"
                    color="sky"
                    icon={<FileText size={16} />}
                  />
                </div>

                <ReportChartCard
                  title="Office document breakdown"
                  subtitle="Documents in review, approved, and returned per office."
                  loading={loading}
                >
                  {loading ? (
                    <Skeleton className="h-64 w-full rounded-xl" />
                  ) : (
                    <OfficeTable rows={officeData} />
                  )}
                </ReportChartCard>
              </>
            )}

            {/* ── Users tab ─────────────────────────────────────────────── */}
            {tab === "users" && (
              <>
                {/* KPI row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ReportStatCard
                    label="Total users"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.users.total ?? 0)}
                    sub="Registered accounts"
                    color="default"
                    icon={<Users size={16} />}
                  />
                  <ReportStatCard
                    label="Active users"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.users.active ?? 0)}
                    sub="Enabled accounts"
                    color="emerald"
                    icon={<UserCheck size={16} />}
                  />
                  <ReportStatCard
                    label="Disabled users"
                    value={loading ? <Skeleton className="h-8 w-12" /> : (adminStats?.users.inactive ?? 0)}
                    sub="Inactive / suspended"
                    color="default"
                    icon={<UserX size={16} />}
                  />
                </div>

                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {/* Users by role */}
                  <ReportChartCard
                    title="Users by Role"
                    subtitle="Account count per system role"
                    loading={loading}
                  >
                    <div className="flex flex-col gap-0">
                      <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-slate-100 dark:border-surface-400">
                        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Role</span>
                        <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Count</span>
                      </div>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2 px-1 py-2 border-b border-slate-50 dark:border-surface-400/50">
                            <div className="flex-1 h-3 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
                            <div className="w-8 h-3 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
                          </div>
                        ))
                      ) : (adminStats?.users.by_role ?? []).length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">No data</p>
                      ) : (
                        [...(adminStats?.users.by_role ?? [])]
                          .sort((a, b) => b.count - a.count)
                          .map((r, i) => {
                            const max = Math.max(...(adminStats?.users.by_role ?? []).map((x) => x.count), 1);
                            return (
                              <div key={i} className="flex items-center gap-2 px-1 py-2 border-b border-slate-50 dark:border-surface-400/50 last:border-0">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{r.role}</span>
                                  </div>
                                  <div className="h-1 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-brand-500"
                                      style={{ width: `${Math.round((r.count / max) * 100)}%` }}
                                    />
                                  </div>
                                </div>
                                <span className="w-12 shrink-0 text-right text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100">
                                  {r.count}
                                </span>
                              </div>
                            );
                          })
                      )}
                    </div>
                  </ReportChartCard>

                  {/* Recent users */}
                  <ReportChartCard
                    title="Recently Registered"
                    subtitle="Newest accounts in the system"
                    loading={loading}
                  >
                    <div className="flex flex-col gap-0">
                      <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-slate-100 dark:border-surface-400">
                        <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">User</span>
                        <span className="w-16 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</span>
                      </div>
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <div key={i} className="flex items-center gap-2 px-1 py-2.5 border-b border-slate-50 dark:border-surface-400/50">
                            <div className="flex-1 space-y-1">
                              <div className="h-3 w-32 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
                              <div className="h-2.5 w-20 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
                            </div>
                            <div className="w-12 h-4 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
                          </div>
                        ))
                      ) : (adminStats?.users.recent ?? []).length === 0 ? (
                        <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">No users yet</p>
                      ) : (
                        (adminStats?.users.recent ?? []).map((u, i) => (
                          <div key={i} className="flex items-center gap-2 px-1 py-2.5 border-b border-slate-50 dark:border-surface-400/50 last:border-0">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">{u.name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{u.role}{u.office_name ? ` · ${u.office_name}` : ""}</p>
                            </div>
                            <span className={`w-16 shrink-0 text-right text-[10px] font-semibold ${u.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"}`}>
                              {u.is_active ? "Active" : "Disabled"}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </ReportChartCard>
                </div>
              </>
            )}

            {/* ── Activity tab (DETAILED) ─────────────────────────────────── */}
            {tab === "activity" && (
              <div className="flex flex-col gap-6">
                {/* Categorical Breakdown + Top Actors Row */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  <div className="lg:col-span-1">
                    <ReportChartCard
                      title="Top System Actors"
                      subtitle="Users with most actions recorded."
                      loading={loading}
                    >
                      <div className="flex flex-col gap-0 max-h-[400px] overflow-y-auto pr-1">
                        <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-slate-100 dark:border-surface-400">
                          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">User</span>
                          <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Actions</span>
                        </div>
                        <div className="divide-y divide-slate-50 dark:divide-surface-500 mt-1">
                          {activityReport?.top_actors.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">No activity found</p>
                          ) : (
                            activityReport?.top_actors.map((u) => (
                              <div key={u.user_id} className="flex items-center gap-2 px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-surface-600/50 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{u.full_name}</p>
                                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{u.office}</p>
                                </div>
                                <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">{u.count}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="lg:col-span-2">
                    <ReportChartCard
                      title="Activity distribution"
                      subtitle="Percentage of system actions by operational category."
                      loading={loading}
                    >
                      <ActivityDistributionChart 
                        data={activityReport?.distribution ?? []} 
                        height={350} 
                        loading={loading} 
                      />
                    </ReportChartCard>
                  </div>
                </div>

                {/* Full-width Stacked Trend */}
                <ReportChartCard
                  title="System activity trend"
                  subtitle="Detailed daily breakdown of platform interactions."
                  loading={loading}
                >
                  <DailyActivityStackedBarChart 
                    data={activityReport?.daily_trend ?? []} 
                    height={300} 
                    loading={loading} 
                  />
                </ReportChartCard>

                {/* Analysis Insights Summary */}
                <div className="space-y-4 pt-1">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20 p-4 border border-indigo-100 dark:border-indigo-900/30 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-tight">
                        <Activity size={15} /> Workflows
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Includes document creation, metadata updates, task completions, and routing. High volume indicates active document processing.
                      </p>
                    </div>
                    <div className="rounded-xl bg-amber-50/30 dark:bg-amber-950/20 p-4 border border-amber-100 dark:border-amber-900/30 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300 font-bold text-xs uppercase tracking-tight">
                        <Clock size={15} /> Access
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Tracks login events, failed attempts, and password changes. Critical for auditing security patterns and peak usage.
                      </p>
                    </div>
                    <div className="rounded-xl bg-emerald-50/30 dark:bg-emerald-950/20 p-4 border border-emerald-100 dark:border-emerald-900/30 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2 mb-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs uppercase tracking-tight">
                        <CheckCircle2 size={15} /> System
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Administrative actions like user management, office hierarchy tweaks, announcements, and global system updates.
                      </p>
                    </div>
                    <div className="rounded-xl bg-slate-50/30 dark:bg-surface-400/10 p-4 border border-slate-100 dark:border-surface-400/30 hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-2 mb-2 text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-tight">
                        <History size={15} /> Others
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                        Miscellaneous events including profile photo removals, notification dismissals, and automated background cleanup.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10 p-4 flex gap-3 items-start shadow-sm mt-4">
                    <AlertCircle size={16} className="text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-bold text-blue-900 dark:text-blue-200 mb-0.5">Audit Note</p>
                      <p className="text-[11px] text-blue-800 dark:text-blue-300/80 leading-relaxed">
                        System activity reporting synchronizes with the Admin Dashboard only for the 'Last 14 Days' view. For historical auditing, use the date range filters on this page to isolate specific periods of interest.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Collapsible filter panel */}
        {filtersOpen && (
          <aside className="w-56 shrink-0 border-l border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-y-auto flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-surface-400">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                    {activeFilterCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-[11px] font-medium text-brand-500 dark:text-brand-400 hover:underline"
                  >
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-5 p-4">

              {/* Group by */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Group by</p>
                <SelectDropdown
                  value={bucket}
                  onChange={(val) => setBucket(val as Bucket)}
                  className="w-full"
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly" },
                    { value: "monthly", label: "Monthly" },
                    { value: "yearly", label: "Yearly" },
                    { value: "total", label: "Total" },
                  ]}
                />
              </div>

              {/* Date range */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Date range</p>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">From</p>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className={filterSelectCls}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">To</p>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className={filterSelectCls}
                    />
                  </div>
                </div>
              </div>

            </div>
          </aside>
        )}
      </div>
    </PageFrame>
  );
};

export default AdminReportsPage;
