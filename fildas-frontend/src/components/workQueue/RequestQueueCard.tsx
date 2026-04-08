import React from "react";
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
  
  return (
    <button
      type="button"
      onClick={() => onClick(item.request_id || item.id)}
      className="w-full text-left flex items-center gap-3 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-3 sm:px-4 sm:py-3 transition-colors hover:bg-slate-50 dark:hover:bg-surface-400 min-w-0"
    >
      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
          {title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="flex items-center gap-1 text-[11px] font-bold text-slate-400 dark:text-slate-500">
             {isMultiDoc ? <FileStack className="h-3 w-3" /> : <Users className="h-3 w-3" />}
             <span>{isMultiDoc ? "Multi-doc" : "Multi-office"}</span>
          </div>
          <span className="text-slate-300 dark:text-slate-600">·</span>
          <StatusBadge status={status} className="scale-[0.85] origin-left" />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span className={`text-[11px] font-bold uppercase tracking-wider block ${
          status.toLowerCase() === "pending" ? "text-rose-500 dark:text-rose-400" : "text-slate-400 dark:text-slate-500"
        }`}>
          {status.toLowerCase() === "pending" ? "Action needed" : "Ongoing"}
        </span>
      </div>

    </button>
  );
};

export default RequestQueueCard;
