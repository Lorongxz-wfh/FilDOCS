import React from "react";
import type { DocumentRequestProgress } from "../../services/documentRequests";

interface RequestProgressBarProps {
  progress: DocumentRequestProgress;
}

const RequestProgressBar: React.FC<RequestProgressBarProps> = ({ progress }) => {
  const { total, submitted, accepted } = progress;
  if (total === 0) return null;
  const submittedPct = Math.round((submitted / total) * 100);
  const acceptedPct = Math.round((accepted / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 h-2 rounded-full bg-slate-200 dark:bg-surface-400 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-sky-300 dark:bg-sky-700 transition-all"
          style={{ width: `${submittedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 dark:bg-emerald-400 transition-all"
          style={{ width: `${acceptedPct}%` }}
        />
      </div>
      <div className="shrink-0 flex items-center gap-3 text-[11px]">
        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
          <span className="h-2 w-2 rounded-full bg-slate-300 dark:bg-surface-300 inline-block" />
          Total: <strong>{total}</strong>
        </span>
        <span className="flex items-center gap-1 text-sky-600 dark:text-sky-400">
          <span className="h-2 w-2 rounded-full bg-sky-300 dark:bg-sky-700 inline-block" />
          Submitted: <strong>{submitted}</strong>
        </span>
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 inline-block" />
          Accepted: <strong>{accepted}</strong>
        </span>
      </div>
    </div>
  );
};

export default RequestProgressBar;
