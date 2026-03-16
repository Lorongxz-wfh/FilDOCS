import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import { listActivityLogs, getDocumentVersion } from "../services/documents";
import Modal from "../components/ui/Modal";
import ActivityCalendar from "../components/activityLogs/ActivityCalendar";
import { List, CalendarDays, X } from "lucide-react";

type Scope = "all" | "office" | "mine";
type Category = "" | "workflow" | "request" | "document" | "user" | "template" | "profile";

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
  "user.created": "User created",
  "user.updated": "User updated",
  "user.disabled": "User disabled",
  "user.enabled": "User re-enabled",
  "user.deleted": "User deleted",
  "office.created": "Office created",
  "office.updated": "Office updated",
  "office.disabled": "Office disabled",
  "office.restored": "Office restored",
};

function friendlyEvent(event: string): string {
  return EVENT_LABELS[event] ?? event.replace(/[._]/g, " ");
}

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="flex gap-3 py-2 border-b border-slate-100 dark:border-surface-400 last:border-0">
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-200 break-all">
        {value}
      </span>
    </div>
  );
}

function ActivityModal({
  row,
  onClose,
  onNavigate,
}: {
  row: any;
  onClose: () => void;
  onNavigate: (row: any) => void;
}) {
  const fromStatus = row.meta?.from_status;
  const toStatus = row.meta?.to_status;
  const note = row.meta?.note;
  const canNav = !!(
    row.document_version_id ||
    row.document_id ||
    row.meta?.document_request_id
  );

  return (
    <Modal
      open={true}
      title={friendlyEvent(row.event)}
      onClose={onClose}
      headerActions={
        canNav ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate(row);
            }}
            className="rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            Open →
          </button>
        ) : undefined
      }
    >
      <div className="space-y-0">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {formatWhen(row.created_at)}
        </p>
        <DetailRow label="Label" value={row.label ?? "—"} />
        {fromStatus && toStatus && (
          <DetailRow
            label="Transition"
            value={
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 dark:bg-surface-600 text-slate-600 dark:text-slate-400">
                  {fromStatus}
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2 py-0.5 rounded-full text-xs bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 font-medium">
                  {toStatus}
                </span>
              </span>
            }
          />
        )}
        {note && (
          <DetailRow
            label="Note"
            value={
              <span className="italic text-slate-600 dark:text-slate-400">
                "{note}"
              </span>
            }
          />
        )}
        <DetailRow
          label="Document"
          value={
            row.document?.title ??
            (row.document_id ? `#${row.document_id}` : "—")
          }
        />
        <DetailRow
          label="Version"
          value={row.document_version_id ? `v${row.document_version_id}` : "—"}
        />
        <DetailRow
          label="Actor"
          value={
            row.actor_user?.full_name ??
            row.actor_user?.name ??
            (row.actor_user_id ? `User #${row.actor_user_id}` : "—")
          }
        />
        <DetailRow
          label="Actor office"
          value={
            row.actor_office
              ? `${row.actor_office.name} (${row.actor_office.code})`
              : row.actor_office_id
                ? `Office #${row.actor_office_id}`
                : "—"
          }
        />
        <DetailRow
          label="Target office"
          value={
            row.target_office
              ? `${row.target_office.name} (${row.target_office.code})`
              : row.target_office_id
                ? `Office #${row.target_office_id}`
                : "—"
          }
        />
        {row.meta && (
          <DetailRow
            label="Meta"
            value={
              <pre className="text-xs bg-slate-50 dark:bg-surface-600 rounded-lg p-3 overflow-x-auto">
                {typeof row.meta === "string"
                  ? row.meta
                  : JSON.stringify(row.meta, null, 2)}
              </pre>
            }
          />
        )}
      </div>
    </Modal>
  );
}

type TabView = "log" | "calendar";

const ActivityLogsPage: React.FC = () => {
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const navigate = useNavigate();

  const [tab, setTab] = React.useState<TabView>("log");
  const [scope, setScope] = React.useState<Scope>("all");
  const [category, setCategory] = React.useState<Category>("");
  const [q, setQ] = React.useState("");
  const [qDebounced, setQDebounced] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [selectedRow, setSelectedRow] = React.useState<any | null>(null);

  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 400);
    return () => window.clearTimeout(t);
  }, [q]);

  const [rows, setRows] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [scope, qDebounced, category, dateFrom, dateTo]);

  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!hasMore && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listActivityLogs({
          scope,
          q: qDebounced.trim() || undefined,
          page,
          per_page: 25,
          category: category || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        if (!alive) return;
        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? null;
        setHasMore(
          meta?.current_page != null &&
            meta?.last_page != null &&
            meta.current_page < meta.last_page,
        );
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
  }, [page, scope, qDebounced, category, dateFrom, dateTo, hasMore]);

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

  const inputCls =
    "rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition";

  const hasFilters = category || q || dateFrom || dateTo || scope !== "all";

  const columns: TableColumn<any>[] = [
    {
      key: "when",
      header: "When",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatWhen(r.created_at)}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      render: (r) => (
        <span className="font-medium text-slate-800 dark:text-slate-200 truncate block group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
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
      key: "actor",
      header: "Actor",
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
      contentClassName="flex flex-col min-h-0 gap-4"
      right={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-0.5">
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
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
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
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
            className={inputCls}
          >
            <option value="all">All</option>
            <option value="office">My office</option>
            <option value="mine">Mine</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className={inputCls}
          >
            <option value="">All categories</option>
            <option value="workflow">Workflow</option>
            <option value="request">Document Requests</option>
            <option value="document">Documents</option>
            <option value="user">User Management</option>
            <option value="template">Templates</option>
            <option value="profile">Profile &amp; Auth</option>
          </select>

          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search event/label…"
              className={`${inputCls} w-56 pr-8`}
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

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className={inputCls}
            title="From date"
          />
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
              onClick={() => {
                setQ("");
                setScope("all");
                setCategory("");
                setDateFrom("");
                setDateTo("");
              }}
              className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              Clear
            </button>
          )}

          {error && <span className="text-xs text-rose-500">{error}</span>}
        </div>
      )}

      {/* Log tab — table */}
      {tab === "log" && (
        <div
          className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden"
          style={{ height: "calc(100vh - 230px)" }}
        >
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
          />
        </div>
      )}

      {selectedRow && (
        <ActivityModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onNavigate={handleRowNavigate}
        />
      )}
    </PageFrame>
  );
};

export default ActivityLogsPage;
