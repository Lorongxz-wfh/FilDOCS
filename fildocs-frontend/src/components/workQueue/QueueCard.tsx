import React from "react";
import { motion } from "framer-motion";
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
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      type="button"
      onClick={() => onClick(doc.id)}
      className={`group w-full text-left flex items-center gap-4 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-3 sm:px-4 sm:py-3 transition-shadow hover:shadow-md hover:border-slate-300 dark:hover:border-surface-300 min-w-0 relative overflow-hidden`}
    >
      {/* Action Indicator Strip */}
      {item.can_act && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 dark:bg-rose-400" />
      )}

      {/* Title + meta */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {doc.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-mono font-medium">
            v{ver.version_number}
          </span>
          <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-surface-400" />
          <StatusBadge status={ver.status} className="scale-[0.85] origin-left" />
        </div>
      </div>

      <div className="shrink-0 text-right">
        {item.can_act ? (
          <span className="text-[10px] sm:text-[11px] font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider block">
            Action needed
          </span>
        ) : (
          <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Monitoring
          </span>
        )}
      </div>
    </motion.button>
  );
};

export default QueueCard;
