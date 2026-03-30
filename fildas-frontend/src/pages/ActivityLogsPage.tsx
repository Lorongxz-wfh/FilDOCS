import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { pageCache } from "../lib/pageCache";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import { listActivityLogs, getDocumentVersion } from "../services/documents";
import ActivityCalendar from "../components/activityLogs/ActivityCalendar";
import ActivityDetailModal from "../components/activityLogs/ActivityDetailModal";
import { List, CalendarDays, X } from "lucide-react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import RefreshButton from "../components/ui/RefreshButton";
import { selectCls } from "../utils/formStyles";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import { friendlyEvent } from "../utils/activityFormatters";
import { formatDateTime } from "../utils/formatters";

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
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const isOfficeHead = me.role === "OFFICE_HEAD";

  const navigate = useNavigate();

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
        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {friendlyEvent(r.event)}
        </span>
      ),
    },
    {
      key: "label",
      header: "Label",
      skeletonShape: "text",
      sortKey: "label",
      render: (r) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
          {r.label ?? "—"}
        </span>
      ),
    },
    {
      key: "actor",
      header: "Actor",
      skeletonShape: "double",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-xs text-slate-700 dark:text-slate-300 truncate">
            {r.actor_user?.full_name ?? r.actor_user?.name ?? "—"}
          </div>
          {r.actor_office && (
            <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
              {r.actor_office.name}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "doc",
      header: "Doc",
      skeletonShape: "text",
      render: (r) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate block">
          {r.document?.title ?? (r.document_id ? `#${r.document_id}` : "—")}
        </span>
      ),
    },
  ];

  return (
    <PageFrame
      title="Activity Logs"
      contentClassName="flex flex-col min-h-0 gap-4 h-full"
      right={
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={refresh}
            loading={refreshing}
            title="Refresh logs"
          />
          <div className="flex items-center rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-0.5">
            <button
              type="button"
              onClick={() => setTab("log")}
              title="Log view"
              className={`p-1.5 rounded-md transition ${tab === "log" ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setTab("calendar")}
              title="Calendar view"
              className={`p-1.5 rounded-md transition ${tab === "calendar" ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"}`}
            >
              <CalendarDays size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => navigate("/my-activity")}
            className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            My activity →
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

      {/* Log tab — filters */}
      {tab === "log" && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isOfficeHead ? (
            <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
              {me.office?.name ?? "Your office"}
            </span>
          ) : (
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as Scope)}
              className={selectCls}
            >
              <option value="all">All</option>
              <option value="office">My office</option>
              <option value="mine">Mine</option>
            </select>
          )}

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className={selectCls}
          >
            <option value="">All categories</option>
            <option value="workflow">Workflow</option>
            <option value="request">Document Requests</option>
            <option value="document">Documents</option>
            <option value="user">User Management</option>
            <option value="template">Templates</option>
            <option value="profile">Profile &amp; Auth</option>
          </select>

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

          <DateRangeInput
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
          />

          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                if (!isOfficeHead) setScope("all");
                setCategory("");
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              Clear
            </button>
          )}

          {error && <Alert variant="danger">{error}</Alert>}
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
            gridTemplateColumns="13rem 1.2fr 1fr 11rem 9rem"
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
