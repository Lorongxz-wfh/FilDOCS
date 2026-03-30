import React from "react";
import type { WorkQueueItem } from "../../services/documents";
import { StatusBadge, TypePill } from "../ui/Badge";

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
      className="w-full text-left flex items-center gap-3 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-surface-400"
    >
      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
          {doc.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {doc.code ?? "—"} · v{ver.version_number}
          </span>
          <StatusBadge status={ver.status} />
        </div>
      </div>

      <div className="shrink-0">
        {item.can_act ? (
          <TypePill label="Action needed" />
        ) : (
          <TypePill label="Monitoring" />
        )}
      </div>
    </button>
  );
};

export default QueueCard;
