import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { getUserRole, isQA } from "../lib/roleFilters";
import api from "../services/api";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import RefreshButton from "../components/ui/RefreshButton";
import ReportChartCard from "../components/reports/ReportChartCard";
import VolumeTrendChart from "../components/charts/VolumeTrendChart";
import PhaseDistributionChart from "../components/charts/PhaseDistributionChart";
import StageDelayChart from "../components/charts/StageDelayChart";
import DocumentTypeChart from "../components/charts/DocumentTypeChart";
import OfficeCreationChart from "../components/charts/OfficeCreationChart";
import WorkflowFunnelChart from "../components/charts/WorkflowFunnelChart";
import ActivityDistributionChart from "../components/charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../components/charts/DailyActivityStackedBarChart";
import Skeleton from "../components/ui/loader/Skeleton";
import {
  getComplianceReport,
  type ComplianceKpis,
  type ComplianceVolumeSeriesDatum,
  type ComplianceStageDelayDatum,
} from "../services/documents";
import { getRequestsReport, getActivityReport } from "../services/reportsApi";
import type { RequestsReport, ActivityReportResponse } from "../services/types";
import { SlidersHorizontal, X, FileText, CheckCircle2, Activity, Clock, RotateCcw, Percent, Send, Ban, AlertCircle, TrendingUp, History } from "lucide-react";
import { filterSelectCls } from "../utils/formStyles";

// ── Types ──────────────────────────────────────────────────────────────────────

type Bucket = "daily" | "weekly" | "monthly" | "yearly" | "total";
type Parent = "ALL" | "PO" | "VAd" | "VA" | "VF" | "VR";
type DateField = "completed" | "created";
type Scope = "clusters" | "offices";
type Tab = "overview" | "workflow" | "requests" | "activity";

// ── Tab configs ────────────────────────────────────────────────────────────────

const TABS_QA: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "workflow", label: "Workflow" },
  { key: "requests", label: "Requests" },
  { key: "activity", label: "Activity" },
];

const TABS_OFFICE_HEAD: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "workflow", label: "Workflow" },
];

