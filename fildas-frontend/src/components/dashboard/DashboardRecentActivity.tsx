import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { ActivityLogItem } from "../../services/documents";

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
};

const eventColor: Record<string, string> = {
  submitted: "bg-brand-500",
  approved: "bg-emerald-500",
  rejected: "bg-rose-500",
  returned: "bg-amber-500",
  distributed: "bg-sky-500",
  registered: "bg-violet-500",
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const DashboardRecentActivity: React.FC<Props> = ({ logs, loading }) => {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      <div className="border-b border-slate-100 dark:border-surface-400 px-5 py-4">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Recent activity
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Latest workflow events.
        </p>
      </div>

      <div className="divide-y divide-slate-50 dark:divide-surface-400">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-5 py-3">
              <Skeleton className="mt-0.5 h-2 w-2 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))
        ) : logs.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-400 dark:text-slate-500">
            No activity yet.
          </div>
        ) : (
          logs.map((log) => {
            const eventKey = Object.keys(eventColor).find((k) =>
              log.event.toLowerCase().includes(k),
            );
            const dotColor = eventKey ? eventColor[eventKey] : "bg-slate-400";

            return (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`}
                />
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
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {formatRelative(log.created_at)}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DashboardRecentActivity;
