import React from "react";
import type { WorkQueueItem } from "../../services/documents";

interface QueueCardProps {
  item: WorkQueueItem;
  onClick: (id: number) => void;
}

const statusColor = (s: string): string => {
  const sl = s.toLowerCase();
  if (sl.includes("draft"))
    return "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  if (sl.includes("review"))
    return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
  if (sl.includes("approval"))
    return "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400";
  if (sl.includes("distribut"))
    return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
  return "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400";
};

const QueueCard: React.FC<QueueCardProps> = ({ item, onClick }) => {
  const doc = item.document;
  const ver = item.version;

  return (
    <button
      type="button"
      onClick={() => onClick(doc.id)}
      className="w-full text-left flex items-center gap-4 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3 transition hover:border-slate-300 dark:hover:border-slate-600"
    >
      <div className="shrink-0">
        <span
          className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-medium ${statusColor(ver.status)}`}
        >
          {ver.status}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {doc.title}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {doc.code} · v{ver.version_number}
        </p>
      </div>
      <div className="shrink-0">
        {item.can_act ? (
          <span className="inline-flex items-center gap-1 rounded bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-400">
            Action needed →
          </span>
        ) : (
          <span className="inline-flex items-center rounded bg-slate-50 dark:bg-surface-400 border border-slate-200 dark:border-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Monitoring
          </span>
        )}
      </div>
    </button>
  );
};

export default QueueCard;
