import React from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Megaphone } from "lucide-react";
import InlineSpinner from "../ui/loader/InlineSpinner";
import SkeletonList from "../ui/loader/SkeletonList";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
  listActiveAnnouncements,
  type Announcement,
} from "../../services/documents";
import { playNotificationChime } from "../../utils/notificationSound";
import { useRealtimeUpdates } from "../../hooks/useRealtimeUpdates";

const SEEN_AT_KEY = "notif_seen_at";

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = React.useState(false);
  const [unseenCount, setUnseenCount] = React.useState<number>(0);
  const [notifItems, setNotifItems] = React.useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [annLoading, setAnnLoading] = React.useState(false);

  // seenAt: timestamp (ms) of last time dropdown was opened
  const [seenAt, setSeenAt] = React.useState<number>(() =>
    parseInt(localStorage.getItem(SEEN_AT_KEY) ?? "0", 10)
  );

  const prevUnreadRef = React.useRef<number>(0);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  // Recompute unseen count from loaded items
  const computeUnseen = React.useCallback(
    (items: NotificationItem[], seen: number) =>
      items.filter((n) => !n.read_at && new Date(n.created_at).getTime() > seen).length,
    []
  );

  async function refreshNotifBadge(currentSeenAt: number) {
    const n = await getUnreadNotificationCount();
    if (n > prevUnreadRef.current) {
      playNotificationChime();
      window.dispatchEvent(new Event("page:remote-refresh"));
    }
    prevUnreadRef.current = n;
    // Only use API count for badge when we have no items loaded yet
    setUnseenCount((prev) =>
      notifItems.length === 0 ? n : computeUnseen(notifItems, currentSeenAt) > 0 ? computeUnseen(notifItems, currentSeenAt) : prev
    );
  }

  async function loadDropdown(currentSeenAt: number) {
    setNotifLoading(notifItems.length === 0);
    setAnnLoading(announcements.length === 0);
    setNotifError(null);
    try {
      const [{ data }, ann] = await Promise.all([
        listNotifications({ page: 1, perPage: 5 }),
        listActiveAnnouncements(),
      ]);
      setNotifItems(data);
      setAnnouncements(ann);
      setUnseenCount(computeUnseen(data, currentSeenAt));
      await getUnreadNotificationCount().then((n) => {
        prevUnreadRef.current = n;
      });
    } catch (e: any) {
      setNotifError(e?.message ?? "Failed to load notifications.");
    } finally {
      setNotifLoading(false);
      setAnnLoading(false);
    }
  }

  const notifPollRef = React.useRef<number | null>(null);
  const notifBurstTimeoutRef = React.useRef<number | null>(null);
  const seenAtRef = React.useRef<number>(seenAt);
  seenAtRef.current = seenAt;
  const isOpenRef = React.useRef<boolean>(false);
  isOpenRef.current = isOpen;

  function stopPolling() {
    if (notifPollRef.current) window.clearInterval(notifPollRef.current);
    notifPollRef.current = null;
    if (notifBurstTimeoutRef.current) window.clearTimeout(notifBurstTimeoutRef.current);
    notifBurstTimeoutRef.current = null;
  }

  function startPolling(mode: "idle" | "open" | "burst") {
    stopPolling();
    const ms = mode === "open" ? 8000 : mode === "burst" ? 5000 : 10000;
    notifPollRef.current = window.setInterval(async () => {
      if (isOpenRef.current) {
        await loadDropdown(seenAtRef.current).catch(() => {});
      } else {
        await refreshNotifBadge(seenAtRef.current).catch(() => {});
      }
    }, ms);
    if (mode === "burst") {
      notifBurstTimeoutRef.current = window.setTimeout(() => {
        startPolling(isOpenRef.current ? "open" : "idle");
      }, 8000);
    }
  }

  React.useEffect(() => {
    refreshNotifBadge(seenAt).catch(() => {});
    startPolling("idle");
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Realtime: instant notification updates via Pusher ──────────────────
  useRealtimeUpdates({
    onNotification: React.useCallback((newNotif: any) => {
      playNotificationChime();
      setUnseenCount((prev) => prev + 1);
      setNotifItems((prev) => {
        // Prepend if dropdown is open and item not already there
        if (prev.find((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev].slice(0, 5);
      });
    }, []),
    onAnnouncement: React.useCallback((ann: Announcement) => {
      setAnnouncements((prev) => {
        if (prev.find((a) => a.id === ann.id)) return prev;
        // Pinned go to top
        const next = ann.is_pinned ? [ann, ...prev] : [...prev, ann];
        return next;
      });
    }, []),
  });

  // Click-outside to close
  React.useEffect(() => {
    if (!isOpen) return;
    function handleMouseDown(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        startPolling("idle");
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  React.useEffect(() => {
    const onRefresh = () => {
      if (isOpenRef.current) {
        loadDropdown(seenAtRef.current).catch(() => {});
      } else {
        refreshNotifBadge(seenAtRef.current).catch(() => {});
      }
      startPolling("burst");
    };
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openDropdown() {
    const now = Date.now();
    setSeenAt(now);
    seenAtRef.current = now;
    localStorage.setItem(SEEN_AT_KEY, String(now));
    setUnseenCount(0);
    setIsOpen(true);
    loadDropdown(now);
    startPolling("open");
  }

  function closeDropdown() {
    setIsOpen(false);
    startPolling("idle");
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => (isOpen ? closeDropdown() : openDropdown())}
        className="relative rounded-md p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <BellRing className="h-4 w-4" />
        {unseenCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {unseenCount > 99 ? "99+" : unseenCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-4 top-14 w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-surface-400 dark:bg-surface-500 animate-pop-in-top"
        >
          {/* ── Announcements section — always rendered, hides content when empty ── */}
          <div className="border-b border-slate-200 dark:border-surface-400">
            <div className="flex items-center justify-between px-3 py-2">
              <div className="flex items-center gap-1.5">
                <Megaphone className="h-3 w-3 text-slate-400 dark:text-slate-500" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Announcements
                </span>
              </div>
              <div className="flex items-center gap-2">
                {annLoading && <InlineSpinner className="h-3 w-3 border-2" />}
                <button
                  type="button"
                  className="text-[11px] font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors"
                  onClick={() => {
                    closeDropdown();
                    navigate("/announcements");
                  }}
                >
                  View all →
                </button>
              </div>
            </div>

            <div className="px-3 pb-2.5">
              {annLoading ? (
                <SkeletonList rows={1} rowClassName="h-12 rounded-md" />
              ) : announcements.length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 py-1">
                  No active announcements.
                </p>
              ) : (
                <>
                  {(() => {
                    const pinned = announcements.filter((a) => a.is_pinned);
                    const latest =
                      pinned.length > 0 ? pinned[0] : announcements[0];
                    if (!latest) return null;
                    const typeCls =
                      latest.type === "urgent"
                        ? "bg-rose-500"
                        : latest.type === "warning"
                          ? "bg-amber-400"
                          : "bg-sky-500";
                    return (
                      <div className="flex items-stretch rounded-md border border-slate-200 bg-slate-50 dark:border-surface-300 dark:bg-surface-600">
                        <div
                          className={`w-1 shrink-0 rounded-l-sm ${typeCls}`}
                        />
                        <div className="flex-1 min-w-0 px-2.5 py-2">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {latest.title}
                          </p>
                          <p 
                            className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: latest.body }}
                          />
                        </div>
                      </div>
                    );
                  })()}
                  {announcements.length > 1 && (
                    <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      +{announcements.length - 1} more announcement
                      {announcements.length - 1 > 1 ? "s" : ""}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Notifications section ── */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-t border-slate-200 dark:border-surface-400">
            <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Inbox
            </div>
            {notifLoading && <InlineSpinner className="h-3 w-3 border-2" />}
          </div>

          <div className="max-h-56 overflow-auto px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
            {notifItems.length === 0 && notifLoading ? (
              <div className="py-2">
                <SkeletonList rows={3} rowClassName="h-10 rounded-md" />
              </div>
            ) : notifError ? (
              <div className="py-4 text-slate-500 dark:text-slate-400">
                {notifError}
              </div>
            ) : notifItems.length === 0 ? (
              <div className="py-4 text-slate-500 dark:text-slate-400">
                Inbox is empty.
              </div>
            ) : (
              <div className="space-y-2">
                {notifItems.map((n) => {
                  const createdMs = new Date(n.created_at).getTime();
                  const isUnseen = !n.read_at && createdMs > seenAt;
                  const isSeenNotRead = !n.read_at && !isUnseen;

                  return (
                    <button
                      key={n.id}
                      type="button"
                      className={[
                        "w-full rounded-md border px-3 py-2 text-left transition",
                        isUnseen
                          ? "border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:hover:bg-sky-950/60"
                          : isSeenNotRead
                            ? "border-slate-200 bg-slate-50 hover:bg-slate-100 dark:border-surface-300 dark:bg-surface-400/50 dark:hover:bg-surface-400"
                            : "border-slate-100 bg-white hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-600 dark:hover:bg-surface-400",
                      ].join(" ")}
                      onClick={async () => {
                        try {
                          if (!n.read_at) {
                            await markNotificationRead(n.id);
                            setNotifItems((prev) =>
                              prev.map((item) =>
                                item.id === n.id
                                  ? {
                                      ...item,
                                      read_at: new Date().toISOString(),
                                    }
                                  : item,
                              ),
                            );
                            setUnseenCount((prev) =>
                              Math.max(0, prev - (isUnseen ? 1 : 0)),
                            );
                          }
                          closeDropdown();
                          startPolling("burst");
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
                          } else {
                            const reqId = (n as any)?.meta?.document_request_id;
                            navigate(
                              reqId ? `/document-requests/${reqId}` : "/inbox",
                            );
                          }
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
                              isUnseen || isSeenNotRead
                                ? "text-slate-900 dark:text-slate-100"
                                : "text-slate-600 dark:text-slate-300",
                            ].join(" ")}
                          >
                            {n.title}
                          </div>
                          {n.body && (
                            <div 
                              className="mt-0.5 line-clamp-2 text-[11px] text-slate-500 dark:text-slate-400"
                              dangerouslySetInnerHTML={{ __html: n.body }}
                            />
                          )}
                        </div>
                        {(() => {
                          if (n.title.toLowerCase().includes("announcement")) {
                            // Extract color indicator for announcements based on content/meta if available
                            // fallback to title keyword checks for generic announcement styles
                            const isUrgent = n.title.toLowerCase().includes("urgent") || n.body?.toLowerCase().includes("urgent");
                            const isWarning = n.title.toLowerCase().includes("warning") || n.body?.toLowerCase().includes("warning");
                            
                            const colorCls = isUrgent 
                              ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]" 
                              : isWarning 
                                ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" 
                                : "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.4)]";
                                
                            return <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${colorCls} ring-2 ring-white dark:ring-surface-600`} />;
                          }

                          if (isUnseen) {
                            return <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />;
                          }
                          if (isSeenNotRead) {
                            return <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full border-2 border-slate-400 dark:border-slate-500" />;
                          }
                          return null;
                        })()}
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
                  await loadDropdown(seenAt);
                  startPolling("burst");
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
                closeDropdown();
                navigate("/inbox");
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
