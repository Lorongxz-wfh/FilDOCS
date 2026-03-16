import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import PageFrame from "../components/layout/PageFrame";
import ReportStatCard from "../components/reports/ReportStatCard";
import ReportChartCard from "../components/reports/ReportChartCard";
import ComplianceClusterBarChart, {
  type ComplianceClusterDatum,
} from "../components/charts/ComplianceClusterBarChart";
import VolumeTrendChart from "../components/charts/VolumeTrendChart";
import StageDelayChart from "../components/charts/StageDelayChart";
import {
  getComplianceReport,
  type ComplianceSeriesDatum,
  type ComplianceOfficeDatum,
  type ComplianceVolumeSeriesDatum,
  type ComplianceKpis,
  type ComplianceStageDelayDatum,
} from "../services/documents";
import {
  exportElementPdf,
  exportFullTabPdf,
  // exportKpiCsv,
  exportVolumeCsv,
  // exportVolumePdf,
  exportClusterCsv,
  // exportClusterPdf,
  exportOfficeCsv,
  // exportOfficePdf,
  exportStageDelayCsv,
  // exportStageDelayPdf,
  exportTimelineCsv,
  // exportTimelinePdf,
} from "../services/reportExport";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

type Bucket = "daily" | "weekly" | "monthly" | "yearly" | "total";
type Parent = "ALL" | "PO" | "VAd" | "VA" | "VF" | "VR";
type DateField = "completed" | "created";
type Scope = "clusters" | "offices";
type Tab = "overview" | "compliance" | "timeline";

// ── Helpers ────────────────────────────────────────────────────────────────────

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

const selectCls =
  "rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition";

const inputCls =
  "rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 transition";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "compliance", label: "Compliance" },
  { key: "timeline", label: "Timeline" },
];

// ── Compliance table ───────────────────────────────────────────────────────────

