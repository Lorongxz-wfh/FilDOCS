import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ComplianceKpis,
  ComplianceVolumeSeriesDatum,
  ComplianceSeriesDatum,
  ComplianceOfficeDatum,
  ComplianceStageDelayDatum,
  RequestsReportKpis,
  TopActor,
} from "./types";
import type { ComplianceClusterDatum } from "../components/charts/ComplianceClusterBarChart";

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

// ── File save helper ───────────────────────────────────────────────────────────

async function saveBlob(blob: Blob, filename: string, mimeType: string) {
  if ("showSaveFilePicker" in window) {
    try {
      const ext = filename.split(".").pop() ?? "";
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: mimeType, accept: { [mimeType]: [`.${ext}`] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (e: any) {
      if (e?.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// ── CSV helper ─────────────────────────────────────────────────────────────────

function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number)[][],
) {
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  saveBlob(blob, filename, "text/csv");
}

// ── PDF table helper ───────────────────────────────────────────────────────────

async function savePdf(doc: jsPDF, filename: string) {
  await saveBlob(doc.output("blob"), filename, "application/pdf");
}

function makePdf(title: string): jsPDF {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 16, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`FilDAS — ${title}`, 14, 12);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  return doc;
}

// Shared table styles
const headStyles = {
  fillColor: [51, 65, 85] as [number, number, number],
  textColor: 255,
  fontStyle: "bold" as const,
};
const tableStyles = { fontSize: 10, cellPadding: 4 };
const altRowStyles = { fillColor: [248, 250, 252] as [number, number, number] };

// ── Screenshot export ──────────────────────────────────────────────────────────

export async function exportElementPdf(
  element: HTMLElement,
  filename: string,
  _title?: string,
) {
  const html2canvas = (await import("html2canvas")).default;

  const html = document.documentElement;
  const wasDark = html.classList.contains("dark");
  if (wasDark) html.classList.remove("dark");
  await new Promise((res) => setTimeout(res, 120));

  const prevOverflow = element.style.overflow;
  const prevHeight = element.style.height;
  const prevMaxHeight = element.style.maxHeight;
  element.style.overflow = "visible";
  element.style.maxHeight = "none";
  element.style.height = element.scrollHeight + "px";

  const toHide: { el: HTMLElement; prev: string }[] = [];
  element.querySelectorAll<HTMLElement>("[data-export-menu]").forEach((el) => {
    toHide.push({ el, prev: el.style.visibility });
    el.style.visibility = "hidden";
  });

  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    removeContainer: true,
    onclone: (clonedDoc) => {
      clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
        el.style.boxShadow = "none";
        el.style.textDecoration = "none";
      });
      clonedDoc
        .querySelectorAll<HTMLElement>(".recharts-legend-item-text")
        .forEach((el) => {
          el.style.border = "none";
          el.style.outline = "none";
        });
      clonedDoc
        .querySelectorAll<HTMLElement>(".recharts-surface")
        .forEach((el) => {
          (el as any).style.overflow = "visible";
        });
    },
  });

  if (wasDark) html.classList.add("dark");
  element.style.overflow = prevOverflow;
  element.style.height = prevHeight;
  element.style.maxHeight = prevMaxHeight;
  toHide.forEach(({ el, prev }) => {
    el.style.visibility = prev;
  });

  const imgData = canvas.toDataURL("image/png");
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const ratio = canvas.width / canvas.height;
  let imgW = maxW;
  let imgH = imgW / ratio;
  if (imgH > maxH) {
    imgH = maxH;
    imgW = imgH * ratio;
  }
  doc.addImage(imgData, "PNG", margin, margin, imgW, imgH);
  await saveBlob(doc.output("blob"), filename, "application/pdf");
}

export async function exportFullTabPdf(element: HTMLElement, tabName: string) {
  await exportElementPdf(
    element,
    `fildas_report_${tabName.toLowerCase()}.pdf`,
    `Report — ${tabName}`,
  );
}

// ── KPI Summary ────────────────────────────────────────────────────────────────

