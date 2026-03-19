import React from "react";
import { useNavigate } from "react-router-dom";
import { BellRing } from "lucide-react";
import InlineSpinner from "../ui/loader/InlineSpinner";
import SkeletonList from "../ui/loader/SkeletonList";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../../services/documents";
import { playNotificationChime } from "../../utils/notificationSound";

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();

  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [notifUnread, setNotifUnread] = React.useState<number>(0);
  const [notifItems, setNotifItems] = React.useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);

  const prevUnreadRef = React.useRef<number>(0);

  async function refreshNotifBadge() {
    const n = await getUnreadNotificationCount();
    if (n > prevUnreadRef.current) {
      playNotificationChime();
    }
    prevUnreadRef.current = n;
    setNotifUnread(n);
  }

  async function loadNotifDropdown() {
    setNotifLoading(notifItems.length === 0);
    setNotifError(null);
    try {
      const { data } = await listNotifications({ page: 1, perPage: 5 });
      setNotifItems(data);
      await refreshNotifBadge();
    } catch (e: any) {
      setNotifError(e?.message ?? "Failed to load notifications.");
    } finally {
      setNotifLoading(false);
    }
  }

  const notifPollRef = React.useRef<number | null>(null);
  const notifBurstTimeoutRef = React.useRef<number | null>(null);

  async function refreshNotifications(opts?: { includeList?: boolean }) {
    await refreshNotifBadge();
    if (opts?.includeList) {
      try {
        const { data } = await listNotifications({ page: 1, perPage: 5 });
        setNotifItems(data);
      } catch {
        /* ignore */
      }
    }
  }

  function stopNotifPolling() {
    if (notifPollRef.current) window.clearInterval(notifPollRef.current);
    notifPollRef.current = null;
    if (notifBurstTimeoutRef.current) window.clearTimeout(notifBurstTimeoutRef.current);
    notifBurstTimeoutRef.current = null;
  }

  function startNotifPolling(mode: "idle" | "open" | "burst") {
    stopNotifPolling();
    const ms = mode === "open" ? 8000 : mode === "burst" ? 5000 : 10000;
    notifPollRef.current = window.setInterval(() => {
      refreshNotifications({ includeList: isNotifOpen }).catch(() => {});
    }, ms);
    if (mode === "burst") {
      notifBurstTimeoutRef.current = window.setTimeout(() => {
        startNotifPolling(isNotifOpen ? "open" : "idle");
      }, 8000);
    }
  }

  React.useEffect(() => {
    refreshNotifications({ includeList: false }).catch(() => {});
    startNotifPolling("idle");
    return () => stopNotifPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const onRefresh = () => {
      refreshNotifications({ includeList: isNotifOpen }).catch(() => {});
      startNotifPolling("burst");
    };
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNotifOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setIsNotifOpen((v) => {
            const next = !v;
            if (next) {
              loadNotifDropdown();
              startNotifPolling("open");
            } else startNotifPolling("idle");
            return next;
          });
        }}
        className="relative rounded-md p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
        aria-haspopup="menu"
        aria-expanded={isNotifOpen}
      >
        <BellRing className="h-4 w-4" />
        {notifUnread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {notifUnread > 99 ? "99+" : notifUnread}
          </span>
        )}
      </button>

      {isNotifOpen && (
        <div className="absolute right-4 top-14 w-72 rounded-md border border-slate-200 bg-white shadow-md dark:border-surface-400 dark:bg-surface-500">
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-surface-400">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Inbox
            </div>
            {notifLoading && <InlineSpinner className="h-3 w-3 border-2" />}
          </div>
          <div className="max-h-56 overflow-auto px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
            {notifError ? (
              <div className="py-4 text-rose-700 dark:text-rose-400">
                {notifError}
              </div>
            ) : notifItems.length === 0 && notifLoading ? (
              <div className="py-2">
                <SkeletonList rows={4} rowClassName="h-10 rounded-md" />
              </div>
            ) : notifItems.length === 0 ? (
              <div className="py-4 text-slate-500 dark:text-slate-400">
                Inbox is empty.
              </div>
            ) : (
              <div className="space-y-2">
                {notifItems.map((n) => {
                  const isUnread = !n.read_at;
                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={[
                        "w-full rounded-md border px-3 py-2 text-left transition",
                        isUnread
                          ? "border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:hover:bg-sky-950/60"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-600 dark:hover:bg-surface-400",
                      ].join(" ")}
                      onClick={async () => {
                        try {
                          if (!n.read_at) await markNotificationRead(n.id);
                          await refreshNotifBadge();
                          setIsNotifOpen(false);
                          startNotifPolling("burst");
                          const noLink = Boolean((n as any)?.meta?.no_link);
                          if (noLink) return;
                          if (n.document_id) {
                            const toView =
                              (n as any)?.meta?.status === "Distributed";
                            navigate(
                              toView
                                ? `/documents/${n.document_id}/view`
                                : `/documents/${n.document_id}`,
                              toView
                                ? undefined
                                : { state: { from: "/work-queue" } },
                            );
                          } else navigate("/inbox");
                        } catch {
                          /* ignore */
                        }
                      }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div
                            className={[
                              "truncate text-xs font-semibold",
                              isUnread
                                ? "text-slate-900 dark:text-slate-100"
                                : "text-slate-700 dark:text-slate-300",
                            ].join(" ")}
                          >
                            {n.title}
                          </div>
                          {n.body && (
                            <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">
                              {n.body}
                            </div>
                          )}
                        </div>
                        {isUnread && (
                          <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-surface-400">
            <button
              type="button"
              className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
              onClick={async () => {
                try {
                  await markAllNotificationsRead();
                  await loadNotifDropdown();
                  startNotifPolling("burst");
                } catch {
                  /* ignore */
                }
              }}
            >
              Mark all as read
            </button>
            <button
              type="button"
              className="text-xs font-medium text-sky-700 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
              onClick={() => {
                setIsNotifOpen(false);
                navigate("/inbox");
              }}
            >
              View all
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
