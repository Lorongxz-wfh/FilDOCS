import React from "react";
import { motion } from "framer-motion";
import { StatusBadge } from "../ui/Badge";
import { Users, FileStack } from "lucide-react";

interface RequestQueueCardProps {
  item: any;
  onClick: (id: number) => void;
}

const RequestQueueCard: React.FC<RequestQueueCardProps> = ({ item, onClick }) => {
  const isMultiDoc = item.batch_mode === "multi_doc" || item.mode === "multi_doc";
  const title = item.item_title || item.batch_title || item.title;
  const status = item.item_status || item.status || "Pending";
  const isActionNeeded = !!item.can_act;
  
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.99 }}
      type="button"
      onClick={() => onClick(item.request_id || item.id)}
      className="group w-full text-left flex items-center gap-4 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-3 sm:px-4 sm:py-3 transition-shadow hover:shadow-md hover:border-slate-300 dark:hover:border-surface-300 min-w-0 relative overflow-hidden"
    >
      {/* Action Indicator Strip */}
      {isActionNeeded && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 dark:bg-rose-400" />
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500">
             {isMultiDoc ? <FileStack className="h-3 w-3" /> : <Users className="h-3 w-3" />}
             <span>{isMultiDoc ? "Multi-doc" : "Multi-office"}</span>
          </div>
          <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-surface-400 shrink-0" />
          <StatusBadge status={status} className="scale-[0.85] origin-left" />
        </div>
      </div>

      <div className="shrink-0 text-right">
        {isActionNeeded ? (
          <span className="text-[10px] sm:text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider block">
            Action needed
          </span>
        ) : (item.status?.toLowerCase() === "closed") ? (
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Closed
          </span>
        ) : (item.status?.toLowerCase() === "cancelled") ? (
          <span className="text-[10px] sm:text-[11px] font-bold text-rose-500/50 dark:text-rose-400/50 uppercase tracking-wider block">
            Cancelled
          </span>
        ) : (
          <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
            Ongoing
          </span>
        )}
      </div>

    </motion.button>
  );
};

export default RequestQueueCard;
