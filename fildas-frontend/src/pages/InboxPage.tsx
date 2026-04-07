import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import { Trash2, Search, X, Megaphone, Bell, CheckCircle } from "lucide-react";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import { motion, AnimatePresence } from "framer-motion";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  deleteAllNotifications,
  type NotificationItem,
} from "../services/documents";
import { inputCls } from "../utils/formStyles";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/loader/Skeleton";

// ─── Types ─────────────────────────────────────────────────────────────────
type FilterTab = "all" | "unread" | "read";

const TYPE_BAR: Record<string, string> = {
  info:    "bg-sky-400",
  warning: "bg-amber-400",
  urgent:  "bg-rose-500",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function timeFormat(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
}

function getMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function groupByMonth(
  items: NotificationItem[],
): { label: string; items: NotificationItem[] }[] {
  const map = new Map<string, NotificationItem[]>();
  for (const a of items) {
    const label = getMonthLabel(a.created_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(a);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

// ─── Month group divider ───────────────────────────────────────────────────
const MonthGroup: React.FC<{
  label: string;
  count: number;
  children: React.ReactNode;
}> = ({ label, count, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <p className="shrink-0 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="h-px flex-1 bg-slate-200 dark:bg-surface-400" />
      <p className="shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        {count} {count === 1 ? "item" : "items"}
      </p>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

// ─── Notification card (Standardized) ─────────────────────────────────────────
const NotifCard: React.FC<{
  n: NotificationItem;
  onOpen: (n: NotificationItem) => void;
  onDelete: (id: number) => void;
  onMarkRead: (id: number) => void;
}> = ({ n, onOpen, onDelete, onMarkRead }) => {
  const isUnread = !n.read_at;
  const isAnnouncement = n.title.toLowerCase().includes("announcement");
  const type = (n.meta?.type as string) || (isAnnouncement ? "info" : "");
  const statusDot = isUnread ? (
    <div className="h-1.5 w-1.5 rounded-full bg-brand-500" />
  ) : null;

  const barColor = TYPE_BAR[type] || (isUnread ? "bg-brand-500" : "bg-slate-300");

  return (
    <div
      className={`group relative flex items-stretch rounded-xl border bg-white dark:bg-surface-500 transition-all duration-250 ${isUnread ? "border-brand-100 dark:border-brand-900/30 shadow-sm" : "border-slate-200 dark:border-surface-400 shadow-sm opacity-80"}`}
    >
      <div className={`w-1 shrink-0 rounded-l-sm transition-colors ${barColor}`} />

      <div className="flex flex-1 items-start gap-4 px-4 py-4 min-w-0">
        <div className="mt-1 shrink-0 flex items-center justify-center w-5">
          {isAnnouncement ? (
            <Megaphone className={`h-4 w-4 ${type === "urgent" ? "text-rose-500" : type === "warning" ? "text-amber-500" : "text-brand-500"}`} strokeWidth={1.5} />
          ) : (
            <div className="h-4 w-4 flex items-center justify-center">
               {statusDot || <Bell className="h-3.5 w-3.5 text-slate-300 dark:text-slate-600" strokeWidth={1.5} />}
            </div>
          )}
        </div>

        <button
          type="button"
          className="flex-1 min-w-0 text-left cursor-pointer outline-none"
          onClick={() => onOpen(n)}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`text-sm font-semibold leading-tight transition-colors ${isUnread ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
              {n.title.replace(/^[🔵 announcement:\s]+/gi, "Announcement: ").trim()}
            </p>
            {isUnread && (
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider bg-brand-50 text-brand-600 dark:bg-brand-950/20 dark:text-brand-400">
                New
              </span>
            )}
          </div>
          
          {n.body && (
            <p
              className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: n.body }}
            />
          )}

          <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            <span className="text-slate-600 dark:text-slate-300 font-bold">
              {n.meta?.author_name || n.event?.replace(/_/g, ' ') || "System"}
            </span>
            <span className="opacity-30">·</span>
            <span>
              {new Date(n.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="opacity-30">·</span>
            <span>{timeFormat(n.created_at)}</span>
            <span className="opacity-30">·</span>
            <span>{timeAgo(n.created_at)}</span>
          </div>
        </button>

        <div className="flex items-center gap-1 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {isUnread && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMarkRead(n.id);
              }}
              title="Mark read"
              className="rounded-md p-1.5 text-slate-300 hover:text-brand-500 hover:bg-brand-50 dark:text-slate-600 dark:hover:text-brand-400 transition-all active:scale-90"
            >
              <CheckCircle className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(n.id);
            }}
            title="Delete notification"
            className="rounded-md p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:text-slate-600 dark:hover:text-rose-400 transition-all active:scale-90"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────
const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [reloadTick, setReloadTick] = React.useState(0);
  const [markingAll, setMarkingAll] = React.useState(false);
  const [confirmClearAll, setConfirmClearAll] = React.useState(false);

  const [tab, setTab] = React.useState<FilterTab>("all");
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    let alive = true;
    async function load(silent = false) {
      try {
        if (page === 1 && !silent) setLoading(true);
        else if (page > 1) setLoadingMore(true);
        if (silent) setIsRefreshing(true);
        setError(null);
        const res = await listNotifications({ page, perPage: 50 });
        if (!alive) return;
        setItems((prev) => page === 1 ? res.data : [...prev, ...res.data]);
        setHasMore(Boolean(res.links?.next));
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load feed.");
      } finally {
        if (alive) { 
          setLoading(false); 
          setLoadingMore(false); 
          setIsRefreshing(false);
        }
      }
    }
    load();
    return () => { alive = false; };
  }, [page, reloadTick]);

  const filtered = React.useMemo(() => {
    let list = items;
    if (tab === "all") {
      list = list.filter((n) => {
        const isAnnouncement = n.title.toLowerCase().includes("announcement");
        if (isAnnouncement) return true;
        return !n.read_at;
      });
    } else if (tab === "unread") {
      list = list.filter((n) => !n.read_at);
    } else if (tab === "read") {
      list = list.filter((n) => !!n.read_at);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (n) => n.title?.toLowerCase().includes(q) || n.body?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, tab, search]);

  const groups = React.useMemo(() => groupByMonth(filtered), [filtered]);

  const unreadCount = React.useMemo(
    () => items.filter((n) => !n.read_at).length,
    [items]
  );

  const handleOpen = async (n: NotificationItem) => {
    try {
      if (!n.read_at) {
        await markNotificationRead(n.id);
        setItems((prev) =>
          prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)
        );
      }
      if (n.document_id) navigate(`/documents/${n.document_id}`);
    } catch { /* ignore */ }
  };

  const handleMarkRead = async (id: number) => {
    try {
      await markNotificationRead(id);
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteNotification(id);
      setItems((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
  };

  const handleMarkAllRead = async () => {
    try {
      setMarkingAll(true);
      await markAllNotificationsRead();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
    } finally { setMarkingAll(false); }
  };

  const handleClearAll = async () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 3000);
      return;
    }
    try {
      await deleteAllNotifications();
      setItems([]);
      setConfirmClearAll(false);
    } catch { /* ignore */ }
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Active Feed" },
    { key: "unread", label: "Unread" },
    { key: "read", label: "History" },
  ];

  const handleBack = () => {
    // If we have history, go back; otherwise default to dashboard
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <PageFrame
      title="Inbox"
      onBack={handleBack}
      subtitle={
        unreadCount > 0 ? (
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {unreadCount} PENDING ACTION{unreadCount !== 1 ? "S" : ""}
          </span>
        ) : undefined
      }
      right={
        <PageActions>
          <RefreshAction 
            onRefresh={async () => { 
                setPage(1); 
                setReloadTick((t) => t + 1);
                // Return promise for button feedback
                return new Promise<void>((resolve) => {
                    const check = setInterval(() => {
                        if (!loading && !isRefreshing) {
                            clearInterval(check);
                            resolve();
                        }
                    }, 100);
                });
            }} 
            loading={isRefreshing || loading} 
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/announcements")}
            className="text-[11px] font-bold uppercase tracking-widest"
          >
            <Megaphone className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Announcement</span>
          </Button>
          <Button variant="outline" size="sm" disabled={markingAll || loading || unreadCount === 0} onClick={handleMarkAllRead} className="text-[11px] font-bold uppercase tracking-widest">
            {markingAll ? "Marking…" : "Mark all read"}
          </Button>
          <Button variant="outline" size="sm" disabled={loading || items.length === 0} onClick={handleClearAll} className={`text-[11px] font-bold uppercase tracking-widest ${confirmClearAll ? "text-rose-600 border-rose-200" : ""}`}>
             {confirmClearAll ? "Confirm?" : "Clear all"}
          </Button>
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 bg-slate-50 dark:bg-surface-600"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-6 space-y-6">
          <div className="flex flex-col gap-1.5 shrink-0">
             <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-brand-500 fill-brand-500/10" strokeWidth={1.5} />
                <h2 className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Inbox
                </h2>
             </div>
             {!loading && (
               <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {unreadCount} unread · {filtered.length} visible items
               </p>
             )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-surface-300 dark:bg-surface-600">
              {TABS.map((t) => (
                <button key={t.key} type="button" onClick={() => setTab(t.key)} className={`relative flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? "bg-brand-500 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:text-slate-400"}`}>
                  {t.label}
                  {t.key === "unread" && unreadCount > 0 && <span className="flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-white/20 text-[10px] font-bold">{unreadCount}</span>}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className={`${inputCls} !py-1.5 !pl-9 shadow-sm !text-xs !px-8`} />
              {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={tab + search} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="space-y-10">
              {loading ? (
                 <div className="space-y-4">
                   {Array.from({ length: 4 }).map((_, i) => (
                     <div key={i} className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 p-4 space-y-3 shadow-sm">
                       <Skeleton className="h-4 w-1/3" />
                       <Skeleton className="h-3 w-full" />
                       <Skeleton className="h-2 w-1/2" />
                     </div>
                   ))}
                 </div>
              ) : error ? (
                <div className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
              ) : filtered.length === 0 ? (
                <EmptyState isSearch={!!search} label={search ? "No matches" : "All caught up"} description="Your active feed is currently empty." />
              ) : (
                <div className="space-y-10">
                  {groups.map((g) => (
                    <MonthGroup key={g.label} label={g.label} count={g.items.length}>
                       {g.items.map((n) => <NotifCard key={n.id} n={n} onOpen={handleOpen} onDelete={handleDelete} onMarkRead={handleMarkRead} />)}
                    </MonthGroup>
                  ))}
                  {hasMore && (
                    <div className="flex justify-center pt-4">
                       <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load Older"}</Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageFrame>
  );
};

export default InboxPage;
