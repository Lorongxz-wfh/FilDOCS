import React from "react";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import PageFrame from "../components/layout/PageFrame.tsx";
import Button from "../components/ui/Button.tsx";
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
  Search,
  X,
  Users,
  FileStack,
  LayoutList,
  TableProperties,
} from "lucide-react";
import { inputCls, selectCls } from "../utils/formStyles";
import { formatDate } from "../utils/formatters";
import { StatusBadge, TypePill } from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import LoadMoreButton from "../components/ui/LoadMoreButton";
import RefreshButton from "../components/ui/RefreshButton";

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
const ProgressBar: React.FC<{ progress: DocumentRequestProgress }> = ({
  progress,
}) => {
  const { total, submitted, accepted } = progress;
  if (total === 0) return null;
  const submittedPct = Math.round((submitted / total) * 100);
  const acceptedPct = Math.round((accepted / total) * 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="relative flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-surface-400 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-sky-300 dark:bg-sky-700 transition-all"
          style={{ width: `${submittedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
          style={{ width: `${acceptedPct}%` }}
        />
      </div>
      <span className="shrink-0 text-[10px] font-medium text-slate-400 dark:text-slate-500 tabular-nums">
        {accepted}/{total}
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

// ── Batch request row (card style) ─────────────────────────────────────────
const RequestRow: React.FC<{
  row: any;
  isQaAdmin: boolean;
  onClick: () => void;
}> = ({ row, isQaAdmin, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition border-b border-slate-100 dark:border-surface-400 last:border-0"
  >
    <div className="flex-1 min-w-0 flex flex-col gap-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          {row.title}
        </span>
        {isQaAdmin && <ModeBadge mode={row.mode} />}
        <StatusBadge status={row.status} />
      </div>
      {row.progress && <ProgressBar progress={row.progress} />}
    </div>

    {isQaAdmin && (
      <div className="shrink-0 hidden sm:block text-xs text-slate-400 dark:text-slate-500 text-right">
        {row.office_name ?? "—"}
        {row.office_code && (
          <span className="ml-1 text-slate-300 dark:text-slate-600">
            ({row.office_code})
          </span>
        )}
      </div>
    )}

    <div className="shrink-0 hidden md:flex flex-col items-end gap-0.5">
      {row.due_at && (
        <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          Due {formatDate(row.due_at)}
        </span>
      )}
      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        {formatDate(row.created_at)}
      </span>
    </div>
  </button>
);

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

  const [rows, setRows] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const hasMoreRef = React.useRef(true);

  const qDebounced = useDebouncedValue(q, 400);
  const navigate = useNavigate();

  const reloadRequests = React.useCallback(async () => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, []);

  const { refresh: refreshRequests, refreshing: refreshingRequests } =
    usePageBurstRefresh(reloadRequests);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      reloadRequests().catch(() => {});
    }, 30_000);
    return () => window.clearInterval(id);
  }, [reloadRequests]);

  // Reset on filter/tab change
  React.useEffect(() => {
    setRows([]);
    setPage(1);
    hasMoreRef.current = true;
    setHasMore(true);
    setInitialLoading(true);
  }, [tab, qDebounced, status, recipientStatus, isQaAdmin]);

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
  }, [tab, page, qDebounced, status, recipientStatus, isQaAdmin]);

  function handleBatchRowClick(row: any) {
    // Batches tab: row.id = batch id, row.recipient_id from inbox
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

  function RecipientStatusBadge({ status }: { status: string }) {
    return <StatusBadge status={status} />;
  }

  // ── Table columns for "All Requests" tab (individual items/recipients) ────
  const allColumns: TableColumn<any>[] = React.useMemo(() => {
    const cols: TableColumn<any>[] = [
      {
        key: "title",
        header: "Request",
        render: (r) => {
          const primary = r.item_title ?? r.batch_title;
          const sub = r.item_title ? r.batch_title : r.office_name;
          return (
            <div className="min-w-0">
              <div className="font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
                {primary}
              </div>
              {sub && (
                <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                  {sub}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "mode",
        header: "Type",
        render: (r) => <ModeBadge mode={r.batch_mode} />,
      },
      {
        key: "batch_status",
        header: "Batch",
        render: (r) => <StatusBadge status={r.batch_status} />,
      },
      {
        key: "item_status",
        header: "Status",
        render: (r) => (
          <RecipientStatusBadge status={r.item_status ?? "pending"} />
        ),
      },
      {
        key: "due",
        header: "Due",
        render: (r) =>
          r.due_at ? (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
              {formatDate(r.due_at)}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
      {
        key: "created",
        header: "Created",
        render: (r) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {formatDate(r.created_at)}
          </span>
        ),
      },
    ];

    // Office column for QA/Admin (after item_status, before Due)
    if (isQaAdmin) {
      cols.splice(4, 0, {
        key: "office",
        header: "Office",
        render: (r) => (
          <div className="min-w-0">
            <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
              {r.office_name ?? "—"}
            </div>
            {r.office_code && (
              <div className="text-[10px] text-slate-400 dark:text-slate-500">
                {r.office_code}
              </div>
            )}
          </div>
        ),
      });
    }

    return cols;
  }, [isQaAdmin]);

  const gridCols = isQaAdmin
    ? "2fr 8rem 6rem 7rem 9rem 7rem 7rem"
    : "2fr 8rem 6rem 7rem 7rem 7rem";

  return (
    <PageFrame
      title="Document Requests"
      right={
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={refreshRequests}
            loading={refreshingRequests}
            disabled={loading}
            title="Refresh requests"
          />
          {isQaAdmin && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              Create request
            </Button>
          )}
        </div>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0">
        <button
          type="button"
          onClick={() => {
            setTab("batches");
            setRecipientStatus("");
          }}
          className={[
            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px",
            tab === "batches"
              ? "border-sky-500 text-sky-600 dark:text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
          ].join(" ")}
        >
          <LayoutList className="h-3.5 w-3.5" />
          Batches
        </button>
        <button
          type="button"
          onClick={() => {
            setTab("all");
            setStatus("");
          }}
          className={[
            "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px",
            tab === "all"
              ? "border-sky-500 text-sky-600 dark:text-sky-400"
              : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
          ].join(" ")}
        >
          <TableProperties className="h-3.5 w-3.5" />
          All Requests
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-4 pb-0">
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title/description…"
            className={`${inputCls} pl-9 pr-8`}
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
        {/* Batch status filter — batches tab (QA only) */}
        {isQaAdmin && tab === "batches" && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className={selectCls}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        {/* All Requests tab: batch status + recipient status filters */}
        {tab === "all" && (
          <>
            {isQaAdmin && (
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className={selectCls}
              >
                <option value="">All batches</option>
                <option value="open">Open</option>
                <option value="closed">Closed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            )}
            <select
              value={recipientStatus}
              onChange={(e) => setRecipientStatus(e.target.value as any)}
              className={selectCls}
            >
              <option value="">All progress</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </>
        )}
        {error && <Alert variant="danger">{error}</Alert>}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 mt-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        {/* ── Batches tab ── */}
        {tab === "batches" && (
          <div className="h-full overflow-y-auto">
            {initialLoading ? (
              <div className="divide-y divide-slate-100 dark:divide-surface-400">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="px-4 py-3 flex items-center gap-4">
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 w-2/3 rounded-md bg-slate-100 dark:bg-surface-400 animate-pulse" />
                      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-surface-400 animate-pulse" />
                    </div>
                    <div className="h-3 w-20 rounded-md bg-slate-100 dark:bg-surface-400 animate-pulse" />
                  </div>
                ))}
              </div>
            ) : rows.length === 0 ? (
              <EmptyState label="No requests found." />
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-surface-400">
                {rows.map((row) => (
                  <RequestRow
                    key={row.id}
                    row={row}
                    isQaAdmin={isQaAdmin}
                    onClick={() => handleBatchRowClick(row)}
                  />
                ))}
                {hasMore && (
                  <LoadMoreButton
                    loading={loading}
                    onClick={() => setPage((p) => p + 1)}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* ── All Requests tab ── */}
        {tab === "all" && (
          <Table
            bare
            className="h-full"
            columns={allColumns}
            rows={rows}
            rowKey={(r) => `${r.row_type}-${r.row_id}`}
            onRowClick={handleRecipientRowClick}
            loading={loading}
            initialLoading={initialLoading}
            error={error}
            emptyMessage="No requests found."
            hasMore={hasMore}
            onLoadMore={() => setPage((p) => p + 1)}
            gridTemplateColumns={gridCols}
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
