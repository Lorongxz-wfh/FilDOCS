import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { pageCache } from "../lib/pageCache";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import { listActivityLogs, getDocumentVersion } from "../services/documents";
import ActivityCalendar from "../components/activityLogs/ActivityCalendar";
import ActivityDetailModal from "../components/activityLogs/ActivityDetailModal";
import { List, CalendarDays, X, Search, SlidersHorizontal, User } from "lucide-react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import RefreshButton from "../components/ui/RefreshButton";
import { selectCls, inputCls } from "../utils/formStyles";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import { friendlyEvent } from "../utils/activityFormatters";
import { formatDateTime } from "../utils/formatters";
import MiddleTruncate from "../components/ui/MiddleTruncate";

type Scope = "all" | "office" | "mine";
type Category =
  | ""
  | "workflow"
  | "request"
  | "document"
  | "user"
  | "template"
  | "profile";
type TabView = "log" | "calendar";

const ActivityLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const me = getAuthUser();
  const isOfficeHead = me?.role === "OFFICE_HEAD";

  const [tab, setTab] = React.useState<TabView>("log");
  const [scope, setScope] = React.useState<Scope>("all");
  const [category, setCategory] = React.useState<Category>("");
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [selectedRow, setSelectedRow] = React.useState<any | null>(null);
  const [sortBy, setSortBy] = React.useState<"created_at" | "event" | "label">(
    "created_at",
  );
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (scope !== "all") count++;
    if (category) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [scope, category, dateFrom, dateTo]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 400);
    return () => window.clearTimeout(t);
  }, [q]);

  const _alc = pageCache.get<any>(
    "activity-logs",
    '{"q":"","scope":"all","category":"","dateFrom":"","dateTo":""}',
    2 * 60_000,
  );
  const [rows, setRows] = React.useState<any[]>(_alc?.rows ?? []);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(_alc?.hasMore ?? true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(!_alc);
  const [error, setError] = React.useState<string | null>(null);

  // Ref mirrors hasMore so the effect reads current value without it as a dep
  const hasMoreRef = React.useRef(true);
  // Guard: skip the effect-based fetch while a manual refresh is in flight
  const manualRefreshInProgress = React.useRef(false);

  React.useEffect(() => {
    setRows([]);
    setPage(1);
    hasMoreRef.current = true;
    setHasMore(true);
    setInitialLoading(true);
  }, [scope, qDebounced, category, dateFrom, dateTo, sortBy, sortDir]);

  React.useEffect(() => {
    if (manualRefreshInProgress.current) return; // skip during manual refresh
    let alive = true;
    const load = async () => {
      if (!hasMoreRef.current && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listActivityLogs({
          scope,
          q: qDebounced.trim() || undefined,
          page,
          per_page: 10,
          category: category || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        if (!alive) return;
        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? null;
        const more =
          meta?.current_page != null &&
          meta?.last_page != null &&
          meta.current_page < meta.last_page;
        hasMoreRef.current = more;
        setHasMore(more);
        if (page === 1) {
          const filterKey = JSON.stringify({
            q: qDebounced.trim(),
            scope,
            category,
            dateFrom,
            dateTo,
          });
          pageCache.set("activity-logs", filterKey, incoming, more);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load activity logs.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
    // hasMore intentionally omitted — tracked via hasMoreRef to avoid re-trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, scope, qDebounced, category, dateFrom, dateTo]);

  // Navigate from activity row
  const handleRowNavigate = async (row: any) => {
    if (row.meta?.document_request_id) {
      navigate(`/document-requests/${row.meta.document_request_id}`);
      return;
    }
    if (row.document_version_id) {
      try {
        const { document } = await getDocumentVersion(
          Number(row.document_version_id),
        );
        navigate(`/documents/${document.id}`, {
          state: { from: "/activity-logs" },
        });
      } catch {
        /* silent */
      }
      return;
    }
    if (row.document_id) {
      navigate(`/documents/${row.document_id}`, {
        state: { from: "/activity-logs" },
      });
    }
  };

  const hasFilters =
    category || q || dateFrom || dateTo || (!isOfficeHead && scope !== "all");

  const reloadLogs = () => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    setError(null);
  };

  const { refreshing } = usePageBurstRefresh(reloadLogs);

  // Direct fetch for the manual refresh button — returns a smart message
  const firstIdRef = React.useRef<number | null>(null);
  const refresh = React.useCallback(async (): Promise<string | false> => {
    const prevFirstId = firstIdRef.current;
    manualRefreshInProgress.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await listActivityLogs({
        scope,
        q: qDebounced.trim() || undefined,
        page: 1,
        per_page: 10,
        category: category || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      const incoming = res.data ?? [];
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
      setError(null); // ensure any stale concurrent error is cleared
      setInitialLoading(false);
      if (prevFirstId === null) return false; // initial load — suppress toast
      return incoming[0]?.id !== prevFirstId
        ? "New activity entries loaded."
        : "Already up to date.";
    } catch (e: any) {
      setError(e?.message ?? "Failed to load activity logs.");
      throw e;
    } finally {
      setLoading(false);
      manualRefreshInProgress.current = false;
    }
  }, [scope, qDebounced, category, dateFrom, dateTo, sortBy, sortDir]);

  const columns: TableColumn<any>[] = [
    {
      key: "when",
      header: "When",
      skeletonShape: "narrow",
      sortKey: "created_at",
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
      sortKey: "event",
      render: (r) => (
        <MiddleTruncate
          text={friendlyEvent(r.event)}
          className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
        />
      ),
    },
    {
      key: "label",
      header: "Label",
      skeletonShape: "text",
      sortKey: "label",
      render: (r) => (
        <MiddleTruncate
          text={r.label ?? "—"}
          className="text-xs text-slate-500 dark:text-slate-400"
        />
      ),
    },
    {
      key: "actor",
      header: "Actor",
      skeletonShape: "double",
      render: (r) => (
        <div className="flex flex-col min-w-0 py-0.5">
          <MiddleTruncate
            text={r.actor_user?.full_name ?? r.actor_user?.name ?? "—"}
            className="text-xs font-medium text-slate-800 dark:text-slate-200"
          />
          {r.actor_office && (
            <MiddleTruncate
              text={r.actor_office.name}
              className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight"
            />
          )}
        </div>
      ),
    },
    {
      key: "doc",
      header: "Doc",
      skeletonShape: "text",
      render: (r) => (
        <MiddleTruncate
          text={r.document?.title ?? (r.document_id ? `#${r.document_id}` : "—")}
          className="text-xs text-slate-500 dark:text-slate-400"
        />
      ),
    },
  ];

  const [exporting, setExporting] = React.useState(false);
  const handleExport = async (format: "csv" | "pdf") => {
    if (exporting) return;
    setExporting(true);
    try {
      const { exportActivityLogs } = await import("../services/activityApi");
      const { exportActivityCsv, exportActivityPdf } = await import("../services/activityExport");

      const payload = {
        scope,
        q: qDebounced.trim() || undefined,
        category: category || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
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


  if (!me) return <Navigate to="/login" replace />;

  return (
    <PageFrame
      title="Activity Logs"
      contentClassName="flex flex-col min-h-0 gap-4 h-full"
      right={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {tab === "log" && (
            <div className="flex items-center rounded-xl sm:rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden text-[10px] sm:text-xs font-bold shrink-0 shadow-sm">
              <button
                type="button"
                onClick={() => handleExport("csv")}
                disabled={exporting || initialLoading}
                className="px-2 sm:px-2.5 py-1.5 sm:py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition border-r border-slate-200 dark:border-surface-400 disabled:opacity-50 active:scale-95"
              >
                CSV
              </button>
              <button
                type="button"
                onClick={() => handleExport("pdf")}
                disabled={exporting || initialLoading}
                className="px-2 sm:px-2.5 py-1.5 sm:py-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50 active:scale-95"
              >
                PDF
              </button>
            </div>
          )}
          <RefreshButton
            onRefresh={refresh}
            loading={refreshing || exporting}
            title="Refresh logs"
            className="h-9 w-9 p-0 rounded-xl sm:h-8 sm:w-8 sm:rounded-md transition-all active:scale-95"
          />
          <div className="flex items-center rounded-xl sm:rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-0.5 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setTab("log")}
              className={`p-1.5 sm:p-1.5 rounded-lg sm:rounded-md transition ${tab === "log" ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100 shadow-xs" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"} active:scale-95`}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setTab("calendar")}
              className={`p-1.5 sm:p-1.5 rounded-lg sm:rounded-md transition ${tab === "calendar" ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100 shadow-xs" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"} active:scale-95`}
            >
              <CalendarDays size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate("/my-activity")}
            className="flex h-9 w-9 items-center justify-center rounded-xl sm:h-auto sm:w-auto sm:rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 sm:px-3 sm:py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition shadow-sm whitespace-nowrap active:scale-95"
            title="My Activity"
          >
            <User size={15} className="sm:hidden" />
            <span className="hidden sm:inline">My activity →</span>
          </button>
        </div>
      }
    >
      {/* Calendar tab */}
      {tab === "calendar" && (
        <div className="flex-1 min-h-0 flex flex-col">
          <ActivityCalendar scope={scope} />
        </div>
      )}

      {/* Log tab — filters. Updated for mobile responsiveness */}
      {tab === "log" && (
        <div className="shrink-0 py-3 flex flex-col gap-3 sm:gap-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Search event / label…"
                className={`${inputCls} pl-9 pr-10 text-sm`}
              />
              {q && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  title="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsFiltersOpen(!isFiltersOpen)}
              className={`sm:hidden flex items-center gap-2 px-3 h-9 rounded-lg border transition-all ${isFiltersOpen || activeFiltersCount > 0
                  ? "bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400 shadow-xs"
                  : "bg-white border-slate-200 text-slate-600 dark:bg-surface-500 dark:border-surface-400 dark:text-slate-400"
                }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Filters</span>
              {activeFiltersCount > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-brand-500 text-white rounded-full">
                  {activeFiltersCount}
                </span>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2">
              {isOfficeHead ? (
                <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 h-8 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {me.office?.name ?? "Your office"}
                </span>
              ) : (
                <select
                  value={scope}
                  onChange={(e) => {
                    setScope(e.target.value as Scope);
                    setPage(1);
                  }}
                  className={`${selectCls} text-xs h-8 w-24`}
                >
                  <option value="all">All</option>
                  <option value="office">My office</option>
                  <option value="mine">Mine</option>
                </select>
              )}

              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as Category);
                  setPage(1);
                }}
                className={`${selectCls} text-xs h-8 w-36`}
              >
                <option value="">All categories</option>
                <option value="workflow">Workflow</option>
                <option value="request">Document Requests</option>
                <option value="document">Documents</option>
                <option value="user">User Management</option>
                <option value="template">Templates</option>
                <option value="profile">Profile & Auth</option>
              </select>

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

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setScope("all");
                    setCategory("");
                    setQ("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Mobile secondary filters collapsible */}
          {isFiltersOpen && (
            <div className="sm:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Scope</label>
                  {isOfficeHead ? (
                    <div className={inputCls + " text-center bg-slate-100 dark:bg-surface-500 opacity-60 flex items-center justify-center text-[11px] h-9"}>
                      Office scoped
                    </div>
                  ) : (
                    <select
                      value={scope}
                      onChange={(e) => {
                        setScope(e.target.value as Scope);
                        setPage(1);
                      }}
                      className={selectCls}
                    >
                      <option value="all">All</option>
                      <option value="office">My office</option>
                      <option value="mine">Mine</option>
                    </select>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value as Category);
                      setPage(1);
                    }}
                    className={selectCls}
                  >
                    <option value="">All categories</option>
                    <option value="workflow">Workflow</option>
                    <option value="request">Document Requests</option>
                    <option value="document">Documents</option>
                    <option value="user">User Management</option>
                    <option value="template">Templates</option>
                    <option value="profile">Profile & Auth</option>
                  </select>
                </div>
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

              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setScope("all");
                    setCategory("");
                    setQ("");
                    setDateFrom("");
                    setDateTo("");
                    setPage(1);
                  }}
                  className="w-full py-2.5 text-xs font-bold text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10 rounded-lg transition"
                >
                  Clear all filters
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="pt-2">
              <Alert variant="danger">{error}</Alert>
            </div>
          )}
        </div>
      )}

      {/* Log tab — table */}
      {tab === "log" && (
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
            emptyMessage="No logs found."
            hasMore={hasMore}
            onLoadMore={() => setPage((p) => p + 1)}
            mobileRender={(r) => (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                    {friendlyEvent(r.event)}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {formatDateTime(r.created_at)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                  {r.actor_user?.full_name ?? r.actor_user?.name ?? "—"}
                </p>
                <div className="flex items-center justify-between gap-4 overflow-hidden">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {r.actor_office?.name || "No office"}
                  </p>
                  {r.document?.title && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate shrink-0 max-w-[40%]">
                      {r.document.title}
                    </p>
                  )}
                </div>
              </div>
            )}
            gridTemplateColumns="12rem minmax(140px, 1.2fr) minmax(120px, 1fr) 12rem 10rem"
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(key, dir) => {
              setSortBy(key as typeof sortBy);
              setSortDir(dir);
            }}
          />
        </div>
      )}

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

export default ActivityLogsPage;
