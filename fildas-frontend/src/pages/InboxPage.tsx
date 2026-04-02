import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import { Search, X, Trash2, BellOff } from "lucide-react";
import RefreshButton from "../components/ui/RefreshButton";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  deleteAllNotifications,
  type NotificationItem,
} from "../services/documents";

// ── Filter type ───────────────────────────────────────────────────────────────
type FilterTab = "all" | "unread" | "read";

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ filtered: boolean }> = ({ filtered }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400 mb-3">
      <BellOff className="h-5 w-5 text-slate-400 dark:text-slate-500" />
    </div>
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
      {filtered ? "No matching notifications" : "Your inbox is empty"}
    </p>
    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
      {filtered
        ? "Try changing your filter or search query."
        : "You're all caught up. New notifications will appear here."}
    </p>
  </div>
);

// ── Notification card ─────────────────────────────────────────────────────────
const NotifCard: React.FC<{
  n: NotificationItem;
  onOpen: (n: NotificationItem) => void;
  onDelete: (id: number) => void;
}> = ({ n, onOpen, onDelete }) => {
  const isUnread = !n.read_at;

  return (
    <div
      className={[
        "group relative flex items-start gap-3 rounded-xl border px-4 py-3.5 transition",
        isUnread
          ? "border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/30 dark:hover:bg-sky-900/40"
          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:hover:bg-surface-400",
      ].join(" ")}
    >
      {/* Unread dot */}
      <div className="mt-1 shrink-0 flex items-center justify-center w-4">
        {isUnread && (
          <span className="h-2 w-2 rounded-full bg-sky-500 shrink-0" />
        )}
      </div>

      {/* Content — clickable */}
      <button
        type="button"
        className="flex-1 min-w-0 text-left"
        onClick={() => onOpen(n)}
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {n.title}
        </p>
        {n.body && (
          <p
            className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: n.body }}
          />
        )}
        <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
          {new Date(n.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </button>

      {/* Delete button — appears on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(n.id);
        }}
        title="Delete notification"
        className="shrink-0 mt-0.5 rounded-md p-1.5 text-slate-300 dark:text-slate-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-500 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const PER_PAGE = 25;

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [deletingAll, setDeletingAll] = React.useState(false);
  const [confirmClearAll, setConfirmClearAll] = React.useState(false);

  // ── Filters ──────────────────────────────────────────────────────────────
  const [tab, setTab] = React.useState<FilterTab>("all");
  const [search, setSearch] = React.useState("");

  // ── Load ─────────────────────────────────────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    async function load() {
      try {
        if (page === 1) setLoading(true);
        else setLoadingMore(true);
        setError(null);

        const res = await listNotifications({ page, perPage: PER_PAGE });
        if (!alive) return;

        setItems((prev) => {
          const next = page === 1 ? res.data : [...prev, ...res.data];
          const byId = new Map<number, NotificationItem>();
          for (const n of next) byId.set(n.id, n);
          return Array.from(byId.values());
        });
        setHasMore(Boolean(res.links?.next));
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load notifications.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setLoadingMore(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [page, reloadTick]);

  // ── Client-side filter ────────────────────────────────────────────────────
  const filtered = React.useMemo(() => {
    let list = items;
    if (tab === "unread") list = list.filter((n) => !n.read_at);
    if (tab === "read") list = list.filter((n) => !!n.read_at);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) =>
          n.title?.toLowerCase().includes(q) ||
          n.body?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [items, tab, search]);

  const unreadCount = React.useMemo(
    () => items.filter((n) => !n.read_at).length,
    [items],
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleOpen = async (n: NotificationItem) => {
    try {
      if (!n.read_at) {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) =>
            x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x,
          ),
        );
      }
      if (n.document_id) navigate(`/documents/${n.document_id}`);
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch {
      /* ignore */
    }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setItems((prev) =>
        prev.map((n) => ({
          ...n,
          read_at: n.read_at ?? new Date().toISOString(),
        })),
      );
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3000);
      return;
    }
    try {
      setDeletingAll(true);
      await deleteAllNotifications();
      setItems([]);
      setConfirmClearAll(false);
    } finally {
      setDeletingAll(false);
    }
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "unread", label: "Unread" },
    { key: "read", label: "Read" },
  ];

  return (
    <PageFrame
      title="Inbox"
      subtitle={
        unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`
          : undefined
      }
      right={
        <div className="flex items-center gap-2">
          <RefreshButton
            onClick={() => { setItems([]); setPage(1); setReloadTick((t) => t + 1); }}
            loading={loading}
            title="Refresh inbox"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={markingAll || loading || unreadCount === 0}
            onClick={handleMarkAllRead}
          >
            {markingAll ? "Marking…" : "Mark all read"}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={deletingAll || loading || items.length === 0}
            onClick={handleClearAll}
            className={
              confirmClearAll
                ? "border-rose-400 text-rose-600 dark:border-rose-600 dark:text-rose-400"
                : ""
            }
          >
            {deletingAll
              ? "Clearing…"
              : confirmClearAll
                ? "Confirm clear all?"
                : "Clear all"}
          </Button>
        </div>
      }
      contentClassName="flex flex-col min-h-0 gap-4"
    >
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-1 shrink-0">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "rounded-md px-3 py-1 text-xs font-medium transition",
                tab === t.key
                  ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-surface-400"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
              ].join(" ")}
            >
              {t.label}
              {t.key === "unread" && unreadCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notifications…"
            className="w-full rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400 transition"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Clear"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-3">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 animate-pulse"
              />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState filtered={tab !== "all" || !!search} />
        ) : (
          <div className="space-y-2">
            {filtered.map((n) => (
              <NotifCard
                key={n.id}
                n={n}
                onOpen={handleOpen}
                onDelete={handleDelete}
              />
            ))}
            {hasMore && (
              <div className="pt-2 flex justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loadingMore}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {loadingMore ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </PageFrame>
  );
};

export default InboxPage;
