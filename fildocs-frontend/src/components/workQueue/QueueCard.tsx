import React from "react";
import type { WorkQueueItem } from "../../services/documents";
import { StatusBadge } from "../ui/Badge";
import { Card, CardBody } from "../ui/Card";

interface QueueCardProps {
  item: WorkQueueItem;
  onClick: (id: number) => void;
}

const QueueCard: React.FC<QueueCardProps> = ({ item, onClick }) => {
  const doc = item.document;
  const ver = item.version;

  return (
    <Card
      onClick={() => onClick(doc.id)}
      className="group relative overflow-hidden"
    >
      <CardBody className="flex-row items-center gap-4 py-3 px-4">
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
            <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-mono font-bold">
              v{ver.version_number}
            </span>
            <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-surface-400" />
            <StatusBadge status={ver.status} className="scale-[0.85] origin-left" />
          </div>
        </div>

        <div className="shrink-0 text-right">
          {item.can_act ? (
            <span className="text-[10px] sm:text-[11px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-widest block">
              Action needed
            </span>
          ) : (
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
              Monitoring
            </span>
          )}
        </div>
      </CardBody>
    </Card>
  );
};

export default QueueCard;
