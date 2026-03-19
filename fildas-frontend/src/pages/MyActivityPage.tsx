import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import SkeletonList from "../components/ui/loader/SkeletonList";
import { getDocumentVersion, listActivityLogs } from "../services/documents";
import { Search, X, } from "lucide-react";
import { inputCls } from "../utils/formStyles";

type ActivityLogRow = {
  id: number;
  event: string;
  label?: string | null;
  document_id?: number | null;
  document_version_id?: number | null;
  meta?: any;
  created_at?: string | null;
};

type Category = "" | "workflow" | "request";

const EVENT_LABELS: Record<string, string> = {
  "auth.login": "Logged in",
  "auth.logout": "Logged out",
  "profile.updated": "Profile updated",
  "profile.password_changed": "Password changed",
  "workflow.distributed": "Document distributed",
  "workflow.sent_to_review": "Sent for review",
  "workflow.forwarded_to_vp": "Forwarded to VP",
  "workflow.forwarded_to_president": "Forwarded to President",
  "workflow.sent_to_approval": "Sent for approval",
  "workflow.sent_to_registration": "Sent for registration",
  "workflow.registered": "Document registered",
  "workflow.returned_to_draft": "Returned to draft",
  "workflow.returned_for_check": "Returned for final check",
  "workflow.rejected": "Rejected",
  "workflow.action": "Workflow action",
  "document.created": "Document created",
  "document.tags_updated": "Tags updated",
  "version.file_uploaded": "File uploaded",
  "version.file_replaced": "File replaced",
  "version.signed_file_uploaded": "Signed document uploaded",
  "version.updated": "Draft updated",
  "version.revision_created": "Revision started",
  "version.cancelled": "Version cancelled",
  "version.deleted": "Draft deleted",
  "version.previewed": "Document previewed",
  "version.downloaded": "Document downloaded",
  "message.posted": "Comment posted",
  "document_request.created": "Document request created",
  "document_request.updated": "Request updated",
  "document_request.submission.submitted": "Submission uploaded",
  "document_request.submission.reviewed": "Submission reviewed",
  "document_request.submission.accepted": "Submission accepted",
  "document_request.submission.rejected": "Submission rejected",
  "document_request.message.posted": "Request comment posted",
};

function friendlyEvent(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/[._]/g, " ");
}

function categoryFromEvent(event: string): "workflow" | "request" | "other" {
  if (
    event.startsWith("workflow.") ||
    event.startsWith("document.") ||
    event.startsWith("version.") ||
    event.startsWith("message.")
  )
    return "workflow";
  if (event.startsWith("document_request")) return "request";
  return "other";
}

const CATEGORY_BADGE: Record<string, string> = {
  workflow: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  request:
    "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
  other: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
};

const formatWhen = (iso?: string | null) => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
};

function canNavigateTo(row: ActivityLogRow): boolean {
  return !!(
    row.document_version_id ||
    row.document_id ||
    row.meta?.document_request_id
  );
}

const MyActivityPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Pre-select category from router state (e.g. from Work Queue "View all")
  const initialCategory = ((location.state as any)?.category as Category) ?? "";

  const [page, setPage] = useState(1);
  const perPage = 25;
  const [rows, setRows] = useState<ActivityLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  // Filters
  const [category, setCategory] = useState<Category>(initialCategory);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 350);
    return () => window.clearTimeout(t);
  }, [q]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [category, qDebounced, dateFrom, dateTo]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res: any = await listActivityLogs({
          scope: "mine",
          per_page: perPage,
          page,
          q: qDebounced.trim() || undefined,
          category: category || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        if (!alive) return;
        setRows((res?.data ?? []) as ActivityLogRow[]);
        setCurrentPage(
          Number(res?.meta?.current_page ?? res?.current_page ?? page),
        );
        setLastPage(Number(res?.meta?.last_page ?? res?.last_page ?? 1));
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load activity");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [page, category, qDebounced, dateFrom, dateTo]);

  const openByVersionId = async (versionId: number) => {
    try {
      const { document } = await getDocumentVersion(versionId);
      navigate(`/documents/${document.id}`, {
        state: { from: "/my-activity" },
      });
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
      navigate(`/documents/${row.document_id}`, {
        state: { from: "/my-activity" },
      });
    }
  };

  const canPrev = currentPage > 1;
  const canNext = currentPage < lastPage;

  const hasFilters = category || q || dateFrom || dateTo;

  const clearFilters = () => {
    setCategory("");
    setQ("");
    setDateFrom("");
    setDateTo("");
  };


  return (
    <PageFrame
      title="My Activity"
      contentClassName="flex flex-col gap-4 h-full"
      onBack={() => navigate(-1)}
    >
      {/* Filters bar */}
      <div className="shrink-0 flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search event/label…"
            className={`${inputCls} pl-9 pr-8 w-full`}
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

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className={inputCls}
        >
          <option value="">All categories</option>
          <option value="workflow">Workflow</option>
          <option value="request">Requests</option>
        </select>

        {/* Date from */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className={inputCls}
          title="From date"
        />

        {/* Date to */}
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className={inputCls}
          title="To date"
        />

        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}

        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      {/* Table card */}
      <div className="flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex-1 min-h-0">
        {/* Card header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-5 py-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Activity log
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Actions you performed
              {category &&
                ` · ${category === "workflow" ? "Workflow" : "Requests"}`}
            </p>
          </div>
          {/* Pagination */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!canPrev || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
            >
              ← Prev
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
              {currentPage} / {lastPage}
            </span>
            <button
              type="button"
              disabled={!canNext || loading}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
            >
              Next →
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <SkeletonList rows={8} rowClassName="h-12 rounded-xl" />
          ) : rows.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-sm text-slate-400 dark:text-slate-500">
                No activity found.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((l) => {
                const cat = categoryFromEvent(l.event);
                const navigable = canNavigateTo(l);
                return (
                  <div
                    key={l.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3"
                  >
                    {/* Category dot */}
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${CATEGORY_BADGE[cat]}`}
                    >
                      {cat === "workflow"
                        ? "Flow"
                        : cat === "request"
                          ? "Request"
                          : "Other"}
                    </span>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {l.label || friendlyEvent(l.event)}
                      </p>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                        {l.event}
                      </p>
                    </div>

                    {/* When */}
                    <div className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 hidden sm:block">
                      {formatWhen(l.created_at)}
                    </div>

                    {/* Navigate button */}
                    {navigable && (
                      <button
                        type="button"
                        onClick={() => handleRowNavigate(l)}
                        className="shrink-0 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                      >
                        Open →
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </PageFrame>
  );
};

export default MyActivityPage;