export function exportKpiCsv(
  kpis: ComplianceKpis,
  totals: { in_review: number; approved: number; returned: number },
) {
  downloadCsv(
    "fildas_kpi_summary.csv",
    ["Metric", "Value"],
    [
      ["Total created", kpis.total_created],
      ["Total distributed", kpis.total_approved_final],
      [
        "Completion rate (%)",
        pct(kpis.total_approved_final, kpis.total_created),
      ],
      ["Entered review", totals.in_review],
      ["Final approved", totals.approved],
      ["Approval rate (%)", pct(totals.approved, totals.in_review)],
      ["Returned for edits", totals.returned],
      ["Return rate (%)", pct(totals.returned, totals.in_review)],
      ["First-pass yield (%)", kpis.first_pass_yield_pct],
      ["Ping-pong ratio", kpis.pingpong_ratio],
      ["Avg cycle time (days)", kpis.cycle_time_avg_days],
    ],
  );
}

export async function exportKpiPdf(
  kpis: ComplianceKpis,
  totals: { in_review: number; approved: number; returned: number },
) {
  const doc = makePdf("KPI Summary");
  autoTable(doc, {
    startY: 28,
    head: [["Metric", "Value"]],
    body: [
      ["Total created", kpis.total_created],
      ["Total distributed", kpis.total_approved_final],
      [
        "Completion rate",
        `${pct(kpis.total_approved_final, kpis.total_created)}%`,
      ],
      ["Entered review", totals.in_review],
      ["Final approved", totals.approved],
      ["Approval rate", `${pct(totals.approved, totals.in_review)}%`],
      ["Returned for edits", totals.returned],
      ["Return rate", `${pct(totals.returned, totals.in_review)}%`],
      ["First-pass yield", `${kpis.first_pass_yield_pct}%`],
      ["Ping-pong ratio", kpis.pingpong_ratio],
      ["Avg cycle time", `${kpis.cycle_time_avg_days} days`],
    ],
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" } },
  });
  await savePdf(doc, "fildas_kpi_summary.pdf");
}

// ── Volume Trend ───────────────────────────────────────────────────────────────

export function exportVolumeCsv(data: ComplianceVolumeSeriesDatum[]) {
  downloadCsv(
    "fildas_volume_trend.csv",
    ["Period", "Created", "Distributed"],
    data.map((r) => [r.label, r.created, r.approved_final]),
  );
}

