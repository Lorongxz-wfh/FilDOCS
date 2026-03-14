import React from "react";
import PageFrame from "../components/layout/PageFrame.tsx";
import Button from "../components/ui/Button.tsx";
import {
  listDocumentRequestInbox,
  listDocumentRequests,
  type DocumentRequestProgress,
} from "../services/documentRequests";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth.ts";
import CreateDocumentRequestModal from "../components/documentRequests/CreateDocumentRequestModal";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { RefreshCw, Search, X, Users, FileStack } from "lucide-react";

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

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
        {/* submitted layer */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-sky-300 dark:bg-sky-700 transition-all"
          style={{ width: `${submittedPct}%` }}
        />
        {/* accepted layer — on top */}
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

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const s = String(status).toLowerCase();
  const map: Record<string, string> = {
    open: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    closed:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-surface-400 dark:text-slate-400 dark:border-surface-300",
    cancelled:
      "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    pending:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
  };
  const cls = map[s] ?? "bg-slate-100 text-slate-600 border-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${cls}`}
    >
      {String(status).toUpperCase()}
    </span>
  );
}

// ── Mode badge ─────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const isMultiDoc = mode === "multi_doc";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        isMultiDoc
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400"
          : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400",
      ].join(" ")}
    >
      {isMultiDoc ? (
        <FileStack className="h-2.5 w-2.5" />
      ) : (
        <Users className="h-2.5 w-2.5" />
      )}
      {isMultiDoc ? "Multi-Doc" : "Multi-Office"}
    </span>
  );
}

// ── Request row ────────────────────────────────────────────────────────────
const RequestRow: React.FC<{
  row: any;
  isQaAdmin: boolean;
  onClick: () => void;
}> = ({ row, isQaAdmin, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition border-b border-slate-100 dark:border-surface-400 last:border-0"
    >
      {/* Title + mode */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {row.title}
          </span>
          {isQaAdmin && <ModeBadge mode={row.mode} />}
          <StatusBadge status={row.status} />
        </div>
        {/* Progress bar */}
        {row.progress && <ProgressBar progress={row.progress} />}
      </div>

      {/* Office info — QA only */}
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

      {/* Due + created */}
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
};

export default function DocumentRequestListPage() {
  const me = getAuthUser();
  const role = roleLower(me);
  const isQaAdmin = ["qa", "sysadmin", "admin"].includes(role);

  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<
    "" | "open" | "closed" | "cancelled"
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
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [qDebounced, status, isQaAdmin]);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!hasMore && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const params: any = {
          q: qDebounced.trim() || undefined,
          per_page: 25,
          page,
        };
        if (isQaAdmin) params.status = status || undefined;

        const data = isQaAdmin
          ? await listDocumentRequests(params)
          : await listDocumentRequestInbox(params);

        if (!alive) return;

        const incoming = Array.isArray(data?.data) ? data.data : [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        setHasMore(
          data?.current_page != null &&
            data?.last_page != null &&
            data.current_page < data.last_page,
        );
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
  }, [page, qDebounced, status, isQaAdmin, hasMore]);

  return (
    <PageFrame
      title="Document Requests"
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refreshRequests}
            disabled={refreshingRequests || loading}
            title="Refresh requests"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshingRequests ? "animate-spin" : ""}`}
            />
          </button>
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
      contentClassName="flex flex-col min-h-0 gap-4"
    >
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title/description…"
            className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {isQaAdmin && (
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition"
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        )}
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      {/* List */}
      <div
        className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden overflow-y-auto"
        style={{ height: "calc(100vh - 217px)" }}
      >
        {initialLoading ? (
          <div className="space-y-0 divide-y divide-slate-100 dark:divide-surface-400">
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
          <div className="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            No requests found.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-surface-400">
            {rows.map((row) => (
              <RequestRow
                key={row.id}
                row={row}
                isQaAdmin={isQaAdmin}
                onClick={() => {
                  if (isQaAdmin) {
                    navigate(`/document-requests/${row.id}`);
                  } else {
                    navigate(
                      `/document-requests/${row.id}/recipients/${row.recipient_id}`,
                    );
                  }
                }}
              />
            ))}
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <CreateDocumentRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </PageFrame>
  );
}
