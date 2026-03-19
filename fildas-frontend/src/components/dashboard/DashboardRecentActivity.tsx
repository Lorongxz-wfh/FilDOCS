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
    <div className="min-h-52.5 divide-y divide-slate-200 dark:divide-surface-400">
      {loading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 py-3">
            <Skeleton className="mt-0.5 h-2 w-2 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-2/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </div>
        ))
      ) : logs.length === 0 ? (
        <div className="py-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No activity yet.
        </div>
      ) : (
        logs.slice(0, 5).map((log) => {
          const meta = getEventMeta(log.event);
          return (
            <div key={log.id} className="flex items-start gap-3 py-3">
              <div
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${meta.bg} ${meta.text}`}
              >
                {meta.icon}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-200">
                  <span className="font-medium">{log.event}</span>
                  {log.label ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      {" "}
                      — {log.label}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
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
