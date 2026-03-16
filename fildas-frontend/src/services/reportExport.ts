import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type {
  ComplianceKpis,
  ComplianceVolumeSeriesDatum,
  ComplianceSeriesDatum,
  ComplianceOfficeDatum,
  ComplianceStageDelayDatum,
} from "./documents";
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
  // Header bar
  doc.setFillColor(14, 165, 233); // sky-500
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), 18, "F");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`FilDAS — ${title}`, 14, 12);
  // Subtitle
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22);
  return doc;
}

// ── Screenshot export (for "Export tab" button) ────────────────────────────────

export async function exportElementPdf(
  element: HTMLElement,
  filename: string,
  _title?: string,
) {
  const html2canvas = (await import("html2canvas")).default;

  // Force light mode during capture
  const html = document.documentElement;
  const wasDark = html.classList.contains("dark");
  if (wasDark) html.classList.remove("dark");
  await new Promise((res) => setTimeout(res, 120));

  // Hide export buttons during capture
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
    // Fix border stacking and legend box artifacts
    onclone: (clonedDoc) => {
      // Remove all box shadows from cloned document
      clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
        el.style.boxShadow = "none";
        el.style.textDecoration = "none";
      });
      // Remove border from recharts legend items
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

  // Restore
  if (wasDark) html.classList.add("dark");
  toHide.forEach(({ el, prev }) => {
    el.style.visibility = prev;
  });

  const imgData = canvas.toDataURL("image/png");
  const { default: jsPDFLib } = await import("jspdf");
  const doc = new jsPDFLib({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
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
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
    styles: { fontSize: 10, cellPadding: 4 },
    headStyles: {
      fillColor: [14, 165, 233],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
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
