import React from "react";
import { useNavigate } from "react-router-dom";
import { BellRing, Megaphone, Bell, CheckCircle, ArrowRight, ShieldAlert } from "lucide-react";
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
import { formatRelative } from "../../utils/formatters";

const SEEN_AT_KEY = "notif_seen_at";

const NotificationBell: React.FC = () => {
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = React.useState(false);
  const [hasUnseen, setHasUnseen] = React.useState<boolean>(false);
  const [notifItems, setNotifItems] = React.useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [announcements, setAnnouncements] = React.useState<Announcement[]>([]);
  const [isAnnLoading, setAnnLoading] = React.useState(false);
  const [isMarkingRead, setIsMarkingRead] = React.useState(false);

  const [seenAt, setSeenAt] = React.useState<number>(() =>
    parseInt(localStorage.getItem(SEEN_AT_KEY) ?? "0", 10)
  );

  const prevUnreadRef = React.useRef<number>(0);
  const dropdownRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);


  async function loadDropdown() {
    setNotifLoading(true);
    setAnnLoading(true);
    try {
      const [{ data }, ann, count] = await Promise.all([
        listNotifications({ page: 1, perPage: 15 }),
        listActiveAnnouncements(),
        getUnreadNotificationCount(),
      ]);
      setNotifItems(data);
      setAnnouncements(ann);
      prevUnreadRef.current = count;
      
      // When dropdown is loaded (meaning it's open), we clear the unseen dot
      setHasUnseen(false);
    } catch { 
      /* silent fail */
    } finally {
      setNotifLoading(false);
      setAnnLoading(false);
    }
  }

  // Polling logic
  const notifPollRef = React.useRef<number | null>(null);
  const seenAtRef = React.useRef<number>(seenAt);
  seenAtRef.current = seenAt;
  const isOpenRef = React.useRef<boolean>(false);
  isOpenRef.current = isOpen;

  function stopPolling() {
    if (notifPollRef.current) window.clearInterval(notifPollRef.current);
    notifPollRef.current = null;
  }

  function startPolling() {
    stopPolling();
    // Aggressive polling deprecated. WebSockets (useRealtimeUpdates) now handle updates.
  }

  React.useEffect(() => {
    // Initial fetch to determine if we show the red dot
    const init = async () => {
      try {
        const [count, { data }] = await Promise.all([
          getUnreadNotificationCount(),
          listNotifications({ page: 1, perPage: 1 })
        ]);
        
        
        // Phase 1: Seen vs Viewed
        // If there are unread items, check if the latest one is newer than our last 'seenAt'
        if (count > 0 && data.length > 0) {
          const latestTime = new Date(data[0].created_at).getTime();
          if (latestTime > seenAtRef.current) {
            setHasUnseen(true);
          }
        }
      } catch { /* silent fail */ }
    };
    
    init();
    startPolling();
    return () => stopPolling();
  }, []);

  useRealtimeUpdates({
    onNotification: React.useCallback((newNotif: any) => {
      playNotificationChime();
      setHasUnseen(true); // New arrival = unseen
      setNotifItems((prev) => [newNotif, ...prev].slice(0, 15));
    }, []),
    onAnnouncement: React.useCallback((ann: Announcement) => {
      setAnnouncements((prev) => ann.is_pinned ? [ann, ...prev] : [...prev, ann]);
    }, []),
  });

  // Updated filter: Only show UNREAD notifications in 'Recent Activity' / 'Inbox Area'
  // including announcement notifications. This satisfies the request to 'clear' the area once markings are read.
  const visibleItems = React.useMemo(() => {
    return notifItems.filter((n) => !n.read_at).slice(0, 5);
  }, [notifItems]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
          } else {
            const now = Date.now();
            setSeenAt(now);
            seenAtRef.current = now;
            localStorage.setItem(SEEN_AT_KEY, String(now));
            setHasUnseen(false); // Clear dot immediately on click
            setIsOpen(true);
            loadDropdown();
          }
        }}
        className={`relative rounded-md p-1.5 transition ${isOpen ? "bg-slate-100 text-brand-600 dark:bg-surface-400 dark:text-brand-400" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200"}`}
      >
        <BellRing className={`h-4 w-4 ${isOpen ? "scale-110" : ""}`} />
        {hasUnseen && (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-2 w-2 items-center justify-center rounded-full bg-rose-600 ring-2 ring-white dark:ring-surface-500" />
        )}
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute right-4 left-4 sm:left-auto sm:right-4 top-14 sm:w-80 rounded-xl border border-slate-200 bg-white shadow-xl dark:border-surface-400 dark:bg-surface-500 animate-pop-in-top overflow-hidden z-50 text-slate-900 dark:text-slate-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-3 border-b border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/20">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-brand-500 fill-brand-500/10" strokeWidth={1.5} />
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">Announcement</h3>
            </div>
            <button onClick={() => { setIsOpen(false); navigate("/announcements"); }} className="text-[10px] font-semibold text-brand-600 hover:text-brand-500 uppercase tracking-tight">View All</button>
          </div>

          <div className="px-3.5 py-4 space-y-4">
             {/* Announcement Area on top - Preserved regardless of mark-all-read */}
             {(announcements.length > 0 || isAnnLoading) && (
               <button
                 onClick={() => { setIsOpen(false); navigate("/announcements"); }}
                 className="w-full text-left group flex items-stretch rounded-lg border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 overflow-hidden hover:border-brand-500 dark:hover:border-brand-400 transition-all "
               >
                 <div className="w-1 bg-brand-500" />
                 <div className="flex-1 px-3 py-2.5 min-w-0">
                    {announcements.length > 0 ? (
                      <>
                        <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{announcements[0].title}</p>
                        <p className="mt-1 line-clamp-1 text-[11px] text-slate-500 dark:text-slate-400 leading-tight" dangerouslySetInnerHTML={{ __html: announcements[0].body }} />
                      </>
                    ) : (
                      <div className="space-y-2 py-1">
                        <div className="h-2 w-2/3 bg-slate-100 dark:bg-surface-400 rounded animate-pulse" />
                        <div className="h-1.5 w-full bg-slate-50 dark:bg-surface-400/50 rounded animate-pulse" />
                      </div>
                    )}
                 </div>
               </button>
             )}

             <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <h4 className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Recent Activity</h4>
                 <button onClick={() => { setIsOpen(false); navigate("/inbox"); }} className="group flex items-center gap-1 text-[9px] font-semibold text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 uppercase transition-colors">
                    Inbox <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
                 </button>
               </div>

               {notifItems.length === 0 && notifLoading ? (
                 <SkeletonList rows={2} rowClassName="h-10 rounded-md" />
               ) : visibleItems.length === 0 ? (
                 <p className="py-4 text-center text-xs text-slate-400">Inbox is empty.</p>
               ) : (
                 <div className="space-y-2">
                   {visibleItems.map((n) => {
                     const isUnseen = !n.read_at && new Date(n.created_at).getTime() > seenAt;
                     const isSecurity = (n.event?.startsWith("auth.") || n.title.toLowerCase().includes("factor") || n.event === 'admin.2fa_reset') === true;
                     const isAnnouncement = (n.event?.startsWith("announcement.") || n.title.toLowerCase().includes("announcement")) === true;
                     const cleanTitle = n.title.replace(/^[🔵\s]+/g, "").trim();

                     return (
                       <button
                         key={n.id}
                         onClick={async () => {
                           if (!n.read_at) {
                             await markNotificationRead(n.id);
                             setNotifItems((prev) => prev.map((x) => x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x));
                           }
                           setIsOpen(false);
                           if (n.document_id) navigate(`/documents/${n.document_id}`);
                           else navigate("/inbox");
                         }}
                         className={`w-full group relative flex items-start gap-3 rounded-lg border px-3 py-2.5 transition-all text-left ${isUnseen ? "bg-brand-50/10 border-brand-100 dark:border-brand-900/30" : "bg-white border-slate-100 hover:bg-slate-50 dark:bg-surface-600 dark:border-surface-400 dark:hover:bg-surface-400"}`}
                       >
                         <div className="mt-1 shrink-0">
                           {isSecurity ? (
                             <ShieldAlert className="h-3.5 w-3.5 text-rose-500" strokeWidth={1.5} />
                           ) : isAnnouncement ? (
                             <Megaphone className="h-3.5 w-3.5 text-brand-500" strokeWidth={1.5} />
                           ) : (
                             <Bell className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.5} />
                           )}
                         </div>
                         <div className="min-w-0 flex-1">
                           <div className={`text-xs leading-tight font-semibold ${isUnseen ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"}`}>
                             {isSecurity && <span className="text-rose-600 dark:text-rose-400 font-semibold mr-1">Security:</span>}
                             {isAnnouncement && !cleanTitle.toLowerCase().startsWith("announcement") && <span className="text-brand-600 dark:text-brand-400 font-semibold mr-1">Announcement:</span>}
                             {cleanTitle}
                           </div>
                           <p className="mt-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{formatRelative(n.created_at)}</p>
                         </div>
                         {isUnseen && <div className="mt-1 h-1.5 w-1.5 rounded-full bg-brand-500" />}
                       </button>
                     );
                   })}
                 </div>
               )}
             </div>
          </div>

          <div className="border-t border-slate-100 dark:border-surface-400 px-3.5 py-3">
              <button
                disabled={isMarkingRead || visibleItems.length === 0}
                onClick={async () => {
                  try {
                    setIsMarkingRead(true);
                    await markAllNotificationsRead();
                    await loadDropdown();
                  } finally {
                    setIsMarkingRead(false);
                  }
                }}
                className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-[10px] font-semibold uppercase tracking-widest transition-all ${isMarkingRead || visibleItems.length === 0 ? "bg-slate-100 text-slate-400 cursor-not-allowed dark:bg-surface-600 dark:text-slate-600" : "bg-brand-600 text-white hover:bg-brand-700  shadow-brand-500/20 active:scale-[0.98]"}`}
              >
                {isMarkingRead ? <InlineSpinner className="h-3 w-3 border-2 border-white/30 border-t-white" /> : <CheckCircle className="h-3 w-3" />}
                Mark all as read
              </button>
          </div>
        </div>
      )}
    </>
  );
};

export default NotificationBell;