const ComplianceTable: React.FC<{
  rows: {
    key: string;
    label: string;
    in_review: number;
    approved: number;
    returned: number;
    approvalRate: number;
    returnRate: number;
  }[];
  colLabel: string;
}> = ({ rows, colLabel }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 dark:border-surface-400">
          {[
            colLabel,
            "In review",
            "Approved",
            "Approval %",
            "Returned",
            "Return %",
          ].map((h) => (
            <th
              key={h}
              className="pb-3 pr-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={6}
              className="py-8 text-center text-sm text-slate-400 dark:text-slate-500"
            >
              No data for selected filters.
            </td>
          </tr>
        ) : (
          rows.map((x) => (
            <tr
              key={x.key}
              className="border-b border-slate-100 dark:border-surface-400 last:border-0"
            >
              <td className="py-3 pr-6 font-semibold text-slate-900 dark:text-slate-100">
                {x.label}
              </td>
              <td className="py-3 pr-6 tabular-nums text-slate-600 dark:text-slate-400">
                {x.in_review}
              </td>
              <td className="py-3 pr-6 tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                {x.approved}
              </td>
              <td className="py-3 pr-6">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${x.approvalRate}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-slate-600 dark:text-slate-400 text-xs">
                    {x.approvalRate}%
                  </span>
                </div>
              </td>
              <td className="py-3 pr-6 tabular-nums font-medium text-rose-600 dark:text-rose-400">
                {x.returned}
              </td>
              <td className="py-3 pr-6">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-rose-500"
                      style={{ width: `${x.returnRate}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-slate-600 dark:text-slate-400 text-xs">
                    {x.returnRate}%
                  </span>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

// ── Main Page ──────────────────────────────────────────────────────────────────

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const me = useAuthUser();

  const tabContentRef = React.useRef<HTMLDivElement>(null);
  const [tabExporting, setTabExporting] = React.useState(false);

  const handleExportTab = async () => {
    if (!tabContentRef.current) return;
    setTabExporting(true);
    try {
      await exportFullTabPdf(tabContentRef.current, activeTab);
    } finally {
      setTabExporting(false);
    }
  };

  const chartPdfHandler =
    (filename: string) => async (element: HTMLElement) => {
      await exportElementPdf(
        element,
        filename,
        filename.replace("fildas_", "").replace(".pdf", "").replace(/_/g, " "),
      );
    };

  const [activeTab, setActiveTab] = React.useState<Tab>("overview");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [bucket, setBucket] = React.useState<Bucket>("monthly");
  const [parent, setParent] = React.useState<Parent>("ALL");
  const [dateField, setDateField] = React.useState<DateField>("completed");
  const [scope, setScope] = React.useState<Scope>("clusters");

  const [officeData, setOfficeData] = React.useState<ComplianceOfficeDatum[]>(
    [],
  );
  const [clusterData, setClusterData] = React.useState<
    ComplianceClusterDatum[]
  >([]);
  const [seriesData, setSeriesData] = React.useState<ComplianceSeriesDatum[]>(
    [],
  );
  const [volumeSeries, setVolumeSeries] = React.useState<
    ComplianceVolumeSeriesDatum[]
  >([]);
  const [stageDelays, setStageDelays] = React.useState<
    ComplianceStageDelayDatum[]
  >([]);
  const [kpis, setKpis] = React.useState<ComplianceKpis>({
    total_created: 0,
    total_approved_final: 0,
    first_pass_yield_pct: 0,
    pingpong_ratio: 0,
    cycle_time_avg_days: 0,
  });

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!me) return;
        setLoading(true);
        setLoadError(null);
        const report = await getComplianceReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          date_field: dateField,
          bucket,
          scope,
          parent,
        });
        if (!alive) return;
        setClusterData((report.clusters ?? []) as ComplianceClusterDatum[]);
        setSeriesData(report.series ?? []);
        setOfficeData(report.offices ?? []);
        setVolumeSeries(report.volume_series ?? []);
        setStageDelays(report.stage_delays ?? []);
        setKpis(
          report.kpis ?? {
            total_created: 0,
            total_approved_final: 0,
            first_pass_yield_pct: 0,
            pingpong_ratio: 0,
            cycle_time_avg_days: 0,
          },
        );
      } catch (err: any) {
        if (!alive) return;
        setLoadError(err?.message || "Failed to load report");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [me, dateFrom, dateTo, bucket, parent, dateField, scope]);

  if (!me) return <Navigate to="/login" replace />;

  const totals = clusterData.reduce(
    (acc, x) => {
      acc.in_review += x.in_review;
      acc.sent_to_qa += x.sent_to_qa;
      acc.approved += x.approved;
      acc.returned += x.returned;
      return acc;
    },
    { in_review: 0, sent_to_qa: 0, approved: 0, returned: 0 },
  );

  const rankedClusters = clusterData
    .map((x) => ({
      key: x.cluster,
      label: x.cluster,
      in_review: x.in_review,
      approved: x.approved,
      returned: x.returned,
      approvalRate: pct(x.approved, x.in_review),
      returnRate: pct(x.returned, x.in_review),
    }))
    .sort((a, b) => a.approvalRate - b.approvalRate);

  const rankedOffices = officeData
    .map((x) => ({
      key: String(x.office_id),
      label: x.office_code ?? `Office #${x.office_id}`,
      in_review: x.in_review,
      approved: x.approved,
      returned: x.returned,
      approvalRate: pct(x.approved, x.in_review),
      returnRate: pct(x.returned, x.in_review),
    }))
    .sort((a, b) => a.approvalRate - b.approvalRate);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <PageFrame
      title="Reports"
      contentClassName="flex flex-col gap-5"
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportTab}
            disabled={tabExporting}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50"
          >
            {tabExporting ? "Exporting…" : "↓ Export tab"}
          </button>
          <button
            type="button"
            onClick={() => navigate("/reports/export")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 hover:bg-sky-600 px-3 py-2 text-sm font-medium text-white transition"
          >
            Export reports
          </button>
        </div>
      }
    >
      {/* Error */}
      {loadError && (
        <div className="shrink-0 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {loadError}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 shrink-0">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Scope
          </label>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            className={selectCls}
          >
            <option value="clusters">Clusters</option>
            <option value="offices">Offices</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Parent
          </label>
          <select
            value={parent}
            onChange={(e) => setParent(e.target.value as Parent)}
            className={selectCls}
          >
            <option value="ALL">All clusters</option>
            <option value="PO">President (PO)</option>
            <option value="VAd">VP-Admin (VAd)</option>
            <option value="VA">VP-AA (VA)</option>
            <option value="VF">VP-Finance (VF)</option>
            <option value="VR">VP-REQA (VR)</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Bucket
          </label>
          <select
            value={bucket}
            onChange={(e) => setBucket(e.target.value as Bucket)}
            className={selectCls}
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
            <option value="total">Total</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Date field
          </label>
          <select
            value={dateField}
            onChange={(e) => setDateField(e.target.value as DateField)}
            className={selectCls}
          >
            <option value="completed">Completed date</option>
            <option value="created">Created date</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            From
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">
            To
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className={inputCls}
          />
        </div>
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition self-end"
          >
            Clear
          </button>
        )}
        {loading && (
          <span className="self-end pb-2.5 text-xs text-slate-400 dark:text-slate-500">
            Loading…
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 shrink-0 border-b border-slate-200 dark:border-surface-400">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === t.key
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab content (ref used for screenshot export) ───────────────────────── */}
      <div ref={tabContentRef}>
        {/* ── Tab: Overview ──────────────────────────────────────────────────────── */}
        {activeTab === "overview" && (
          <div className="flex flex-col gap-5">
            {/* KPI row */}
            <div className="flex flex-wrap gap-3">
              <ReportStatCard
                label="Total created"
                value={kpis.total_created}
                sub="All versions in period"
                icon="📄"
              />
              <ReportStatCard
                label="Final distributed"
                value={kpis.total_approved_final}
                sub={`${pct(kpis.total_approved_final, kpis.total_created)}% completion rate`}
                color="emerald"
                icon="✅"
              />
              <ReportStatCard
                label="In review / returned"
                value={totals.in_review}
                sub={`${totals.returned} returned for edits`}
                color="sky"
                icon="🔄"
              />
              <ReportStatCard
                label="Avg cycle time"
                value={`${kpis.cycle_time_avg_days}d`}
                sub="Draft → distribution (avg)"
                color="violet"
                icon="⏱"
              />
              <ReportStatCard
                label="Ping-pong ratio"
                value={kpis.pingpong_ratio}
                sub="Returns per version (avg)"
                color={kpis.pingpong_ratio > 1 ? "rose" : "default"}
                icon="🏓"
              />
            </div>

            {/* Volume trend */}
            <ReportChartCard
              title={`Document volume — created vs distributed (${bucket})`}
              subtitle="Tracks how many documents were started vs actually completed each period"
              onExportCsv={() => exportVolumeCsv(volumeSeries)}
              onExportPdf={chartPdfHandler("fildas_volume_trend.pdf")}
            >
              <VolumeTrendChart data={volumeSeries} height={260} />
            </ReportChartCard>

            {/* Stage delays */}
            <ReportChartCard
              title="Average time per workflow stage"
              subtitle="Based on distributed documents only — how long each stage took on average (hours)"
              onExportCsv={() => exportStageDelayCsv(stageDelays)}
              onExportPdf={chartPdfHandler("fildas_stage_delays.pdf")}
            >
              {stageDelays.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No stage data available for the selected filters.
                </p>
              ) : (
                <StageDelayChart data={stageDelays} height={220} />
              )}
            </ReportChartCard>

            {/* Definitions */}
            <ReportChartCard title="Metric definitions">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Total created
                  </span>{" "}
                  — all document versions created in the period.
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Final distributed
                  </span>{" "}
                  — versions that completed all 5 phases.
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Avg cycle time
                  </span>{" "}
                  — days from first task opened to distribution (distributed
                  versions only).
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Ping-pong ratio
                  </span>{" "}
                  — average number of return events per version.
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    First-pass yield
                  </span>{" "}
                  — % of distributed versions that had zero returns.
                </p>
                <p>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    Stage delay
                  </span>{" "}
                  — avg hours a task spent in each stage (Office / VP / QA /
                  Registration).
                </p>
              </div>
            </ReportChartCard>
          </div>
        )}

        {/* ── Tab: Compliance ────────────────────────────────────────────────────── */}
        {activeTab === "compliance" && (
          <div className="flex flex-col gap-5">
            {/* Compliance KPIs */}
            <div className="flex flex-wrap gap-3">
              <ReportStatCard
                label="Entered review"
                value={totals.in_review}
                sub="Office/VP stage reached"
                icon="📋"
              />
              <ReportStatCard
                label="Final approved"
                value={totals.approved}
                sub={`${pct(totals.approved, totals.in_review)}% approval rate`}
                color="emerald"
                icon="✅"
              />
              <ReportStatCard
                label="Returned for edits"
                value={totals.returned}
                sub={`${pct(totals.returned, totals.in_review)}% return rate`}
                color="rose"
                icon="↩️"
              />
              <ReportStatCard
                label="First-pass yield"
                value={`${kpis.first_pass_yield_pct}%`}
                sub="Approved with zero returns"
                color="sky"
                icon="🎯"
              />
              <ReportStatCard
                label="Ping-pong ratio"
                value={kpis.pingpong_ratio}
                sub="Returns per version (avg)"
                color={kpis.pingpong_ratio > 1 ? "rose" : "default"}
                icon="🏓"
              />
            </div>

            {/* Cluster bar chart */}
            {scope === "clusters" && (
              <ReportChartCard
                title="Approval performance by cluster"
                subtitle="VP + President clusters — routed vs approved vs returned"
                onExportCsv={() => exportClusterCsv(clusterData)}
                onExportPdf={chartPdfHandler("fildas_cluster_compliance.pdf")}
              >
                <ComplianceClusterBarChart data={clusterData} height={300} />
              </ReportChartCard>
            )}

            {/* Table */}
            <ReportChartCard
              title={
                scope === "clusters"
                  ? "Cluster throughput breakdown"
                  : "Office compliance breakdown"
              }
              subtitle="Sorted by approval rate — lowest first (highest risk at top)"
              onExportCsv={
                scope === "clusters"
                  ? () => exportClusterCsv(clusterData)
                  : () => exportOfficeCsv(officeData)
              }
              onExportPdf={chartPdfHandler(
                scope === "clusters"
                  ? "fildas_cluster_table.pdf"
                  : "fildas_office_compliance.pdf",
              )}
            >
              <ComplianceTable
                rows={scope === "clusters" ? rankedClusters : rankedOffices}
                colLabel={scope === "clusters" ? "Cluster" : "Office"}
              />
            </ReportChartCard>
          </div>
        )}

        {/* ── Tab: Timeline ──────────────────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div className="flex flex-col gap-5">
            <ReportChartCard
              title={`Approval activity over time (${bucket})`}
              subtitle={`Unique versions per stage per ${bucket} — covers QA, Office, and Custom flows`}
              onExportCsv={() => exportTimelineCsv(seriesData)}
              onExportPdf={chartPdfHandler("fildas_approval_timeline.pdf")}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={seriesData}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(148,163,184,0.15)"
                  />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar
                    dataKey="in_review"
                    fill="#0ea5e9"
                    name="In review"
                    radius={[3, 3, 0, 0] as any}
                  />
                  <Bar
                    dataKey="sent_to_qa"
                    fill="#a855f7"
                    name="In Approval"
                    radius={[3, 3, 0, 0] as any}
                  />
                  <Bar
                    dataKey="approved"
                    fill="#10b981"
                    name="Distributed"
                    radius={[3, 3, 0, 0] as any}
                  />
                  <Bar
                    dataKey="returned"
                    fill="#f43f5e"
                    name="Returned"
                    radius={[3, 3, 0, 0] as any}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ReportChartCard>

            <ReportChartCard
              title={`Volume trend — created vs distributed (${bucket})`}
              subtitle="Gap between lines = backlog building up or clearing"
              onExportCsv={() => exportVolumeCsv(volumeSeries)}
              onExportPdf={chartPdfHandler("fildas_volume_trend.pdf")}
            >
              <VolumeTrendChart data={volumeSeries} height={260} />
            </ReportChartCard>

            <ReportChartCard
              title="Stage processing time"
              subtitle="Average hours spent per workflow stage — distributed versions only"
              onExportCsv={() => exportStageDelayCsv(stageDelays)}
              onExportPdf={chartPdfHandler("fildas_stage_delays.pdf")}
            >
              {stageDelays.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                  No stage data available yet.
                </p>
              ) : (
                <StageDelayChart data={stageDelays} height={220} />
              )}
            </ReportChartCard>
          </div>
        )}
      </div>
      {/* end tab content ref wrapper */}
    </PageFrame>
  );
};

export default ReportsPage;
