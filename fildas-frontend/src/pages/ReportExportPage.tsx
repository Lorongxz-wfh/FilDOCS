import React from "react";
import { useNavigate } from "react-router-dom";
import { Download } from "lucide-react";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/loader/Skeleton";
import { getComplianceReport } from "../services/documents";
import { getRequestsReport, getActivityReport } from "../services/reportsApi";
import { useAuthUser } from "../hooks/useAuthUser";
import {
  exportKpiCsv,
  exportKpiPdf,
  exportVolumeCsv,
  exportVolumePdf,
  exportClusterCsv,
  exportClusterPdf,
  exportOfficeCsv,
  exportOfficePdf,
  exportStageDelayCsv,
  exportStageDelayPdf,
  exportTimelineCsv,
  exportTimelinePdf,
  exportDoctypeCsv,
  exportDoctypePdf,
  exportCreationByOfficeCsv,
  exportCreationByOfficePdf,
  exportLifecycleFunnelCsv,
  exportLifecycleFunnelPdf,
  exportRoutingRevisionCsv,
  exportRoutingRevisionPdf,
  exportRequestsKpiCsv,
  exportRequestsKpiPdf,
  exportOfficeAcceptanceCsv,
  exportOfficeAcceptancePdf,
  exportAttemptsCsv,
  exportAttemptsPdf,
  exportActivityDistributionCsv,
  exportActivityDistributionPdf,
  exportActivityTrendCsv,
  exportActivityTrendPdf,
  exportTopActorsCsv,
  exportTopActorsPdf,
} from "../services/reportExport";

import type {
  ComplianceKpis,
  ComplianceVolumeSeriesDatum,
  ComplianceSeriesDatum,
  ComplianceOfficeDatum,
  ComplianceStageDelayDatum,
  RequestsReport,
  ActivityReportResponse,
} from "../services/types";
import type { ComplianceClusterDatum } from "../components/charts/ComplianceClusterBarChart";

// ── Types ──────────────────────────────────────────────────────────────────────

type Format = "pdf" | "csv";
type Group = "overview" | "workflow" | "requests" | "activity";

type ExportSection = {
  key: string;
  group: Group;
  label: string;
  description: string;
  previewHeaders: string[];
  previewRows: () => (string | number)[][];
  exportFn: (fmt: Format) => void;
};

const GROUP_LABELS: Record<Group, string> = {
  overview: "Overview",
  workflow: "Workflow",
  requests: "Requests",
  activity: "System Activity",
};

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

// ── Table Preview ──────────────────────────────────────────────────────────────

