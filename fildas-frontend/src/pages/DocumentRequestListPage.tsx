import React from "react";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import PageFrame from "../components/layout/PageFrame.tsx";
import Table, { type TableColumn } from "../components/ui/Table";
import {
  listDocumentRequestInbox,
  listDocumentRequests,
  listDocumentRequestIndividual,
  type DocumentRequestProgress,
} from "../services/documentRequests";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth.ts";
import CreateDocumentRequestModal from "../components/documentRequests/CreateDocumentRequestModal";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import {
  LayoutList,
  TableProperties,
  Users,
  FileStack,
} from "lucide-react";
import { selectCls, tabCls } from "../utils/formStyles";
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";
import { formatDate } from "../utils/formatters";
import MiddleTruncate from "../components/ui/MiddleTruncate";
import { StatusBadge, TypePill } from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import SelectDropdown from "../components/ui/SelectDropdown";


type ViewTab = "batches" | "all";

function roleLower(me: any) {
  const raw =
    (typeof me?.role === "string" ? me?.role : me?.role?.name) ??
    me?.role_name ??
    "";
  return String(raw).trim().toLowerCase();
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ── 3-layer progress bar ───────────────────────────────────────────────────
const ProgressBar: React.FC<{ progress: DocumentRequestProgress | undefined | null }> = ({
  progress,
}) => {
  if (!progress) return null;
  const { total, submitted, accepted } = progress;
  if (total === 0) return null;
  const submittedPct = Math.round((submitted / total) * 100);
  const acceptedPct = Math.round((accepted / total) * 100);
  return (
    <div className="flex items-center gap-3 min-w-0 pr-4">
      <div className="relative flex-1 h-2 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden shadow-inner">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-sky-200 dark:bg-sky-700/50 transition-all duration-500"
          style={{ width: `${submittedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-500 dark:bg-brand-400 transition-all duration-500 shadow-sm"
          style={{ width: `${acceptedPct}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums w-12 text-right">
        {total > 0 ? Math.round((accepted / total) * 100) : 0}%
      </span>
    </div>
  );
};

// ── Mode badge ─────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const isMultiDoc = mode === "multi_doc";
  return (
    <TypePill
      label={isMultiDoc ? "Multi-doc" : "Multi-office"}
      icon={
        isMultiDoc ? (
          <FileStack className="h-2.5 w-2.5" />
        ) : (
          <Users className="h-2.5 w-2.5" />
        )
      }
    />
  );
}

// ── Reusable Cells ────────────────────────────────────────────────────────────

function NormalText({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <span className={`text-xs ${secondary ? "text-slate-500 dark:text-slate-400" : "font-medium text-slate-700 dark:text-slate-300"}`}>
      {children || "—"}
    </span>
  );
}

function TypeText({ type }: { type: string }) {
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
      {type?.toLowerCase() || "—"}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DocumentRequestListPage() {
  const me = getAuthUser();
  const role = roleLower(me);
  const adminDebugMode = useAdminDebugMode();
  const isQaAdmin =
    ["qa", "sysadmin"].includes(role) || (role === "admin" && adminDebugMode);

  const [tab, setTab] = React.useState<ViewTab>("batches");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<
    "" | "open" | "closed" | "cancelled"
  >("");
  const [recipientStatus, setRecipientStatus] = React.useState<
    "" | "pending" | "submitted" | "accepted" | "rejected"
  >("");
  const location = useLocation();
  const [createOpen, setCreateOpen] = React.useState(
    () => (location.state as any)?.openModal === true,
  );
  const [sortBy, setSortBy] = React.useState<string>("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (status) count++;
    if (recipientStatus) count++;
    return count;
  }, [status, recipientStatus]);

  const [rows, setRows] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const hasMoreRef = React.useRef(true);

  const qDebounced = useDebouncedValue(q, 400);
  const navigate = useNavigate();

  const reloadRequests = React.useCallback(async (silent = false) => {
    if (!silent) {
      setRows([]);
      setPage(1);
      setHasMore(true);
      setInitialLoading(true);
    } else {
      setPage(1);
    }
  }, []);

  const { refresh: refreshRequests, refreshing: refreshingRequests } =
    usePageBurstRefresh(reloadRequests);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      reloadRequests(true).catch(() => { });
    }, 30_000);
    return () => window.clearInterval(id);
  }, [reloadRequests]);

  // Reset on filter/tab/sort change
  React.useEffect(() => {
    setRows([]);
    setPage(1);
    hasMoreRef.current = true;
    setHasMore(true);
    setInitialLoading(true);
  }, [tab, qDebounced, status, recipientStatus, isQaAdmin, sortBy, sortDir]);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!hasMoreRef.current && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const baseParams = {
          q: qDebounced.trim() || undefined,
          per_page: 10,
          page,
          sort_by: sortBy,
          sort_dir: sortDir,
        };
        let data: any;

        if (tab === "all") {
          data = await listDocumentRequestIndividual({
            ...baseParams,
            request_status: isQaAdmin ? status || undefined : undefined,
            status: recipientStatus || undefined,
          });
        } else if (isQaAdmin) {
          data = await listDocumentRequests({
            ...baseParams,
            status: status || undefined,
          });
        } else {
          data = await listDocumentRequestInbox(baseParams);
        }

        if (!alive) return;
        const incoming = Array.isArray(data?.data) ? data.data : [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const more =
          data?.current_page != null &&
          data?.last_page != null &&
          data.current_page < data.last_page;
        hasMoreRef.current = more;
        setHasMore(more);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.response?.data?.message ?? e?.message ?? "Failed to load.");
      } finally {
        if (alive) {
          setLoading(false);
          setInitialLoading(false);
        }
      }
    };
    const safety = window.setTimeout(() => {
      if (alive && initialLoading) {
        setInitialLoading(false);
        setLoading(false);
      }
    }, 5000);

    load();
    return () => {
      alive = false;
      window.clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, qDebounced, status, recipientStatus, isQaAdmin, sortBy, sortDir]);

  function handleBatchRowClick(row: any) {
    if (isQaAdmin || row.mode === "multi_doc") {
      navigate(`/document-requests/${row.id}`);
    } else {
      navigate(`/document-requests/${row.id}/recipients/${row.recipient_id}`);
    }
  }

  function handleRecipientRowClick(row: any) {
    if (row.row_type === "item") {
      navigate(`/document-requests/${row.request_id}/items/${row.item_id}`);
    } else {
      navigate(
        `/document-requests/${row.request_id}/recipients/${row.recipient_id}`,
      );
    }
  }

  const batchColumns: TableColumn<any>[] = React.useMemo(() => {
    return [
      {
        key: "mode",
        header: "Batch Type",
        skeletonShape: "narrow",
        render: (row) => <ModeBadge mode={row.mode} />,
      },
      {
        key: "title",
        header: "Batch Request",
        sortKey: "title",
        skeletonShape: "text",
        render: (row) => (
          <div className="min-w-0 pr-4">
            <MiddleTruncate
              text={row.title}
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
            />
          </div>
        ),
      },
      {
        key: "progress",
        header: "Progress",
        skeletonShape: "narrow",
        render: (row) => {
          const displayProgress =
            isQaAdmin || row.mode === "multi_doc"
              ? row.progress
              : {
                total: 1,
                submitted:
                  row.recipient_status === "submitted" ||
                    row.recipient_status === "accepted"
                    ? 1
                    : 0,
                accepted: row.recipient_status === "accepted" ? 1 : 0,
              };
          return <ProgressBar progress={displayProgress} />;
        }
      },
      {
        key: "status",
        header: "Status",
        skeletonShape: "badge",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "dates",
        header: "Deadline",
        sortKey: "due_at",
        skeletonShape: "narrow",
        align: "right",
        render: (row) => (
          <NormalText secondary>
            {row.due_at ? formatDate(row.due_at) : formatDate(row.created_at)}
          </NormalText>
        ),
      },
    ];
  }, [isQaAdmin]);

  const batchGrid = "100px minmax(120px, 1fr) 240px 100px 140px";

  const allColumns: TableColumn<any>[] = React.useMemo(() => {
    return [
      {
        key: "title",
        header: "Document Requested",
        sortKey: "title",
        skeletonShape: "text",
        render: (r) => (
          <div className="min-w-0 pr-4">
            <MiddleTruncate
              text={r.item_title ?? r.batch_title}
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
            />
            {r.item_title && r.batch_title && (
              <MiddleTruncate
                text={r.batch_title}
                className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5"
              />
            )}
          </div>
        ),
      },
      {
        key: "item_status",
        header: "Status",
        skeletonShape: "badge",
        render: (r) => <StatusBadge status={r.item_status || "Pending"} />,
      },
      {
        key: "mode",
        header: "Batch Type",
        skeletonShape: "narrow",
        render: (r) => <TypeText type={r.batch_mode || "REQUEST"} />,
      },
      {
        key: "batch_status",
        header: "Batch Status",
        skeletonShape: "narrow",
        render: (r) => <NormalText secondary>{r.batch_status}</NormalText>,
      },
      {
        key: "office",
        header: "Office",
        skeletonShape: "narrow",
        render: (r) => (
          <NormalText secondary>
            {r.office_code || r.office_name || "—"}
          </NormalText>
        ),
      },
      {
        key: "due",
        header: "Deadline",
        skeletonShape: "narrow",
        align: "right",
        render: (r) => (
          <NormalText secondary>
            {r.due_at ? formatDate(r.due_at) : formatDate(r.created_at)}
          </NormalText>
        ),
      },
      {
        key: "batch_due",
        header: "Batch Deadline",
        skeletonShape: "narrow",
        align: "right",
        render: (r) => (
          <NormalText secondary>
            {r.batch_due_at ? formatDate(r.batch_due_at) : "—"}
          </NormalText>
        ),
      },
    ];
  }, []);

  const gridCols = "minmax(120px, 1fr) 100px 100px 110px 100px 140px 140px";

  return (
    <PageFrame
      title="Document Requests"
      right={
        <PageActions>
          <RefreshAction
            onRefresh={refreshRequests}
            loading={refreshingRequests}
          />
          {isQaAdmin && (
            <CreateAction
              label="Create request"
              onClick={() => setCreateOpen(true)}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto hide-scrollbar">
        <button
          type="button"
          onClick={() => {
            setTab("batches");
            setRecipientStatus("");
          }}
          className={tabCls(tab === "batches")}
        >
          <LayoutList className="h-3.5 w-3.5" />
          Request Batches
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("all");
            setStatus("");
          }}
          className={tabCls(tab === "all")}
        >
          <TableProperties className="h-3.5 w-3.5" />
          All Requests
        </button>
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search title/description…"
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setQ("");
          setStatus("");
          setRecipientStatus("");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {isQaAdmin && tab === "batches" && (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                  <SelectDropdown
                    value={status}
                    onChange={(val) => {
                      setStatus(val as any);
                      setPage(1);
                    }}
                    className="w-full"
                    options={[
                      { value: "", label: "All statuses" },
                      { value: "open", label: "Open" },
                      { value: "closed", label: "Closed" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                  />
                </div>
              )}

              {tab === "all" && (
                <>
                  {isQaAdmin && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Batch</label>
                      <SelectDropdown
                        value={status}
                        onChange={(val) => {
                          setStatus(val as any);
                          setPage(1);
                        }}
                        className="w-full"
                        options={[
                          { value: "", label: "All batches" },
                          { value: "open", label: "Open" },
                          { value: "closed", label: "Closed" },
                          { value: "cancelled", label: "Cancelled" },
                        ]}
                      />
                    </div>
                  )}
                  <div className={`flex flex-col gap-1.5 ${isQaAdmin ? "" : "col-span-2"}`}>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Progress</label>
                    <SelectDropdown
                      value={recipientStatus}
                      onChange={(val) => {
                        setRecipientStatus(val as any);
                        setPage(1);
                      }}
                      className="w-full"
                      options={[
                        { value: "", label: "All progress" },
                        { value: "pending", label: "Pending" },
                        { value: "submitted", label: "Submitted" },
                        { value: "accepted", label: "Accepted" },
                        { value: "rejected", label: "Rejected" },
                      ]}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        }
      >
        {isQaAdmin && tab === "batches" && (
          <SelectDropdown
            value={status}
            onChange={(val) => {
              setStatus(val as any);
              setPage(1);
            }}
            className="w-32"
            options={[
              { value: "", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        )}

        {tab === "all" && (
          <>
            {isQaAdmin && (
              <SelectDropdown
                value={status}
                onChange={(val) => {
                  setStatus(val as any);
                  setPage(1);
                }}
                className="w-32"
                options={[
                  { value: "", label: "All batches" },
                  { value: "open", label: "Open" },
                  { value: "closed", label: "Closed" },
                  { value: "cancelled", label: "Cancelled" },
                ]}
              />
            )}
            <SelectDropdown
              value={recipientStatus}
              onChange={(val) => {
                setRecipientStatus(val as any);
                setPage(1);
              }}
              className="w-32"
              options={[
                { value: "", label: "All progress" },
                { value: "pending", label: "Pending" },
                { value: "submitted", label: "Submitted" },
                { value: "accepted", label: "Accepted" },
                { value: "rejected", label: "Rejected" },
              ]}
            />
          </>
        )}
      </SearchFilterBar>

      {error && !loading && <Alert variant="danger" className="mt-4">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        {tab === "batches" && (
          <Table<any>
            bare
            className="h-full"
            columns={batchColumns}
            rows={rows}
            rowKey={(r: any, idx) => r.id || `batch-${idx}`}
            onRowClick={handleBatchRowClick}
            loading={loading}
            initialLoading={initialLoading}
            emptyMessage={q || status ? "No requests match your filters." : "No requests found."}
            hasMore={hasMore}
            onLoadMore={() => setPage((p) => p + 1)}
            mobileRender={(r) => (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                    {r.mode || r.batch_mode || "REQUEST"}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {formatDate(r.due_at || r.created_at)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                  {r.title || r.item_title || r.batch_title}
                </p>
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {r.office_code || r.office_name || "—"}
                  </span>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                    {r.status || r.item_status || "Open"}
                  </span>
                </div>
              </div>
            )}
            gridTemplateColumns={batchGrid}
            sortBy={sortBy}
            sortDir={sortDir as any}
            onSortChange={(key, dir) => {
              setSortBy(key);
              setSortDir(dir);
            }}
          />
        )}

        {tab === "all" && (
          <Table<any>
            bare
            className="h-full"
            columns={allColumns}
            rows={rows}
            rowKey={(r: any, idx) => `${r.row_type}-${r.row_id}-${idx}`}
            onRowClick={handleRecipientRowClick}
            loading={loading}
            initialLoading={initialLoading}
            emptyMessage={q || status || recipientStatus ? "No matches found." : "No requests found."}
            hasMore={hasMore}
            onLoadMore={() => setPage((p) => p + 1)}
            mobileRender={(r) => (
              <div className="px-4 py-3 bg-white dark:bg-surface-500 border-b border-slate-100 dark:border-surface-400">
                <div className="flex items-center justify-between mb-1">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">
                    {r.batch_mode || "REQUEST"}
                  </span>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {formatDate(r.due_at || r.created_at)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                  {r.item_title ?? r.batch_title}
                </p>
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {r.office_code || r.office_name || "—"}
                  </span>
                  <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                    {r.item_status || "Pending"}
                  </span>
                </div>
              </div>
            )}
            gridTemplateColumns={gridCols}
            sortBy={sortBy}
            sortDir={sortDir as any}
            onSortChange={(key, dir) => {
              setSortBy(key);
              setSortDir(dir);
            }}
          />
        )}
      </div>

      <CreateDocumentRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </PageFrame>
  );
}
