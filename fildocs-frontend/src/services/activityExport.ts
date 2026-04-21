import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatDateTime } from "../utils/formatters";
import type { ActivityLogItem } from "./types";

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

const toYMD = (d: Date) => d.toISOString().split("T")[0];

// ── CSV generator ───────────────────────────────────────────────────────────

export async function exportActivityCsv(data: ActivityLogItem[], title: string = "Activity_Log") {
  const headers = ["Date", "Event", "Activity", "User", "Office", "Document"];
  const rows = data.map((item) => [
    formatDateTime(item.created_at),
    item.event,
    item.label || "—",
    item.actor_user ? `${item.actor_user.first_name} ${item.actor_user.last_name}`.trim() : "System",
    item.actor_office?.code || "—",
    item.document?.title || "—",
  ]);

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      row
        .map((val) => {
          const str = String(val).replace(/"/g, '""');
          return str.includes(",") || str.includes('"') || str.includes("\n")
            ? `"${str}"`
            : str;
        })
        .join(",")
    ),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const filename = `${title}_${toYMD(new Date())}.csv`;
  await saveBlob(blob, filename, "text/csv");
}

// ── PDF generator ───────────────────────────────────────────────────────────

export async function exportActivityPdf(data: ActivityLogItem[], title: string = "Activity Log") {
  const doc = new jsPDF({ format: "letter", orientation: "landscape" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${formatDateTime(new Date().toISOString())}`, 14, 28);
  doc.text(`Total Records: ${data.length}`, 14, 34);

  const head = [["Date", "Actor", "Office", "Activity", "Event", "Document"]];
  const body = data.map((item) => [
    formatDateTime(item.created_at),
    item.actor_user ? `${item.actor_user.first_name} ${item.actor_user.last_name}`.trim() : "System",
    item.actor_office?.code || "—",
    item.label || "—",
    item.event,
    item.document?.title || "—",
  ]);

  autoTable(doc, {
    startY: 42,
    head,
    body,
    theme: "striped",
    headStyles: { fillColor: [15, 23, 42], fontSize: 9 }, // slate-900
    bodyStyles: { fontSize: 8 },
    styles: { cellPadding: 3 },
  });

  const filename = `${title.replace(/\s+/g, "_")}_${toYMD(new Date())}.pdf`;
  const blob = doc.output("blob");
  await saveBlob(blob, filename, "application/pdf");
}