const TABS_ADMIN: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "requests", label: "Requests" },
  { key: "activity", label: "Activity" },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
}> = ({ label, value, sub, icon, iconBg, loading }) => (
  <div className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2.5 sm:px-4 sm:py-3.5 flex items-center gap-3 sm:gap-4 shadow-sm">
    <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-md ${iconBg} scale-90 sm:scale-100`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      {loading ? (
        <div className="space-y-1">
          <Skeleton className="h-4 w-12 sm:h-5 sm:w-16" />
          <Skeleton className="h-2 w-20 sm:h-3 sm:w-24" />
        </div>
      ) : (
        <div className="flex flex-col sm:block">
          <p className="text-base sm:text-xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
            {value}
          </p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
            {label}
          </p>
        </div>
      )}
    </div>
    <p className="hidden sm:block shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400 text-right leading-tight max-w-[5rem]">
      {sub}
    </p>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const me = useAuthUser();
  const role = getUserRole();
  const qaMode = isQA(role);
  const isOfficeHead = role === "OFFICE_HEAD";
  const TABS = qaMode ? TABS_QA : isOfficeHead ? TABS_OFFICE_HEAD : TABS_ADMIN;

  const tabContentRef = React.useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("overview");

  // ── Filter state ─────────────────────────────────────────────────────────────

  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [bucket, setBucket] = React.useState<Bucket>("monthly");
  const [parent, setParent] = React.useState<Parent>("ALL");
  const [dateField, setDateField] = React.useState<DateField>("completed");
  const [scope, setScope] = React.useState<Scope>("offices");
  const [officeId, setOfficeId] = React.useState<number | null>(null);
  const [officesList, setOfficesList] = React.useState<{ id: number; name: string; code: string }[]>([]);

  React.useEffect(() => {
    api.get<{ id: number; name: string; code: string }[]>("/offices")
      .then((r) => setOfficesList(r.data))
      .catch(() => {});
  }, []);

  // ── API data ──────────────────────────────────────────────────────────────────

  const [kpis, setKpis] = React.useState<ComplianceKpis>({
    total_created: 0,
    total_approved_final: 0,
    first_pass_yield_pct: 0,
    pingpong_ratio: 0,
    cycle_time_avg_days: 0,
  });
  const [volumeSeries, setVolumeSeries] = React.useState<ComplianceVolumeSeriesDatum[]>([]);
  const [phaseDist, setPhaseDist] = React.useState<{ phase: string; count: number }[]>([]);
  const [stageDelaysByPhase, setStageDelaysByPhase] = React.useState<ComplianceStageDelayDatum[]>([]);
  const [doctypeDist, setDoctypeDist] = React.useState<{ doctype: string; count: number }[]>([]);
  const [creationByOffice, setCreationByOffice] = React.useState<{ office_code: string; office_name: string; internal: number; external: number; forms: number; total: number }[]>([]);
  const [lifecycleFunnel, setLifecycleFunnel] = React.useState<{ stage: string; count: number }[]>([]);
  const [routingSplit, setRoutingSplit] = React.useState({ default_flow: 0, custom_flow: 0 });
  const [revisionStats, setRevisionStats] = React.useState({ docs_on_v2_plus: 0, avg_versions: 0 });
  const [requestsReport, setRequestsReport] = React.useState<RequestsReport | null>(null);
  const [requestsLoading, setRequestsLoading] = React.useState(false);
  const [activityReport, setActivityReport] = React.useState<ActivityReportResponse | null>(null);
  const [activityLoading, setActivityLoading] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const effectiveScope = isOfficeHead ? "offices" : scope;
        const effectiveOfficeId = isOfficeHead
          ? (me?.office_id ?? undefined)
          : scope === "offices" && officeId ? officeId : undefined;

        const report = await getComplianceReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          date_field: dateField,
          bucket,
          scope: effectiveScope,
          parent: effectiveScope === "clusters" ? parent : "ALL",
          office_id: effectiveOfficeId,
        });
        if (!alive) return;
        setKpis(report.kpis ?? kpis);
        setVolumeSeries(report.volume_series ?? []);
        setPhaseDist(report.phase_distribution ?? []);
        setStageDelaysByPhase(report.stage_delays_by_phase ?? []);
        setDoctypeDist(report.doctype_distribution ?? []);
        setCreationByOffice(report.creation_by_office ?? []);
        setLifecycleFunnel(report.lifecycle_funnel ?? []);
        setRoutingSplit(report.routing_split ?? { default_flow: 0, custom_flow: 0 });
        setRevisionStats(report.revision_stats ?? { docs_on_v2_plus: 0, avg_versions: 0 });
      } catch {
        // silent
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, dateFrom, dateTo, bucket, parent, officeId, dateField, scope, refreshKey, isOfficeHead]);

  // ── Requests report ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!me || activeTab !== "requests") return;
    let alive = true;
    (async () => {
      setRequestsLoading(true);
      try {
        const data = await getRequestsReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          bucket,
        });
        if (!alive) return;
        setRequestsReport(data);
      } catch {
        // silent
      } finally {
        if (alive) setRequestsLoading(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeTab, dateFrom, dateTo, bucket, refreshKey]);

  // ── Activity report ──────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (!me) return;
    const needsActivity = activeTab === "activity" || activeTab === "overview";
    if (!needsActivity || (!qaMode && role !== "ADMIN" && role !== "SYSADMIN")) return;

    let alive = true;
    (async () => {
      setActivityLoading(true);
      try {
        const effectiveOfficeId = isOfficeHead
          ? (me?.office_id ?? undefined)
          : scope === "offices" && officeId ? officeId : undefined;

        const data = await getActivityReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          office_id: effectiveOfficeId,
          parent: scope === "clusters" ? parent : "ALL",
        });
        if (!alive) return;
        setActivityReport(data);
      } catch {
        // silent
      } finally {
        if (alive) setActivityLoading(false);
      }
    })();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, activeTab, dateFrom, dateTo, bucket, parent, officeId, scope, refreshKey, qaMode, role, isOfficeHead]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const ongoingCount = phaseDist
    .filter((p) => !["Completed", "Distributed"].includes(p.phase))
    .reduce((acc, p) => acc + p.count, 0);

  const activeFilterCount = [
    !isOfficeHead && scope !== "offices",
    !isOfficeHead && scope === "clusters" && parent !== "ALL",
    !isOfficeHead && scope === "offices" && officeId !== null,
    bucket !== "monthly",
    dateField !== "completed",
    !!dateFrom,
    !!dateTo,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setDateFrom("");
    setDateTo("");
    setBucket("monthly");
    setParent("ALL");
    setOfficeId(null);
    setDateField("completed");
    if (!isOfficeHead) setScope("offices");
  };

  const tabCls = (active: boolean) =>
    [
      "px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px",
      active
        ? "border-sky-500 text-sky-600 dark:text-sky-400"
        : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
    ].join(" ");


  if (!me) return <Navigate to="/login" replace />;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <PageFrame
      title="Reports"
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
      right={
        <div className="flex items-center gap-2">
          <RefreshButton
            loading={loading}
            onRefresh={async () => {
              setRefreshKey((k) => k + 1);
              // Wait for the loading state to flip — reports useEffect is triggered by refreshKey
              await new Promise<void>((resolve) => {
                const check = setInterval(() => {
                  if (!loading) {
                    clearInterval(check);
                    resolve();
                  }
                }, 100);
                // Fallback timeout
                setTimeout(() => {
                  clearInterval(check);
                  resolve();
                }, 5000);
              });
              return "Report data refreshed.";
            }}
            title="Refresh report"
          />

          <Button
            type="button"
            variant="primary"
            size="sm"
            responsive
            onClick={() => navigate("/reports/export")}
          >
            <TrendingUp size={14} className="sm:hidden" />
            <span>Export reports</span>
          </Button>
        </div>
      }
    >
      {/* Tab nav — scrollable on mobile */}
      <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={tabCls(activeTab === t.key) + " whitespace-nowrap"}
          >
            {t.label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-3 -mb-px">
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500 transition-colors shadow-sm"
          >
            <SlidersHorizontal size={12} />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className="ml-0.5 rounded-full bg-brand-400 px-1.2 py-0.5 text-[9px] font-bold text-white leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content + filter panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div ref={tabContentRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="flex flex-col gap-5 p-4 sm:p-5">
            {/* ── Overview ──────────────────────────────────────────────── */}
            {activeTab === "overview" && (
              <>
                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard
                    loading={loading}
                    label="All documents"
                    value={kpis.total_created}
                    sub="All versions ever created"
                    icon={
                      <FileText
                        size={16}
                        className="text-sky-600 dark:text-sky-400"
                      />
                    }
                    iconBg="bg-sky-50 dark:bg-sky-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Distributed"
                    value={kpis.total_approved_final}
                    sub="Latest versions fully distributed"
                    icon={
                      <CheckCircle2
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    }
                    iconBg="bg-emerald-50 dark:bg-emerald-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Ongoing"
                    value={ongoingCount}
                    sub="Documents currently in progress"
                    icon={
                      <Activity
                        size={16}
                        className="text-amber-600 dark:text-amber-400"
                      />
                    }
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                  />
                </div>

                {/* Volume trend + Phase donut side by side — snap indicators on mobile */}
                <div className="relative group/snap">
                  <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
                    <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
                      <TrendingUp size={12} className="text-sky-500 rotate-90" />
                    </div>
                  </div>
                  <div className="flex lg:grid lg:grid-cols-3 gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
                  <div className="min-w-[85vw] lg:min-w-0 lg:col-span-2 snap-center">
                    <ReportChartCard
                      title={`Document volume · ${bucket}`}
                      subtitle="Created vs distributed per period"
                      loading={loading}
                    >
                      <VolumeTrendChart
                        data={volumeSeries}
                        height={220}
                        loading={loading}
                      />
                    </ReportChartCard>
                  </div>
                  <div className="min-w-[85vw] lg:min-w-0 lg:col-span-1 snap-center">
                    <ReportChartCard
                      title="Documents by phase"
                      subtitle="Current status of documents in selected period"
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
                </div>

                {/* Secondary KPI row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard
                    loading={loading}
                    label="First pass yield"
                    value={`${kpis.first_pass_yield_pct}%`}
                    sub="Docs distributed with zero returns"
                    icon={
                      <Percent
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    }
                    iconBg="bg-emerald-50 dark:bg-emerald-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Avg cycle time"
                    value={`${kpis.cycle_time_avg_days}d`}
                    sub="Draft to distributed, avg days"
                    icon={
                      <Clock
                        size={16}
                        className="text-sky-600 dark:text-sky-400"
                      />
                    }
                    iconBg="bg-sky-50 dark:bg-sky-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Ping-pong ratio"
                    value={kpis.pingpong_ratio}
                    sub="Avg return events per document"
                    icon={
                      <RotateCcw
                        size={16}
                        className="text-rose-500 dark:text-rose-400"
                      />
                    }
                    iconBg="bg-rose-50 dark:bg-rose-900/30"
                  />
                </div>

                {/* Stage delays by phase */}
                <ReportChartCard
                  title="Stage delay by phase"
                  subtitle="Median task hold time per workflow phase"
                  loading={loading}
                >
                  <StageDelayChart
                    data={stageDelaysByPhase}
                    height={160}
                    loading={loading}
                  />
                </ReportChartCard>

                {/* Activity Summary (Dashboard Matching) */}
                {(qaMode || role === "ADMIN" || role === "SYSADMIN") && (
                    <div className="relative group/snap">
                      <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
                        <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
                          <History size={12} className="text-amber-500 rotate-90" />
                        </div>
                      </div>
                      <div className="flex lg:grid lg:grid-cols-2 gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
                      <div className="min-w-[85vw] lg:min-w-0 snap-center">
                        <ReportChartCard
                          title="System Activity Breakdown"
                          subtitle="Distribution by category in selected period"
                          loading={activityLoading}
                        >
                          <ActivityDistributionChart
                            data={activityReport?.distribution ?? []}
                            height={180}
                            loading={activityLoading}
                          />
                        </ReportChartCard>
                      </div>
                      <div className="min-w-[85vw] lg:min-w-0 snap-center">
                        <ReportChartCard
                          title="Activity Trend"
                          subtitle="Daily volume across categories"
                          loading={activityLoading}
                        >
                          <DailyActivityStackedBarChart
                            data={activityReport?.daily_trend ?? []}
                            height={180}
                            loading={activityLoading}
                          />
                        </ReportChartCard>
                      </div>
                    </div>
                    </div>
                )}
              </>
            )}

            {/* ── Workflow ──────────────────────────────────────────────── */}
            {activeTab === "workflow" && (qaMode || isOfficeHead) && (
              <>
                {/* KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard
                    loading={loading}
                    label="Total created"
                    value={kpis.total_created}
                    sub="All document versions created"
                    icon={
                      <FileText
                        size={16}
                        className="text-sky-600 dark:text-sky-400"
                      />
                    }
                    iconBg="bg-sky-50 dark:bg-sky-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Distributed"
                    value={kpis.total_approved_final}
                    sub="Fully completed and distributed"
                    icon={
                      <CheckCircle2
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    }
                    iconBg="bg-emerald-50 dark:bg-emerald-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Active"
                    value={ongoingCount}
                    sub="Documents currently in progress"
                    icon={
                      <Activity
                        size={16}
                        className="text-amber-600 dark:text-amber-400"
                      />
                    }
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                  />
                  <KpiCard
                    loading={loading}
                    label="Avg cycle time"
                    value={`${kpis.cycle_time_avg_days}d`}
                    sub="Draft to distributed, avg days"
                    icon={
                      <Clock
                        size={16}
                        className="text-slate-500 dark:text-slate-400"
                      />
                    }
                    iconBg="bg-slate-100 dark:bg-surface-400"
                  />
                </div>

                {/* Volume trend + Document type donut */}
                <div className="relative group/snap">
                  <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
                    <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
                      <TrendingUp size={12} className="text-sky-500 rotate-90" />
                    </div>
                  </div>
                  <div className="flex lg:grid lg:grid-cols-3 gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
                  <div className="min-w-[85vw] lg:min-w-0 lg:col-span-2 snap-center">
                    <ReportChartCard
                      title={`Document volume · ${bucket}`}
                      subtitle="Documents created vs distributed per period"
                      loading={loading}
                    >
                      <VolumeTrendChart
                        data={volumeSeries}
                        height={220}
                        loading={loading}
                      />
                    </ReportChartCard>
                  </div>
                  <div className="min-w-[85vw] lg:min-w-0 lg:col-span-1 snap-center">
                    <ReportChartCard
                      title="By document type"
                      subtitle="Internal · External · Forms split"
                      loading={loading}
                    >
                      <DocumentTypeChart
                        data={doctypeDist}
                        height={160}
                        loading={loading}
                      />
                    </ReportChartCard>
                  </div>
                </div>
                </div>

                {/* Office creation + companion visual */}
                <div className="relative group/snap">
                  <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
                    <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
                      <TrendingUp size={12} className="text-sky-500 rotate-90" />
                    </div>
                  </div>
                  <div className="flex lg:grid lg:grid-cols-2 gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
                  <div className="min-w-[85vw] lg:min-w-0 snap-center">
                    <ReportChartCard
                      title="Documents created by office"
                      subtitle="Ranked by creation volume"
                      loading={loading}
                    >
                      <OfficeCreationChart
                        data={creationByOffice}
                        loading={loading}
                      />
                    </ReportChartCard>
                  </div>
                  <div className="min-w-[85vw] lg:min-w-0 snap-center flex items-center justify-center rounded-lg border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/20 text-slate-400 dark:text-slate-500 text-xs p-10">
                    companion chart TBD
                  </div>
                </div>
                </div>

                {/* Lifecycle funnel */}
                <ReportChartCard
                  title="Document lifecycle funnel"
                  subtitle="How many documents pass each stage — creation date range applied"
                  loading={loading}
                >
                  <WorkflowFunnelChart
                    data={lifecycleFunnel}
                    loading={loading}
                  />
                </ReportChartCard>

                {/* Routing split + Revision stats */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <ReportChartCard
                    title="Routing mode"
                    subtitle="Documents using default vs custom routing"
                    loading={loading}
                  >
                    <div className="flex flex-col gap-2">
                      {[
                        {
                          label: "Default flow",
                          value: routingSplit.default_flow,
                          color: "bg-sky-400",
                        },
                        {
                          label: "Custom flow",
                          value: routingSplit.custom_flow,
                          color: "bg-violet-400",
                        },
                      ].map(({ label, value, color }) => {
                        const total =
                          routingSplit.default_flow +
                            routingSplit.custom_flow || 1;
                        const pct = Math.round((value / total) * 100);
                        return (
                          <div key={label} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-600 dark:text-slate-300 font-medium">
                                {label}
                              </span>
                              <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                                {value}{" "}
                                <span className="text-slate-400 dark:text-slate-500 font-normal">
                                  ({pct}%)
                                </span>
                              </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${color}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ReportChartCard>

                  <ReportChartCard
                    title="Revision stats"
                    subtitle="How often documents are revised after distribution"
                    loading={loading}
                  >
                    <div className="grid grid-cols-2 gap-3 h-full">
                      <div className="flex flex-col items-center justify-center rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 py-4 px-3 text-center">
                        {loading ? (
                          <Skeleton className="h-7 w-12 mb-1" />
                        ) : (
                          <p className="text-2xl font-bold tabular-nums text-amber-500 dark:text-amber-400 leading-none">
                            {revisionStats.docs_on_v2_plus}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          docs revised
                          <br />
                          (v2 or later)
                        </p>
                      </div>
                      <div className="flex flex-col items-center justify-center rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 py-4 px-3 text-center">
                        {loading ? (
                          <Skeleton className="h-7 w-12 mb-1" />
                        ) : (
                          <p className="text-2xl font-bold tabular-nums text-violet-500 dark:text-violet-400 leading-none">
                            {revisionStats.avg_versions}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                          avg versions
                          <br />
                          per document
                        </p>
                      </div>
                    </div>
                  </ReportChartCard>
                </div>
              </>
            )}

            {/* ── Requests ──────────────────────────────────────────────── */}
            {/* ── Requests ──────────────────────────────────────────────── */}
            {activeTab === "requests" && (
              <>
                {/* KPI strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <KpiCard
                    loading={requestsLoading}
                    label="Total requests"
                    value={requestsReport?.kpis.total ?? 0}
                    sub="All requests submitted"
                    icon={
                      <Send
                        size={16}
                        className="text-sky-600 dark:text-sky-400"
                      />
                    }
                    iconBg="bg-sky-50 dark:bg-sky-900/30"
                  />
                  <KpiCard
                    loading={requestsLoading}
                    label="Accepted"
                    value={requestsReport?.kpis.closed ?? 0}
                    sub="Requests fulfilled and closed"
                    icon={
                      <CheckCircle2
                        size={16}
                        className="text-emerald-600 dark:text-emerald-400"
                      />
                    }
                    iconBg="bg-emerald-50 dark:bg-emerald-900/30"
                  />
                  <KpiCard
                    loading={requestsLoading}
                    label="Pending"
                    value={requestsReport?.kpis.open ?? 0}
                    sub="Currently open requests"
                    icon={
                      <Activity
                        size={16}
                        className="text-amber-600 dark:text-amber-400"
                      />
                    }
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                  />
                  <KpiCard
                    loading={requestsLoading}
                    label="Overdue"
                    value={requestsReport?.kpis.overdue ?? 0}
                    sub="Past expected response date"
                    icon={
                      <AlertCircle
                        size={16}
                        className="text-rose-500 dark:text-rose-400"
                      />
                    }
                    iconBg="bg-rose-50 dark:bg-rose-900/30"
                  />
                </div>

                {/* Secondary KPIs */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <KpiCard
                    loading={requestsLoading}
                    label="Cancelled"
                    value={requestsReport?.kpis.cancelled ?? 0}
                    sub="Requests withdrawn by requester"
                    icon={
                      <Ban
                        size={16}
                        className="text-slate-500 dark:text-slate-400"
                      />
                    }
                    iconBg="bg-slate-100 dark:bg-surface-400"
                  />
                  <KpiCard
                    loading={requestsLoading}
                    label="Acceptance rate"
                    value={`${requestsReport?.kpis.acceptance_rate ?? 0}%`}
                    sub="Accepted out of total submitted"
                    icon={
                      <TrendingUp
                        size={16}
                        className="text-violet-600 dark:text-violet-400"
                      />
                    }
                    iconBg="bg-violet-50 dark:bg-violet-900/30"
                  />
                  <KpiCard
                    loading={requestsLoading}
                    label="Avg resubmissions"
                    value={requestsReport?.kpis.avg_resubmissions ?? 0}
                    sub="Avg attempts per request"
                    icon={
                      <RotateCcw
                        size={16}
                        className="text-amber-600 dark:text-amber-400"
                      />
                    }
                    iconBg="bg-amber-50 dark:bg-amber-900/30"
                  />
                </div>

                {/* Volume trend + Status donut */}
                <div className="flex lg:grid lg:grid-cols-3 gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <div className="min-w-[85vw] lg:min-w-0 lg:col-span-2 snap-center">
                    <ReportChartCard
                      title={`Request volume · ${bucket}`}
                      subtitle="Requests created vs accepted per period"
                      loading={requestsLoading}
                    >
                      <VolumeTrendChart
                        data={(requestsReport?.volume_series ?? []).map(
                          (d) => ({
                            label: d.label,
                            created: d.created,
                            approved_final: d.approved_final,
                          }),
                        )}
                        height={220}
                        loading={requestsLoading}
                      />
                    </ReportChartCard>
                  </div>
                  <div className="min-w-[85vw] lg:min-w-0 lg:col-span-1 snap-center">
                    <ReportChartCard
                      title="Request status"
                      subtitle="Open · Closed · Cancelled breakdown"
                      loading={requestsLoading}
                    >
                      <PhaseDistributionChart
                        data={requestsReport?.status_distribution ?? []}
                        variant="donut"
                        height={220}
                      />
                    </ReportChartCard>
                  </div>
                </div>

                {/* Funnel */}
                <ReportChartCard
                  title="Request funnel"
                  subtitle="How many requests progress through each stage"
                  loading={requestsLoading}
                >
                  <WorkflowFunnelChart
                    data={(requestsReport?.funnel ?? []).map((d) => ({
                      stage: d.stage,
                      count: d.count,
                    }))}
                    loading={requestsLoading}
                  />
                </ReportChartCard>

                {/* Attempt distribution + Office acceptance */}
                <div className="flex lg:grid lg:grid-cols-2 gap-4 lg:gap-5 overflow-x-auto snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
                  <div className="min-w-[85vw] lg:min-w-0 snap-center">
                    <ReportChartCard
                      title="Submission attempts"
                      subtitle="How many requests passed on 1st, 2nd, 3rd+ attempt"
                      loading={requestsLoading}
                    >
                      <div className="flex flex-col gap-2.5">
                        {(requestsReport?.attempt_distribution ?? []).map(
                          (d, i) => {
                            const total =
                              (requestsReport?.attempt_distribution ?? []).reduce(
                                (s, x) => s + x.count,
                                0,
                              ) || 1;
                            const pct = Math.round((d.count / total) * 100);
                            const colors = ["#38bdf8", "#a78bfa", "#f43f5e"];
                            return (
                              <div
                                key={d.attempt}
                                className="flex items-center gap-3"
                              >
                                <span className="w-24 shrink-0 text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                                  {d.attempt}
                                </span>
                                <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${pct}%`,
                                      backgroundColor: colors[i] ?? "#94a3b8",
                                    }}
                                  />
                                </div>
                                <span className="w-14 shrink-0 text-right text-xs tabular-nums text-slate-700 dark:text-slate-200">
                                  {d.count}{" "}
                                  <span className="text-slate-400 dark:text-slate-500">
                                    ({pct}%)
                                  </span>
                                </span>
                              </div>
                            );
                          },
                        )}
                        {!requestsLoading &&
                          !requestsReport?.attempt_distribution?.length && (
                            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">
                              No data available
                            </p>
                          )}
                      </div>
                    </ReportChartCard>
                  </div>

                  <div className="min-w-[85vw] lg:min-w-0 snap-center">
                    <ReportChartCard
                      title="Office acceptance rates"
                      subtitle="Requests received vs accepted per office"
                      loading={requestsLoading}
                    >
                      <div className="flex flex-col gap-0">
                        <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-slate-100 dark:border-surface-400">
                          <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Office
                          </span>
                          <span className="w-10 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Sent
                          </span>
                          <span className="w-10 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Acc.
                          </span>
                          <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                            Rate
                          </span>
                        </div>
                        <div
                          className="overflow-y-auto divide-y divide-slate-50 dark:divide-surface-500"
                          style={{ maxHeight: "13.5rem" }}
                        >
                          {requestsLoading ? (
                            [1, 2, 3, 4].map((i) => (
                              <div
                                key={i}
                                className="flex items-center gap-2 px-1 py-2"
                              >
                                <Skeleton className="flex-1 h-2.5" />
                                <Skeleton className="w-8 h-2.5 shrink-0" />
                                <Skeleton className="w-8 h-2.5 shrink-0" />
                                <Skeleton className="w-10 h-2.5 shrink-0" />
                              </div>
                            ))
                          ) : (requestsReport?.office_acceptance ?? []).length ===
                            0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                              No data available
                            </p>
                          ) : (
                            (requestsReport?.office_acceptance ?? [])
                              .sort((a, b) => b.rate - a.rate)
                              .map((o) => (
                                <div
                                  key={o.office}
                                  className="flex items-center gap-2 px-1 py-2 hover:bg-slate-50 dark:hover:bg-surface-600/50 transition-colors"
                                >
                                  <span className="flex-1 text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                    {o.office}
                                  </span>
                                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                    {o.sent}
                                  </span>
                                  <span className="w-10 shrink-0 text-right text-xs tabular-nums text-slate-500 dark:text-slate-400">
                                    {o.accepted}
                                  </span>
                                  <span
                                    className={`w-12 shrink-0 text-right text-xs font-bold tabular-nums ${o.rate >= 75 ? "text-emerald-500 dark:text-emerald-400" : o.rate >= 50 ? "text-amber-500 dark:text-amber-400" : "text-rose-500 dark:text-rose-400"}`}
                                  >
                                    {o.rate}%
                                  </span>
                                </div>
                              ))
                          )}
                        </div>
                      </div>
                    </ReportChartCard>
                  </div>
                </div>
              </>
            )}

            {/* ── Activity ──────────────────────────────────────────────── */}
            {activeTab === "activity" &&
              (qaMode || role === "ADMIN" || role === "SYSADMIN") && (
                <>
                  {/* KPI Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <KpiCard
                      loading={activityLoading}
                      label="Total actions"
                      value={activityReport?.total_actions ?? 0}
                      sub="Actions logged in selection"
                      icon={
                        <History
                          size={16}
                          className="text-indigo-600 dark:text-indigo-400"
                        />
                      }
                      iconBg="bg-indigo-50 dark:bg-indigo-900/30"
                    />
                    <KpiCard
                      loading={activityLoading}
                      label="Workflows"
                      value={
                        activityReport?.distribution.find(
                          (d) => d.label === "Workflows",
                        )?.count ?? 0
                      }
                      sub="Doc creation & routing"
                      icon={
                        <FileText
                          size={16}
                          className="text-sky-600 dark:text-sky-400"
                        />
                      }
                      iconBg="bg-sky-50 dark:bg-sky-900/30"
                    />
                    <KpiCard
                      loading={activityLoading}
                      label="Access & Security"
                      value={
                        activityReport?.distribution.find(
                          (d) => d.label === "Access",
                        )?.count ?? 0
                      }
                      sub="Logins & auth events"
                      icon={
                        <Activity
                          size={16}
                          className="text-amber-600 dark:text-amber-400"
                        />
                      }
                      iconBg="bg-amber-50 dark:bg-amber-900/30"
                    />
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                       <ReportChartCard
                          title="Activity Trend"
                          subtitle="Categorized system actions last 14 days"
                          loading={activityLoading}
                        >
                          <DailyActivityStackedBarChart
                            data={activityReport?.daily_trend ?? []}
                            loading={activityLoading}
                            height={240}
                          />
                        </ReportChartCard>
                    </div>
                    <div className="lg:col-span-1">
                       <ReportChartCard
                          title="Action Breakdown"
                          subtitle="Distribution by category"
                          loading={activityLoading}
                        >
                          <ActivityDistributionChart
                            data={activityReport?.distribution ?? []}
                            loading={activityLoading}
                            height={240}
                          />
                        </ReportChartCard>
                    </div>
                  </div>

                  {/* Top Actors table + detailed insight grid */}
                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                    <div className="lg:col-span-1">
                      <ReportChartCard
                        title="Top System Actors"
                        subtitle="Users with most actions in period"
                        loading={activityLoading}
                      >
                        <div className="flex flex-col gap-0">
                          <div className="flex items-center gap-2 px-1 pb-1.5 border-b border-slate-100 dark:border-surface-400">
                            <span className="flex-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              User
                            </span>
                            <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                              Actions
                            </span>
                          </div>
                          <div className="overflow-y-auto divide-y divide-slate-50 dark:divide-surface-500 mt-1 max-h-[16.5rem]">
                            {activityLoading ? (
                              [1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center gap-2 px-1 py-1.5">
                                  <Skeleton className="flex-1 h-3" />
                                  <Skeleton className="w-8 h-3 shrink-0" />
                                </div>
                              ))
                            ) : (activityReport?.top_actors ?? []).length === 0 ? (
                              <p className="text-xs text-slate-400 dark:text-slate-500 text-center py-6">
                                No activity found
                              </p>
                            ) : (
                              (activityReport?.top_actors ?? []).map((u) => (
                                <div
                                  key={u.user_id}
                                  className="flex items-center gap-2 px-1 py-1.5 hover:bg-slate-50 dark:hover:bg-surface-600/50 transition-colors"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                      {u.full_name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                      {u.office}
                                    </p>
                                  </div>
                                  <span className="w-12 shrink-0 text-right text-xs font-bold tabular-nums text-slate-600 dark:text-slate-300">
                                    {u.count}
                                  </span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </ReportChartCard>
                    </div>

                    <div className="lg:col-span-2">
                       <ReportChartCard
                          title="Analysis Insights"
                          subtitle="Understanding system activity categories"
                       >
                         <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="rounded-xl bg-indigo-50/30 dark:bg-indigo-950/20 p-4 border border-indigo-100 dark:border-indigo-900/30 hover:shadow-sm transition-shadow">
                                   <div className="flex items-center gap-2 mb-2 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-tight">
                                      <FileText size={15} /> Workflows
                                   </div>
                                   <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                                      Includes document creation, metadata updates, task completions, and routing. High volume indicates active document processing.
                                   </p>
                                </div>
                                <div className="rounded-xl bg-amber-50/30 dark:bg-amber-950/20 p-4 border border-amber-100 dark:border-amber-900/30 hover:shadow-sm transition-shadow">
                                   <div className="flex items-center gap-2 mb-2 text-amber-700 dark:text-amber-300 font-bold text-xs uppercase tracking-tight">
                                      <Activity size={15} /> Access
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
                            <div className="rounded-md border border-amber-200 bg-amber-50/30 p-3 flex gap-3 items-start">
                              <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-amber-800 leading-normal">
                                 <strong>Audit Note:</strong> System activity reporting synchronizes with the Admin Dashboard only for the 'Last 14 Days' view. For historical auditing, use the date range filters on this page to isolate specific periods of interest.
                              </p>
                            </div>
                         </div>
                       </ReportChartCard>
                    </div>
                  </div>
                </>
              )}
          </div>
        </div>

        {/* Sliding filter panel — fixed overlay on mobile */}
        <div 
          className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm sm:hidden transition-opacity duration-300 ${filtersOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
          onClick={() => setFiltersOpen(false)}
        />
        <aside 
          className={[
            "fixed inset-y-0 right-0 z-50 w-72 sm:static sm:w-56 shrink-0 border-l border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-y-auto flex flex-col shadow-2xl sm:shadow-none transition-transform duration-300 ease-in-out",
            filtersOpen ? "translate-x-0" : "translate-x-full sm:translate-x-0",
            !filtersOpen && "sm:flex hidden", // Keep flex on desktop, hidden on mobile if closed
          ].filter(Boolean).join(" ")}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-surface-400">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  Filters
                </span>
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
                    onClick={clearAllFilters}
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
              {/* Office head: locked scope notice */}
              {isOfficeHead && (
                <div className="rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                    Data scope
                  </p>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
                    {me?.office?.name ?? "Your office"}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                    Scoped to your office only
                  </p>
                </div>
              )}

              {/* View by — hidden for office head */}
              {!isOfficeHead && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    View by
                  </p>
                  <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-surface-400">
                    {(["offices", "clusters"] as Scope[]).map((s, i) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setScope(s);
                          if (s === "clusters") setOfficeId(null);
                          if (s === "offices") setParent("ALL");
                        }}
                        className={[
                          "flex-1 py-1.5 text-xs font-medium transition-colors",
                          i > 0
                            ? "border-l border-slate-200 dark:border-surface-400"
                            : "",
                          scope === s
                            ? "bg-brand-500 text-white"
                            : "bg-white dark:bg-surface-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500",
                        ].join(" ")}
                      >
                        {s === "clusters" ? "Clusters" : "Offices"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cluster picker */}
              {!isOfficeHead && scope === "clusters" && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Cluster
                  </p>
                  <select
                    value={parent}
                    onChange={(e) => setParent(e.target.value as Parent)}
                    className={filterSelectCls}
                  >
                    <option value="ALL">All clusters</option>
                    <option value="PO">President (PO)</option>
                    <option value="VAd">VP-Admin (VAd)</option>
                    <option value="VA">VP-AA (VA)</option>
                    <option value="VF">VP-Finance (VF)</option>
                    <option value="VR">VP-REQA (VR)</option>
                  </select>
                </div>
              )}

              {/* Office picker */}
              {!isOfficeHead && scope === "offices" && (
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Office
                  </p>
                  <select
                    value={officeId ?? ""}
                    onChange={(e) =>
                      setOfficeId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className={filterSelectCls}
                  >
                    <option value="">All offices</option>
                    {[...officesList]
                      .sort((a, b) => a.code.localeCompare(b.code))
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.code} — {o.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Group by */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Group by
                </p>
                <select
                  value={bucket}
                  onChange={(e) => setBucket(e.target.value as Bucket)}
                  className={filterSelectCls}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                  <option value="total">Total</option>
                </select>
              </div>

              {/* Date field */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Date field
                </p>
                <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-surface-400">
                  {(["completed", "created"] as DateField[]).map((f, i) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setDateField(f)}
                      className={[
                        "flex-1 py-1.5 text-xs font-medium transition-colors",
                        i > 0
                          ? "border-l border-slate-200 dark:border-surface-400"
                          : "",
                        dateField === f
                          ? "bg-brand-500 text-white"
                          : "bg-white dark:bg-surface-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500",
                      ].join(" ")}
                    >
                      {f === "completed" ? "Completed" : "Created"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date range */}
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Date range
                </p>
                <div className="flex flex-col gap-2">
                  <div>
                    <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">
                      From
                    </p>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className={filterSelectCls}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">
                      To
                    </p>
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
      </div>
    </PageFrame>
  );
};

export default ReportsPage;
