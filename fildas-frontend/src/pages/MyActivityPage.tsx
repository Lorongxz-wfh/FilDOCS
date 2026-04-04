import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import { getDocumentVersion, listActivityLogs } from "../services/documents";
import { friendlyEvent } from "../utils/activityFormatters";
import { formatDateTime } from "../utils/formatters";
// import { selectCls } from "../utils/formStyles";
import DateRangeInput from "../components/ui/DateRangeInput";
import { PageActions, RefreshAction, ExportSplitAction } from "../components/ui/PageActions";
import ActivityDetailModal from "../components/activityLogs/ActivityDetailModal";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import SelectDropdown from "../components/ui/SelectDropdown";


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
  const [sortBy, setSortBy] = useState<"created_at" | "event" | "label">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (category) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [category, dateFrom, dateTo]);

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
  }, [category, qDebounced, dateFrom, dateTo, sortBy, sortDir]);

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
          sort_by: sortBy,
          sort_dir: sortDir,
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
        sort_by: sortBy,
        sort_dir: sortDir,
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


  const columns: TableColumn<ActivityLogRow>[] = [
    {
      key: "when",
      header: "When",
      sortKey: "created_at",
      skeletonShape: "narrow",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      skeletonShape: "text",
      render: (r) => (
        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {friendlyEvent(r.event)}
        </span>
      ),
    },
    {
      key: "label",
      header: "Label",
      skeletonShape: "text",
      render: (r) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
          {r.label ?? "—"}
        </span>
      ),
    },
    {
      key: "category",
      header: "Category",
      skeletonShape: "badge",
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
      contentClassName="flex flex-col min-h-0 h-full"
      onBack={() => navigate(-1)}
      right={
        <PageActions>
          <ExportSplitAction
            onExport={handleExport}
            loading={exporting}
            disabled={initialLoading}
          />
          <RefreshAction onRefresh={refresh} loading={exporting} />
        </PageActions>
      }
    >
      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search event / label…"
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setCategory("");
          setQ("");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
              <SelectDropdown
                value={category}
                onChange={(val) => {
                  setCategory((val as Category) || "");
                  setPage(1);
                }}
                className="w-full"
                options={[
                  { value: "", label: "All actions" },
                  { value: "workflow", label: "Workflow" },
                  { value: "document", label: "Documents & Files" },
                  { value: "request", label: "Requests" },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
              <DateRangeInput
                from={dateFrom}
                to={dateTo}
                onFromChange={(val) => {
                  setDateFrom(val);
                  setPage(1);
                }}
                onToChange={(val) => {
                  setDateTo(val);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
      >
        <SelectDropdown
          value={category}
          onChange={(val) => {
            setCategory((val as Category) || "");
            setPage(1);
          }}
          className="w-40"
          options={[
            { value: "", label: "All actions" },
            { value: "workflow", label: "Workflow" },
            { value: "document", label: "Documents & Files" },
            { value: "request", label: "Requests" },
          ]}
        />

        <DateRangeInput
          from={dateFrom}
          to={dateTo}
          onFromChange={(val) => {
            setDateFrom(val);
            setPage(1);
          }}
          onToChange={(val) => {
            setDateTo(val);
            setPage(1);
          }}
        />
      </SearchFilterBar>

      {/* Table */}
      <div className="rounded-sm border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden flex-1 min-h-0">
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
          emptyMessage={q || category || dateFrom || dateTo ? "No activities match your filters." : "No activities found."}
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          mobileRender={(r) => (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${CATEGORY_BADGE[categoryFromEvent(r.event)]}`}>
                  {CATEGORY_LABEL[categoryFromEvent(r.event)]}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {formatDateTime(r.created_at)}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                {friendlyEvent(r.event)}
              </p>
              {r.label && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {r.label}
                </p>
              )}
            </div>
          )}
          gridTemplateColumns="13rem 1.2fr 1fr 8rem"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as any);
            setSortDir(dir);
          }}
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