const PreviewTable: React.FC<{
  headers: string[];
  rows: (string | number)[][];
  loading?: boolean;
}> = ({ headers, rows, loading }) => {
  if (loading) {
    return (
      <div className="flex flex-col gap-2 py-1">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 py-4 text-center">
        No data available.
      </p>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-slate-200 dark:border-surface-400">
          {headers.map((h) => (
            <th
              key={h}
              className="pb-2 pr-4 text-left font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            className="border-b border-slate-100 dark:border-surface-400 last:border-0"
          >
            {row.map((cell, j) => (
              <td
                key={j}
                className="py-2 pr-4 text-slate-700 dark:text-slate-300 tabular-nums"
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      {rows.length >= 6 && (
        <tfoot>
          <tr>
            <td
              colSpan={headers.length}
              className="pt-2 text-[10px] text-slate-400 dark:text-slate-500"
            >
              Showing first 6 rows — full data exported
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const ReportExportPage: React.FC = () => {
  const navigate = useNavigate();
  const me = useAuthUser();

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Overview data
  const [kpis, setKpis] = React.useState<ComplianceKpis>({
    total_created: 0,
    total_approved_final: 0,
    first_pass_yield_pct: 0,
    pingpong_ratio: 0,
    cycle_time_avg_days: 0,
  });
  const [clusterData, setClusterData] = React.useState<ComplianceClusterDatum[]>([]);
  const [officeData, setOfficeData] = React.useState<ComplianceOfficeDatum[]>([]);
  const [volumeSeries, setVolumeSeries] = React.useState<ComplianceVolumeSeriesDatum[]>([]);
  const [seriesData, setSeriesData] = React.useState<ComplianceSeriesDatum[]>([]);
  const [stageDelays, setStageDelays] = React.useState<ComplianceStageDelayDatum[]>([]);

  // Workflow data
  const [doctypeDist, setDoctypeDist] = React.useState<{ doctype: string; count: number }[]>([]);
  const [creationByOffice, setCreationByOffice] = React.useState<
    { office_code: string; office_name: string; internal: number; external: number; forms: number; total: number }[]
  >([]);
  const [lifecycleFunnel, setLifecycleFunnel] = React.useState<{ stage: string; count: number }[]>([]);
  const [routingSplit, setRoutingSplit] = React.useState({ default_flow: 0, custom_flow: 0 });
  const [revisionStats, setRevisionStats] = React.useState({ docs_on_v2_plus: 0, avg_versions: 0 });

  // Requests data
  const [requestsReport, setRequestsReport] = React.useState<RequestsReport | null>(null);
  // Activity data
  const [activityReport, setActivityReport] = React.useState<ActivityReportResponse | null>(null);

  const [selected, setSelected] = React.useState<Record<string, boolean>>({
    kpi: true,
    volume: true,
    cluster: true,
    office: false,
    stage: true,
    timeline: true,
    doctype: true,
    creation_by_office: true,
    lifecycle: true,
    routing_revision: false,
    requests_kpi: true,
    requests_attempts: true,
    requests_offices: true,
    activity_dist: true,
    activity_trend: true,
    activity_top: false,
  });
  const [formats, setFormats] = React.useState<Record<string, Format>>({
    kpi: "pdf",
    volume: "csv",
    cluster: "pdf",
    office: "csv",
    stage: "pdf",
    timeline: "csv",
    doctype: "pdf",
    creation_by_office: "csv",
    lifecycle: "pdf",
    routing_revision: "csv",
    requests_kpi: "pdf",
    requests_attempts: "csv",
    requests_offices: "csv",
    activity_dist: "pdf",
    activity_trend: "csv",
    activity_top: "csv",
  });
  const [exporting, setExporting] = React.useState(false);

  const totals = clusterData.reduce(
    (acc, x) => {
      acc.in_review += x.in_review;
      acc.approved += x.approved;
      acc.returned += x.returned;
      return acc;
    },
    { in_review: 0, approved: 0, returned: 0 },
  );

  React.useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        setLoading(true);
        const [report, reqReport, actReport] = await Promise.all([
          getComplianceReport({}),
          getRequestsReport({}),
          getActivityReport({}),
        ]);
        setKpis(report.kpis);
        setClusterData(report.clusters as ComplianceClusterDatum[]);
        setOfficeData(report.offices);
        setVolumeSeries(report.volume_series);
        setSeriesData(report.series);
        setStageDelays(report.stage_delays);
        setDoctypeDist(report.doctype_distribution ?? []);
        setCreationByOffice(report.creation_by_office ?? []);
        setLifecycleFunnel(report.lifecycle_funnel ?? []);
        setRoutingSplit(report.routing_split ?? { default_flow: 0, custom_flow: 0 });
        setRevisionStats(report.revision_stats ?? { docs_on_v2_plus: 0, avg_versions: 0 });
        setRequestsReport(reqReport);
        setActivityReport(actReport);
      } catch (e: any) {
        setError(e?.message || "Failed to load report data");
      } finally {
        setLoading(false);
      }
    })();
  }, [me]);

  const sections: ExportSection[] = [
    // ── Overview ──────────────────────────────────────────────────────────────
    {
      key: "kpi",
      group: "overview",
      label: "KPI Summary",
      description: "Cycle time, first-pass yield, ping-pong ratio, approval rates.",
      previewHeaders: ["Metric", "Value"],
      previewRows: () => [
        ["Total created", kpis.total_created],
        ["Total distributed", kpis.total_approved_final],
        ["Completion rate", `${pct(kpis.total_approved_final, kpis.total_created)}%`],
        ["First-pass yield", `${kpis.first_pass_yield_pct}%`],
        ["Ping-pong ratio", kpis.pingpong_ratio],
        ["Avg cycle time", `${kpis.cycle_time_avg_days} days`],
      ],
      exportFn: (fmt) =>
        fmt === "pdf" ? exportKpiPdf(kpis, totals) : exportKpiCsv(kpis, totals),
    },
    {
      key: "volume",
      group: "overview",
      label: "Volume Trend",
      description: "Documents created vs distributed per period.",
      previewHeaders: ["Period", "Created", "Distributed"],
      previewRows: () => volumeSeries.slice(0, 6).map((r) => [r.label, r.created, r.approved_final]),
      exportFn: (fmt) =>
        fmt === "pdf" ? exportVolumePdf(volumeSeries) : exportVolumeCsv(volumeSeries),
    },
    {
      key: "cluster",
      group: "overview",
      label: "Cluster Compliance",
      description: "Approval and return rates broken down by VP cluster.",
      previewHeaders: ["Cluster", "In Review", "Approved", "Approval %", "Returned"],
      previewRows: () =>
        clusterData.slice(0, 6).map((r) => [
          r.cluster,
          r.in_review,
          r.approved,
          `${pct(r.approved, r.in_review)}%`,
          r.returned,
        ]),
      exportFn: (fmt) =>
        fmt === "pdf" ? exportClusterPdf(clusterData) : exportClusterCsv(clusterData),
    },
    {
      key: "office",
      group: "overview",
      label: "Office Compliance",
      description: "Per-office breakdown of review, approval, and return counts.",
      previewHeaders: ["Office", "Cluster", "Approved", "Approval %", "Returned"],
      previewRows: () =>
        officeData.slice(0, 6).map((r) => [
          r.office_code ?? `#${r.office_id}`,
          r.cluster ?? "—",
          r.approved,
          `${pct(r.approved, r.in_review)}%`,
          r.returned,
        ]),
      exportFn: (fmt) =>
        fmt === "pdf" ? exportOfficePdf(officeData) : exportOfficeCsv(officeData),
    },
    {
      key: "stage",
      group: "overview",
      label: "Stage Delay",
      description: "Average hours per workflow stage (Office, VP, QA, Registration).",
      previewHeaders: ["Stage", "Avg Hours", "Versions", "Tasks"],
      previewRows: () => stageDelays.map((r) => [r.stage, r.avg_hours, r.count, r.task_count]),
      exportFn: (fmt) =>
        fmt === "pdf" ? exportStageDelayPdf(stageDelays) : exportStageDelayCsv(stageDelays),
    },
    {
      key: "timeline",
      group: "overview",
      label: "Approval Timeline",
      description: "In-review, in-approval, distributed, and returned counts per period.",
      previewHeaders: ["Period", "In Review", "In Approval", "Distributed", "Returned"],
      previewRows: () =>
        seriesData.slice(0, 6).map((r) => [r.label, r.in_review, r.sent_to_qa, r.approved, r.returned]),
      exportFn: (fmt) =>
        fmt === "pdf" ? exportTimelinePdf(seriesData) : exportTimelineCsv(seriesData),
    },

    // ── Workflow ───────────────────────────────────────────────────────────────
    {
      key: "doctype",
      group: "workflow",
      label: "Document Type Distribution",
      description: "Breakdown of documents by type: Internal, External, Forms.",
      previewHeaders: ["Type", "Count", "%"],
      previewRows: () => {
        const total = doctypeDist.reduce((s, r) => s + r.count, 0) || 1;
        return doctypeDist.map((r) => [r.doctype, r.count, `${pct(r.count, total)}%`]);
      },
      exportFn: (fmt) =>
        fmt === "pdf" ? exportDoctypePdf(doctypeDist) : exportDoctypeCsv(doctypeDist),
    },
    {
      key: "creation_by_office",
      group: "workflow",
      label: "Creation by Office",
      description: "Documents created per office, split by type.",
      previewHeaders: ["Code", "Office", "Internal", "External", "Forms", "Total"],
      previewRows: () =>
        creationByOffice.slice(0, 6).map((r) => [
          r.office_code,
          r.office_name,
          r.internal,
          r.external,
          r.forms,
          r.total,
        ]),
      exportFn: (fmt) =>
        fmt === "pdf"
          ? exportCreationByOfficePdf(creationByOffice)
          : exportCreationByOfficeCsv(creationByOffice),
    },
    {
      key: "lifecycle",
      group: "workflow",
      label: "Lifecycle Funnel",
      description: "How many documents reach each stage: Created → Distributed.",
      previewHeaders: ["Stage", "Count", "% of Created"],
      previewRows: () => {
        const top = lifecycleFunnel[0]?.count || 1;
        return lifecycleFunnel.map((r) => [r.stage, r.count, `${pct(r.count, top)}%`]);
      },
      exportFn: (fmt) =>
        fmt === "pdf"
          ? exportLifecycleFunnelPdf(lifecycleFunnel)
          : exportLifecycleFunnelCsv(lifecycleFunnel),
    },
    {
      key: "routing_revision",
      group: "workflow",
      label: "Routing & Revision Stats",
      description: "Default vs custom routing split, and document revision rates.",
      previewHeaders: ["Metric", "Value"],
      previewRows: () => {
        const total = routingSplit.default_flow + routingSplit.custom_flow || 1;
        return [
          ["Default Flow", routingSplit.default_flow],
          ["Custom Flow", routingSplit.custom_flow],
          ["Default %", `${pct(routingSplit.default_flow, total)}%`],
          ["Custom %", `${pct(routingSplit.custom_flow, total)}%`],
          ["Docs Revised (v2+)", revisionStats.docs_on_v2_plus],
          ["Avg Versions / Doc", revisionStats.avg_versions],
        ];
      },
      exportFn: (fmt) =>
        fmt === "pdf"
          ? exportRoutingRevisionPdf(routingSplit, revisionStats)
          : exportRoutingRevisionCsv(routingSplit, revisionStats),
    },

    // ── Requests ───────────────────────────────────────────────────────────────
    {
      key: "requests_kpi",
      group: "requests",
      label: "Requests KPI Summary",
      description: "Total, accepted, pending, overdue, cancelled, acceptance rate.",
      previewHeaders: ["Metric", "Value"],
      previewRows: () => {
        const k = requestsReport?.kpis;
        if (!k) return [];
        return [
          ["Total Requests", k.total],
          ["Accepted", k.closed],
          ["Pending", k.open],
          ["Cancelled", k.cancelled],
          ["Overdue", k.overdue],
          ["Acceptance Rate", `${k.acceptance_rate}%`],
          ["Avg Resubmissions", k.avg_resubmissions],
        ];
      },
      exportFn: (fmt) => {
        if (!requestsReport?.kpis) return;
        fmt === "pdf"
          ? exportRequestsKpiPdf(requestsReport.kpis)
          : exportRequestsKpiCsv(requestsReport.kpis);
      },
    },
    {
      key: "requests_attempts",
      group: "requests",
      label: "Submission Attempts",
      description: "How many requests were accepted on 1st, 2nd, 3rd+ attempt.",
      previewHeaders: ["Attempt", "Count", "%"],
      previewRows: () => {
        const data = requestsReport?.attempt_distribution ?? [];
        const total = data.reduce((s, r) => s + r.count, 0) || 1;
        return data.map((r) => [r.attempt, r.count, `${pct(r.count, total)}%`]);
      },
      exportFn: (fmt) => {
        const data = requestsReport?.attempt_distribution ?? [];
        fmt === "pdf" ? exportAttemptsPdf(data) : exportAttemptsCsv(data);
      },
    },
    {
      key: "requests_offices",
      group: "requests",
      label: "Office Acceptance Rates",
      description: "Requests received vs accepted per office.",
      previewHeaders: ["Office", "Sent", "Accepted", "Rejected", "Rate"],
      previewRows: () =>
        (requestsReport?.office_acceptance ?? [])
          .slice(0, 6)
          .map((r) => [r.office, r.sent, r.accepted, r.rejected, `${r.rate}%`]),
      exportFn: (fmt) => {
        const data = requestsReport?.office_acceptance ?? [];
        fmt === "pdf" ? exportOfficeAcceptancePdf(data) : exportOfficeAcceptanceCsv(data);
      },
    },
    // ── System Activity ────────────────────────────────────────────────────────
    {
      key: "activity_dist",
      group: "activity",
      label: "Activity Distribution",
      description: "Actions split by operational category (Workflows, Access, System).",
      previewHeaders: ["Category", "Actions", "%"],
      previewRows: () => {
        const dist = activityReport?.distribution ?? [];
        const total = dist.reduce((s, r) => s + r.count, 0) || 1;
        return dist.map((r) => [r.label, r.count, `${pct(r.count, total)}%`]);
      },
      exportFn: (fmt) => {
        const dist = activityReport?.distribution ?? [];
        fmt === "pdf" ? exportActivityDistributionPdf(dist) : exportActivityDistributionCsv(dist);
      },
    },
    {
      key: "activity_trend",
      group: "activity",
      label: "Daily Activity Trend",
      description: "Categorized system actions logged per day.",
      previewHeaders: ["Date", "Workflows", "Access", "System", "Total"],
      previewRows: () =>
        (activityReport?.daily_trend ?? []).slice(0, 6).map((r) => [r.date, r.Workflows, r.Access, r.System, r.total]),
      exportFn: (fmt) => {
        const data = activityReport?.daily_trend ?? [];
        fmt === "pdf" ? exportActivityTrendPdf(data) : exportActivityTrendCsv(data);
      },
    },
    {
      key: "activity_top",
      group: "activity",
      label: "Top System Actors",
      description: "Users with the highest recorded activity counts.",
      previewHeaders: ["User", "Office", "Actions"],
      previewRows: () =>
        (activityReport?.top_actors ?? []).slice(0, 6).map((r) => [r.full_name, r.office, r.count]),
      exportFn: (fmt) => {
        const data = activityReport?.top_actors ?? [];
        fmt === "pdf" ? exportTopActorsPdf(data) : exportTopActorsCsv(data);
      },
    },
  ];

  const GROUPS: Group[] = ["overview", "workflow", "requests", "activity"];

  const handleExportAll = async () => {
    setExporting(true);
    for (const s of sections) {
      if (!selected[s.key]) continue;
      await new Promise((res) => setTimeout(res, 120));
      s.exportFn(formats[s.key]);
    }
    setExporting(false);
  };

  const toggleSelect = (key: string) =>
    setSelected((p) => ({ ...p, [key]: !p[key] }));

  const setFormat = (key: string, fmt: Format) =>
    setFormats((p) => ({ ...p, [key]: fmt }));

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const selectGroup = (group: Group, value: boolean) =>
    setSelected((p) => ({
      ...p,
      ...Object.fromEntries(sections.filter((s) => s.group === group).map((s) => [s.key, value])),
    }));

  return (
    <PageFrame
      title="Export Reports"
      onBack={() => navigate("/reports")}
      breadcrumbs={[{ label: "Reports", to: "/reports" }]}
      contentClassName="flex flex-col gap-6"
      right={
        <Button
          variant="primary"
          size="sm"
          disabled={selectedCount === 0 || loading}
          loading={exporting}
          onClick={handleExportAll}
        >
          <Download size={13} />
          {exporting ? "Exporting…" : `Export ${selectedCount} selected`}
        </Button>
      }
    >
      {/* Global select all / none */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setSelected(Object.fromEntries(sections.map((s) => [s.key, true])))}
          className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
        >
          Select all
        </button>
        <span className="text-slate-300 dark:text-surface-400">·</span>
        <button
          type="button"
          onClick={() => setSelected(Object.fromEntries(sections.map((s) => [s.key, false])))}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
        >
          Select none
        </button>
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {selectedCount} of {sections.length} selected
        </span>
      </div>

      {error && (
        <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Grouped sections */}
      {GROUPS.map((group) => {
        const groupSections = sections.filter((s) => s.group === group);
        const groupSelected = groupSections.filter((s) => selected[s.key]).length;
        return (
          <div key={group} className="flex flex-col gap-4">
            {/* Group heading */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {GROUP_LABELS[group]}
                </h2>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {groupSelected}/{groupSections.length} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => selectGroup(group, true)}
                  className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                >
                  All
                </button>
                <span className="text-slate-300 dark:text-surface-400">·</span>
                <button
                  type="button"
                  onClick={() => selectGroup(group, false)}
                  className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:underline"
                >
                  None
                </button>
              </div>
            </div>

            {/* Section cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {groupSections.map((s) => {
                const isSelected = !!selected[s.key];
                const fmt = formats[s.key];
                const rows = loading ? [] : s.previewRows();

                return (
                  <div
                    key={s.key}
                    className={`rounded-md border bg-white dark:bg-surface-500 overflow-hidden transition-shadow ${
                      isSelected
                        ? "border-sky-400 dark:border-sky-600 ring-1 ring-sky-400/20"
                        : "border-slate-200 dark:border-surface-400"
                    }`}
                  >
                    {/* Card header */}
                    <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-slate-100 dark:border-surface-400">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(s.key)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-sky-500 cursor-pointer shrink-0"
                        />
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {s.label}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {s.description}
                          </p>
                        </div>
                      </div>

                      {/* Format toggle + export button */}
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="flex rounded-md border border-slate-200 dark:border-surface-400 overflow-hidden text-xs font-medium">
                          {(["pdf", "csv"] as Format[]).map((f) => (
                            <button
                              key={f}
                              type="button"
                              onClick={() => setFormat(s.key, f)}
                              className={`px-2.5 py-1 transition ${
                                fmt === f
                                  ? "bg-sky-500 text-white"
                                  : "bg-white dark:bg-surface-500 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400"
                              }`}
                            >
                              {f.toUpperCase()}
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="outline"
                          size="xs"
                          disabled={loading}
                          onClick={() => s.exportFn(fmt)}
                          tooltip={`Export as ${fmt.toUpperCase()}`}
                        >
                          <Download size={11} />
                        </Button>
                      </div>
                    </div>

                    {/* Preview table */}
                    <div className="px-4 py-3.5 overflow-x-auto">
                      <PreviewTable
                        headers={s.previewHeaders}
                        rows={rows}
                        loading={loading}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </PageFrame>
  );
};

export default ReportExportPage;