export async function exportVolumePdf(data: ComplianceVolumeSeriesDatum[]) {
  const doc = makePdf("Volume Trend — Created vs Distributed");
  autoTable(doc, {
    startY: 28,
    head: [["Period", "Created", "Distributed", "Gap (backlog)"]],
    body: data.map((r) => [
      r.label,
      r.created,
      r.approved_final,
      r.created - r.approved_final,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_volume_trend.pdf");
}

// ── Cluster Compliance ─────────────────────────────────────────────────────────

export function exportClusterCsv(data: ComplianceClusterDatum[]) {
  downloadCsv(
    "fildas_cluster_compliance.csv",
    ["Cluster", "In Review", "Approved", "Approval %", "Returned", "Return %"],
    data.map((r) => [
      r.cluster,
      r.in_review,
      r.approved,
      `${pct(r.approved, r.in_review)}%`,
      r.returned,
      `${pct(r.returned, r.in_review)}%`,
    ]),
  );
}

export async function exportClusterPdf(data: ComplianceClusterDatum[]) {
  const doc = makePdf("Cluster Compliance");
  autoTable(doc, {
    startY: 28,
    head: [
      [
        "Cluster",
        "In Review",
        "In Approval",
        "Distributed",
        "Approval %",
        "Returned",
        "Return %",
      ],
    ],
    body: data.map((r) => [
      r.cluster,
      r.in_review,
      r.sent_to_qa ?? 0,
      r.approved,
      `${pct(r.approved, r.in_review)}%`,
      r.returned,
      `${pct(r.returned, r.in_review)}%`,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_cluster_compliance.pdf");
}

// ── Office Compliance ──────────────────────────────────────────────────────────

export function exportOfficeCsv(data: ComplianceOfficeDatum[]) {
  downloadCsv(
    "fildas_office_compliance.csv",
    [
      "Office",
      "Cluster",
      "In Review",
      "Approved",
      "Approval %",
      "Returned",
      "Return %",
    ],
    data.map((r) => [
      r.office_code ?? `Office #${r.office_id}`,
      r.cluster ?? "—",
      r.in_review,
      r.approved,
      `${pct(r.approved, r.in_review)}%`,
      r.returned,
      `${pct(r.returned, r.in_review)}%`,
    ]),
  );
}

export async function exportOfficePdf(data: ComplianceOfficeDatum[]) {
  const doc = makePdf("Office Compliance");
  autoTable(doc, {
    startY: 28,
    head: [
      [
        "Office",
        "Cluster",
        "In Review",
        "Approved",
        "Approval %",
        "Returned",
        "Return %",
      ],
    ],
    body: data.map((r) => [
      r.office_code ?? `Office #${r.office_id}`,
      r.cluster ?? "—",
      r.in_review,
      r.approved,
      `${pct(r.approved, r.in_review)}%`,
      r.returned,
      `${pct(r.returned, r.in_review)}%`,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
      6: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_office_compliance.pdf");
}

// ── Stage Delays ───────────────────────────────────────────────────────────────

export function exportStageDelayCsv(data: ComplianceStageDelayDatum[]) {
  downloadCsv(
    "fildas_stage_delays.csv",
    ["Stage", "Avg Hours", "Versions Count", "Task Count"],
    data.map((r) => [r.stage, r.avg_hours, r.count, r.task_count]),
  );
}

export async function exportStageDelayPdf(data: ComplianceStageDelayDatum[]) {
  const doc = makePdf("Stage Processing Time");
  autoTable(doc, {
    startY: 28,
    head: [["Stage", "Avg Hours", "Avg Days", "Versions Count", "Task Count"]],
    body: data.map((r) => [
      r.stage,
      r.avg_hours,
      (r.avg_hours / 24).toFixed(2),
      r.count,
      r.task_count,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_stage_delays.pdf");
}

// ── Approval Timeline ──────────────────────────────────────────────────────────

export function exportTimelineCsv(data: ComplianceSeriesDatum[]) {
  downloadCsv(
    "fildas_approval_timeline.csv",
    ["Period", "In Review", "In Approval", "Distributed", "Returned"],
    data.map((r) => [
      r.label,
      r.in_review,
      r.sent_to_qa,
      r.approved,
      r.returned,
    ]),
  );
}

export async function exportTimelinePdf(data: ComplianceSeriesDatum[]) {
  const doc = makePdf("Approval Timeline");
  autoTable(doc, {
    startY: 28,
    head: [
      [
        "Period",
        "In Review",
        "In Approval",
        "Distributed",
        "Returned",
        "Return Rate",
      ],
    ],
    body: data.map((r) => [
      r.label,
      r.in_review,
      r.sent_to_qa,
      r.approved,
      r.returned,
      `${pct(r.returned, r.in_review)}%`,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_approval_timeline.pdf");
}

// ── Doctype Distribution ────────────────────────────────────────────────────────

export function exportDoctypeCsv(data: { doctype: string; count: number }[]) {
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  downloadCsv(
    "fildas_doctype_distribution.csv",
    ["Document Type", "Count", "Percentage"],
    data.map((r) => [r.doctype, r.count, `${pct(r.count, total)}%`]),
  );
}

export async function exportDoctypePdf(
  data: { doctype: string; count: number }[],
) {
  const doc = makePdf("Document Type Distribution");
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  autoTable(doc, {
    startY: 28,
    head: [["Document Type", "Count", "Percentage"]],
    body: data.map((r) => [r.doctype, r.count, `${pct(r.count, total)}%`]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  await savePdf(doc, "fildas_doctype_distribution.pdf");
}

// ── Creation by Office ──────────────────────────────────────────────────────────

type CreationByOfficeDatum = {
  office_code: string;
  office_name: string;
  internal: number;
  external: number;
  forms: number;
  total: number;
};

export function exportCreationByOfficeCsv(data: CreationByOfficeDatum[]) {
  downloadCsv(
    "fildas_creation_by_office.csv",
    ["Office Code", "Office Name", "Internal", "External", "Forms", "Total"],
    data.map((r) => [
      r.office_code,
      r.office_name,
      r.internal,
      r.external,
      r.forms,
      r.total,
    ]),
  );
}

export async function exportCreationByOfficePdf(data: CreationByOfficeDatum[]) {
  const doc = makePdf("Documents Created by Office");
  autoTable(doc, {
    startY: 28,
    head: [["Code", "Office Name", "Internal", "External", "Forms", "Total"]],
    body: data.map((r) => [
      r.office_code,
      r.office_name,
      r.internal,
      r.external,
      r.forms,
      r.total,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_creation_by_office.pdf");
}

// ── Lifecycle Funnel ────────────────────────────────────────────────────────────

export function exportLifecycleFunnelCsv(
  data: { stage: string; count: number }[],
) {
  downloadCsv(
    "fildas_lifecycle_funnel.csv",
    ["Stage", "Count"],
    data.map((r) => [r.stage, r.count]),
  );
}

export async function exportLifecycleFunnelPdf(
  data: { stage: string; count: number }[],
) {
  const doc = makePdf("Document Lifecycle Funnel");
  const top = data[0]?.count || 1;
  autoTable(doc, {
    startY: 28,
    head: [["Stage", "Count", "% of Created"]],
    body: data.map((r) => [r.stage, r.count, `${pct(r.count, top)}%`]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  await savePdf(doc, "fildas_lifecycle_funnel.pdf");
}

// ── Routing & Revision ──────────────────────────────────────────────────────────

export function exportRoutingRevisionCsv(
  routing: { default_flow: number; custom_flow: number },
  revision: { docs_on_v2_plus: number; avg_versions: number },
) {
  const total = routing.default_flow + routing.custom_flow || 1;
  downloadCsv(
    "fildas_routing_revision.csv",
    ["Metric", "Value"],
    [
      ["Default Flow Documents", routing.default_flow],
      ["Custom Flow Documents", routing.custom_flow],
      ["Default Flow %", `${pct(routing.default_flow, total)}%`],
      ["Custom Flow %", `${pct(routing.custom_flow, total)}%`],
      ["Documents Revised (v2+)", revision.docs_on_v2_plus],
      ["Avg Versions per Document", revision.avg_versions],
    ],
  );
}

export async function exportRoutingRevisionPdf(
  routing: { default_flow: number; custom_flow: number },
  revision: { docs_on_v2_plus: number; avg_versions: number },
) {
  const doc = makePdf("Routing & Revision Stats");
  const total = routing.default_flow + routing.custom_flow || 1;
  autoTable(doc, {
    startY: 28,
    head: [["Metric", "Value"]],
    body: [
      ["Default Flow Documents", routing.default_flow],
      ["Custom Flow Documents", routing.custom_flow],
      ["Default Flow %", `${pct(routing.default_flow, total)}%`],
      ["Custom Flow %", `${pct(routing.custom_flow, total)}%`],
      ["Documents Revised (v2+)", revision.docs_on_v2_plus],
      ["Avg Versions per Document", revision.avg_versions],
    ],
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" } },
  });
  await savePdf(doc, "fildas_routing_revision.pdf");
}

// ── Requests KPI ───────────────────────────────────────────────────────────────

export function exportRequestsKpiCsv(kpis: RequestsReportKpis) {
  downloadCsv(
    "fildas_requests_kpi.csv",
    ["Metric", "Value"],
    [
      ["Total Requests", kpis.total],
      ["Accepted", kpis.closed],
      ["Pending", kpis.open],
      ["Cancelled", kpis.cancelled],
      ["Overdue", kpis.overdue],
      ["Acceptance Rate (%)", kpis.acceptance_rate],
      ["Avg Resubmissions", kpis.avg_resubmissions],
    ],
  );
}

export async function exportRequestsKpiPdf(kpis: RequestsReportKpis) {
  const doc = makePdf("Requests KPI Summary");
  autoTable(doc, {
    startY: 28,
    head: [["Metric", "Value"]],
    body: [
      ["Total Requests", kpis.total],
      ["Accepted", kpis.closed],
      ["Pending (Open)", kpis.open],
      ["Cancelled", kpis.cancelled],
      ["Overdue", kpis.overdue],
      ["Acceptance Rate", `${kpis.acceptance_rate}%`],
      ["Avg Resubmissions", kpis.avg_resubmissions],
    ],
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" } },
  });
  await savePdf(doc, "fildas_requests_kpi.pdf");
}

// ── Office Acceptance Rates ─────────────────────────────────────────────────────

type OfficeAcceptanceDatum = {
  office: string;
  sent: number;
  accepted: number;
  rejected: number;
  rate: number;
};

export function exportOfficeAcceptanceCsv(data: OfficeAcceptanceDatum[]) {
  downloadCsv(
    "fildas_office_acceptance.csv",
    ["Office", "Sent", "Accepted", "Rejected", "Rate (%)"],
    data.map((r) => [r.office, r.sent, r.accepted, r.rejected, r.rate]),
  );
}

export async function exportOfficeAcceptancePdf(data: OfficeAcceptanceDatum[]) {
  const doc = makePdf("Office Acceptance Rates");
  autoTable(doc, {
    startY: 28,
    head: [["Office", "Sent", "Accepted", "Rejected", "Rate (%)"]],
    body: data.map((r) => [
      r.office,
      r.sent,
      r.accepted,
      r.rejected,
      `${r.rate}%`,
    ]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_office_acceptance.pdf");
}

// ── Submission Attempts ─────────────────────────────────────────────────────────

export function exportAttemptsCsv(data: { attempt: string; count: number }[]) {
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  downloadCsv(
    "fildas_submission_attempts.csv",
    ["Attempt", "Count", "Percentage"],
    data.map((r) => [r.attempt, r.count, `${pct(r.count, total)}%`]),
  );
}

export async function exportAttemptsPdf(
  data: { attempt: string; count: number }[],
) {
  const doc = makePdf("Submission Attempts Distribution");
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  autoTable(doc, {
    startY: 28,
    head: [["Attempt", "Count", "Percentage"]],
    body: data.map((r) => [r.attempt, r.count, `${pct(r.count, total)}%`]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  await savePdf(doc, "fildas_submission_attempts.pdf");
}
// ── System Activity Distribution ──────────────────────────────────────────────

export function exportActivityDistributionCsv(data: { label: string; count: number }[]) {
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  downloadCsv(
    "fildas_activity_distribution.csv",
    ["Category", "Action Count", "Percentage"],
    data.map((r) => [r.label, r.count, `${pct(r.count, total)}%`]),
  );
}

export async function exportActivityDistributionPdf(data: { label: string; count: number }[]) {
  const doc = makePdf("System Activity Distribution");
  const total = data.reduce((s, r) => s + r.count, 0) || 1;
  autoTable(doc, {
    startY: 28,
    head: [["Category", "Action Count", "Percentage"]],
    body: data.map((r) => [r.label, r.count, `${pct(r.count, total)}%`]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  await savePdf(doc, "fildas_activity_distribution.pdf");
}

// ── System Activity Daily Trend ────────────────────────────────────────────────

export function exportActivityTrendCsv(data: any[]) {
  downloadCsv(
    "fildas_activity_trend.csv",
    ["Date", "Workflows", "Access", "System", "Others", "Total"],
    data.map((r) => [r.date, r.Workflows, r.Access, r.System, r.Others, r.total]),
  );
}

export async function exportActivityTrendPdf(data: any[]) {
  const doc = makePdf("Daily System Activity Trend");
  autoTable(doc, {
    startY: 28,
    head: [["Date", "Workflows", "Access", "System", "Others", "Total"]],
    body: data.map((r) => [r.date, r.Workflows, r.Access, r.System, r.Others, r.total]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
      4: { halign: "right" },
      5: { halign: "right" },
    },
  });
  await savePdf(doc, "fildas_activity_trend.pdf");
}

// ── Top System Actors ──────────────────────────────────────────────────────────

export function exportTopActorsCsv(data: TopActor[]) {
  downloadCsv(
    "fildas_top_actors.csv",
    ["User", "Office", "Actions Count"],
    data.map((u) => [u.full_name, u.office, u.count]),
  );
}

export async function exportTopActorsPdf(data: TopActor[]) {
  const doc = makePdf("Top System Actors");
  autoTable(doc, {
    startY: 28,
    head: [["User", "Office", "Actions Count"]],
    body: data.map((u) => [u.full_name, u.office, u.count]),
    styles: tableStyles,
    headStyles,
    alternateRowStyles: altRowStyles,
    columnStyles: { 2: { halign: "right" } },
  });
  await savePdf(doc, "fildas_top_actors.pdf");
}
