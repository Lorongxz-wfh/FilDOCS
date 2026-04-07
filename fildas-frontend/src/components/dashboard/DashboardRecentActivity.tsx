import React from "react";
import { useNavigate } from "react-router-dom";
import SkeletonList from "../ui/loader/SkeletonList";
import type { ActivityLogItem } from "../../services/documents";
import {
  Send,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
  Share2,
  BookMarked,
  Activity,
  History,
} from "lucide-react";
import { formatRelative } from "../../utils/formatters";

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
  hasData?: boolean;
};

type EventMeta = {
  icon: React.ReactNode;
  bg: string;
  text: string;
};

const getEventMeta = (event: string): EventMeta => {
  const e = event.toLowerCase();
  if (e.includes("approved") || e.includes("approval"))
    return {
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  if (e.includes("rejected") || e.includes("reject"))
    return {
      icon: <XCircle className="h-3.5 w-3.5" />,
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-600 dark:text-rose-400",
    };
  if (e.includes("returned") || e.includes("return"))
    return {
      icon: <CornerUpLeft className="h-3.5 w-3.5" />,
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-600 dark:text-amber-400",
    };
  if (e.includes("distributed") || e.includes("distribute"))
    return {
      icon: <Share2 className="h-3.5 w-3.5" />,
      bg: "bg-sky-50 dark:bg-sky-950/40",
      text: "text-sky-600 dark:text-sky-400",
    };
  if (e.includes("registered") || e.includes("register"))
    return {
      icon: <BookMarked className="h-3.5 w-3.5" />,
      bg: "bg-violet-50 dark:bg-violet-950/40",
      text: "text-violet-600 dark:text-violet-400",
    };
  if (e.includes("submitted") || e.includes("submit"))
    return {
      icon: <Send className="h-3.5 w-3.5" />,
      bg: "bg-brand-50 dark:bg-brand-950/30",
      text: "text-brand-600 dark:text-brand-400",
    };
  return {
    icon: <Activity className="h-3.5 w-3.5" />,
    bg: "bg-slate-100 dark:bg-surface-400",
    text: "text-slate-500 dark:text-slate-400",
  };
};

const DashboardRecentActivity: React.FC<Props> = ({ logs, loading, hasData }) => {
  const navigate = useNavigate();
  const [newLogIds, setNewLogIds] = React.useState<Set<number>>(new Set());

  // Track new arrivals for animation
  React.useEffect(() => {
    if (logs.length > 0) {
      const ids = logs.map(l => l.id);
      setNewLogIds(prev => {
        const next = new Set(prev);
        ids.forEach(id => {
          if (!prev.has(id)) next.add(id);
        });
        return next;
      });

      // Cleanup animation classes after 400ms
      const timer = setTimeout(() => {
        setNewLogIds(new Set(ids));
      }, 400); 
      return () => clearTimeout(timer);
    }
  }, [logs]);

  const isRecentlyAdded = (id: number) => !newLogIds.has(id);

  return (
    <div className="relative h-[240px] overflow-hidden">
      <div className={`divide-y divide-slate-100 dark:divide-surface-400 transition-opacity duration-200 ${loading && hasData ? "opacity-60" : "opacity-100"}`}>
        {loading && !hasData ? (
          <SkeletonList variant="activity" rows={4} className="divide-y divide-slate-100 dark:divide-surface-400" />
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-indigo-50 dark:bg-indigo-950/40">
              <Activity className="h-4.5 w-4.5 text-indigo-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No activity yet
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              Latest actions will appear here.
            </p>
          </div>
        ) : (
          logs.slice(0, 5).map((log) => {
            const meta = getEventMeta(log.event);
            return (
              <div 
                key={log.id} 
                className={`flex items-start gap-2.5 sm:gap-3 py-2.5 sm:py-2.5 px-0.5 sm:px-0 ${isRecentlyAdded(log.id) ? "animate-live-entry" : ""}`}
              >
                {/* Event icon */}
                <div
                  className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded ${meta.bg} ${meta.text} sm:scale-100 scale-90`}
                >
                  {meta.icon}
                </div>

                {/* Event text */}
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] sm:text-sm text-slate-800 dark:text-slate-200 leading-snug">
                    <span className="font-semibold">{log.event}</span>
                    {log.label && (
                      <span className="text-slate-500 dark:text-slate-400 line-clamp-1">
                        {" — "}{log.label}
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500">
                    {formatRelative(log.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Fading overlay + Minimal Button */}
      {!loading && (
        <div className={`inset-x-0 bottom-0 flex items-center justify-center ${logs.length > 0 ? "absolute h-24 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none" : "py-2"}`}>
          <div className={`${logs.length > 0 ? "pb-4 pointer-events-auto" : "mt-2"}`}>
            <button
              type="button"
              onClick={() => navigate("/activity-logs")}
              className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 rounded-sm text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] shadow-xs hover:bg-slate-50 dark:hover:bg-surface-300 transition-all active:scale-95"
            >
              <History className="h-2.5 w-2.5" />
              View all activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardRecentActivity;
