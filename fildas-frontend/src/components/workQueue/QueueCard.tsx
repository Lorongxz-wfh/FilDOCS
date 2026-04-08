import React from "react";
import type { WorkQueueItem } from "../../services/documents";
import { StatusBadge } from "../ui/Badge";

interface QueueCardProps {
  item: WorkQueueItem;
  onClick: (id: number) => void;
}

const QueueCard: React.FC<QueueCardProps> = ({ item, onClick }) => {
  const doc = item.document;
  const ver = item.version;

  return (
    <button
      type="button"
      onClick={() => onClick(doc.id)}
      className="w-full text-left flex items-center gap-3 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-3 sm:px-4 sm:py-3 transition-colors hover:bg-slate-50 dark:hover:bg-surface-400 min-w-0"
    >
      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
          {doc.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            v{ver.version_number}
          </span>
          <StatusBadge status={ver.status} className="scale-[0.85] origin-left translate-y-[0.5px]" />
        </div>
      </div>

      <div className="shrink-0 text-right">
        {item.can_act ? (
          <span className="text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider block">
            Action needed
          </span>
        ) : (
          <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Monitoring
          </span>
        )}
      </div>

    </button>
  );
};

export default QueueCard;
