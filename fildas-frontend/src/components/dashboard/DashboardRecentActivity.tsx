import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { ActivityLogItem } from "../../services/documents";
import {
  Send,
  CheckCircle2,
  XCircle,
  CornerUpLeft,
  Share2,
  BookMarked,
  Activity,
} from "lucide-react";
import { formatRelative } from "../../utils/formatters";

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
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

const DashboardRecentActivity: React.FC<Props> = ({ logs, loading }) => {
  return (
    <div className="min-h-[210px] divide-y divide-slate-100 dark:divide-surface-400">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-2.5 sm:gap-3 py-3 px-1 sm:px-0">
            <Skeleton className="mt-0.5 h-6 w-6 rounded shrink-0" />
            <div className="flex-1 space-y-1.5 min-w-0">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-2.5 w-1/4" />
            </div>
          </div>
        ))
      ) : logs.length === 0 ? (
        <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
          No activity yet.
        </div>
      ) : (
        logs.slice(0, 5).map((log) => {
          const meta = getEventMeta(log.event);
          return (
            <div key={log.id} className="flex items-start gap-2.5 sm:gap-3 py-2.5 sm:py-2.5 px-0.5 sm:px-0">
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
                      {" "}
                      — {log.label}
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
  );
};

export default DashboardRecentActivity;
