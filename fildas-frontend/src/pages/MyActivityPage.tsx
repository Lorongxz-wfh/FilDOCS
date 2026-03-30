import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import RefreshButton from "../components/ui/RefreshButton";
import { getDocumentVersion, listActivityLogs } from "../services/documents";
import { friendlyEvent } from "../utils/activityFormatters";
import { formatDateTime } from "../utils/formatters";
import { X } from "lucide-react";
import { selectCls } from "../utils/formStyles";
import DateRangeInput from "../components/ui/DateRangeInput";
import ActivityDetailModal from "../components/activityLogs/ActivityDetailModal";

type ActivityLogRow = {
  id: number;
  event: string;
  label?: string | null;
  document_id?: number | null;
  document_version_id?: number | null;
  meta?: any;
  created_at?: string | null;
};

type Category = "" | "workflow" | "document" | "request";

const CATEGORY_BADGE: Record<string, string> = {
  workflow: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  document: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  request:  "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  other:    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
};

const CATEGORY_LABEL: Record<string, string> = {
  workflow: "Workflow",
  document: "Document",
  request:  "Request",
  other:    "Other",
};

function categoryFromEvent(event: string): string {
  if (event.startsWith("workflow.")) return "workflow";
  if (event.startsWith("document.") || event.startsWith("version.") || event.startsWith("message.")) return "document";
  if (event.startsWith("document_request")) return "request";
  return "other";
}

// function canNavigateTo(row: ActivityLogRow): boolean {
//   return !!(row.document_version_id || row.document_id || row.meta?.document_request_id);
// }

const MyActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const initialCategory = ((location.state as any)?.category as Category) ?? "";

  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedRow, setSelectedRow] = useState<ActivityLogRow | null>(null);
  const [category, setCategory] = useState<Category>(initialCategory);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const hasMoreRef = useRef(true);
  const manualRefreshInProgress = useRef(false);
  const firstIdRef = useRef<number | null>(null);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  // Reset on filter change
  useEffect(() => {
    setRows([]);
    setPage(1);
    hasMoreRef.current = true;
    setHasMore(true);
    setInitialLoading(true);
  }, [category, qDebounced, dateFrom, dateTo]);

  // Load data
  useEffect(() => {
    if (manualRefreshInProgress.current) return;
    let alive = true;
    const load = async () => {
      if (!hasMoreRef.current && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listActivityLogs({
          scope: "mine",
          q: qDebounced.trim() || undefined,
          page,
          per_page: 25,
          category: category || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        if (!alive) return;
        const incoming = (res.data ?? []) as ActivityLogRow[];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? null;
        const more =
          meta?.current_page != null &&
          meta?.last_page != null &&
          meta.current_page < meta.last_page;
        hasMoreRef.current = more;
        setHasMore(more);
        if (page === 1) firstIdRef.current = incoming[0]?.id ?? null;
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load activity.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
    // hasMore intentionally omitted — tracked via hasMoreRef to avoid re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, category, qDebounced, dateFrom, dateTo]);

  const refresh = useCallback(async (): Promise<string | false | void> => {
    const prevFirstId = firstIdRef.current;
    manualRefreshInProgress.current = true;
    setError(null);
    try {
      const res = await listActivityLogs({
        scope: "mine",
        q: qDebounced.trim() || undefined,
        page: 1,
        per_page: 25,
        category: category || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      const incoming = (res.data ?? []) as ActivityLogRow[];
      firstIdRef.current = incoming[0]?.id ?? null;
      setRows(incoming);
      setPage(1);
      const meta = res.meta ?? null;
      const more =
        meta?.current_page != null &&
        meta?.last_page != null &&
        meta.current_page < meta.last_page;
      hasMoreRef.current = more;
      setHasMore(more);
      setInitialLoading(false);
      if (prevFirstId === null) return false;
      return incoming[0]?.id !== prevFirstId
        ? "New activity entries loaded."
        : "Already up to date.";
    } catch (e: any) {
      setError(e?.message ?? "Failed to load activity.");
      throw e;
    } finally {
      manualRefreshInProgress.current = false;
    }
  }, [category, qDebounced, dateFrom, dateTo]);

  const openByVersionId = async (versionId: number) => {
    try {
      const { document } = await getDocumentVersion(versionId);
      navigate(`/documents/${document.id}`, { state: { from: "/my-activity" } });
    } catch {
      /* silent */
    }
  };

  const handleRowNavigate = (row: ActivityLogRow) => {
    if (row.meta?.document_request_id) {
      navigate(`/document-requests/${row.meta.document_request_id}`);
      return;
    }
    if (row.document_version_id) {
      openByVersionId(Number(row.document_version_id));
      return;
    }
    if (row.document_id) {
      navigate(`/documents/${row.document_id}`, { state: { from: "/my-activity" } });
    }
  };

  const hasFilters = category || q || dateFrom || dateTo;

  const columns: TableColumn<ActivityLogRow>[] = [
    {
      key: "when",
      header: "When",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (r) => (
        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {friendlyEvent(r.event)}
        </span>
      ),
    },
    {
      key: "label",
      header: "Label",
      render: (r) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
          {r.label ?? "—"}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      render: (r) => {
        const cat = categoryFromEvent(r.event);
        return (
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE[cat]}`}>
            {CATEGORY_LABEL[cat]}
          </span>
        );
      },
    },
  ];

  const [exporting, setExporting] = useState(false);
  const handleExport = async (format: "csv" | "pdf") => {
    if (exporting) return;
    setExporting(true);
    try {
      const { exportActivityLogs } = await import("../services/activityApi");
      const { exportActivityCsv, exportActivityPdf } = await import("../services/activityExport");
      
      const payload = {
        scope: "mine" as const,
        q: qDebounced.trim() || undefined,
        category: category || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      };
      
      const data = await exportActivityLogs(payload);
      
      if (format === "csv") await exportActivityCsv(data);
      else await exportActivityPdf(data);
    } catch (e: any) {
      setError(e?.message ?? "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageFrame
      title="My Activity"
      breadcrumbs={[{ label: "Activity Logs", to: "/activity-logs" }]}
      contentClassName="flex flex-col gap-4 h-full"
      onBack={() => navigate(-1)}
      right={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden text-xs font-medium shrink-0 shadow-sm">
            <button
              type="button"
              onClick={() => handleExport("csv")}
              disabled={exporting || initialLoading}
              title="Export current view to CSV"
              className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition border-r border-slate-200 dark:border-surface-400 disabled:opacity-50"
            >
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExport("pdf")}
              disabled={exporting || initialLoading}
              title="Export current view to PDF"
              className="px-2.5 py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50"
            >
              PDF
            </button>
          </div>
          <RefreshButton onRefresh={refresh} loading={exporting} title="Refresh activity" />
        </div>
      }
    >
      {/* Filters bar */}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-56">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search event/label…"
            className={`${selectCls} w-full pr-8`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              title="Clear"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={selectCls}
        >
          <option value="">All actions</option>
          <option value="workflow">Workflow</option>
          <option value="document">Documents &amp; Files</option>
          <option value="request">Requests</option>
        </select>

        <DateRangeInput
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setCategory(""); setQ(""); setDateFrom(""); setDateTo(""); }}
            className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden flex-1 min-h-0">
        <Table
          bare
          className="h-full"
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => setSelectedRow(r)}
          loading={loading}
          initialLoading={initialLoading}
          error={error}
          emptyMessage="No activity found."
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns="13rem 1.2fr 1fr 8rem"
        />
      </div>
      {selectedRow && (
        <ActivityDetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onNavigate={handleRowNavigate}
        />
      )}
    </PageFrame>
  );
};

export default MyActivityPage;
