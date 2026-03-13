import React from "react";
import Skeleton from "../../ui/loader/Skeleton";
import type { ActivityLogItem } from "../../../services/documents";

type Props = {
  isLoading: boolean;
  logs: ActivityLogItem[];
  formatWhen: (iso: string) => string;
  panelHeight?: number;
};

const DocumentActivityPanel: React.FC<Props> = ({
  isLoading,
  logs,
  formatWhen,
}) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600/60">
      {isLoading ? (
        <div className="space-y-2 p-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex h-full items-center justify-center">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            No activity yet.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-surface-400">
          {logs.map((l) => (
            <div
              key={l.id}
              className="flex items-start gap-3 px-3 py-2.5 hover:bg-white/60 dark:hover:bg-surface-500/40 transition"
            >
              <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {l.event}
                  {l.label ? (
                    <span className="font-normal text-slate-500 dark:text-slate-400">
                      {" "}
                      — {l.label}
                    </span>
                  ) : null}
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">
                  {l.created_at ? formatWhen(l.created_at) : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentActivityPanel;
