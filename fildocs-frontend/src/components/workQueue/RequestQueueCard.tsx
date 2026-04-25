import React from "react";
import { StatusBadge } from "../ui/Badge";
import { Users, FileStack } from "lucide-react";
import { Card, CardBody } from "../ui/Card";

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
    <Card
      onClick={() => onClick(item.request_id || item.id)}
      className="group relative overflow-hidden"
    >
      <CardBody className="flex-row items-center gap-4 py-3 px-4">
        {/* Action Indicator Strip */}
        {isActionNeeded && (
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 dark:bg-rose-400" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
            {title}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500">
              {isMultiDoc ? <FileStack className="h-3 w-3" /> : <Users className="h-3 w-3" />}
              <span className="uppercase tracking-wider">{isMultiDoc ? "Multi-doc" : "Multi-office"}</span>
            </div>
            <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-surface-400 shrink-0" />
            <StatusBadge status={status} className="scale-[0.85] origin-left" />
          </div>
        </div>

        <div className="shrink-0 text-right">
          {isActionNeeded ? (
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest block">
              Action needed
            </span>
          ) : (item.status?.toLowerCase() === "closed") ? (
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Closed
            </span>
          ) : (item.status?.toLowerCase() === "cancelled") ? (
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-500/50 dark:text-rose-400/50 uppercase tracking-widest block">
              Cancelled
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Ongoing
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
};
export default RequestQueueCard;
