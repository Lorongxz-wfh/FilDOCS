import React from "react";
import { FileText } from "lucide-react";
import type { FinishedDocumentRow } from "../../services/documents";
import { StatusBadge } from "../ui/Badge";
import { Card, CardBody } from "../ui/Card";

interface FinishedCardProps {
  doc: FinishedDocumentRow;
  onClick: () => void;
}

const FinishedCard: React.FC<FinishedCardProps> = ({ doc, onClick }) => (
  <Card
    onClick={onClick}
    className="group"
  >
    <CardBody className="flex-row items-center gap-4 py-3 px-4">
      <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
        <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] sm:text-sm font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
          {doc.title}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-wider">
            {doc.code ?? "No Code"}
          </span>
          <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-surface-400" />
          <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            v{doc.version_number}
            {doc.owner_office_code && ` · ${doc.owner_office_code}`}
          </span>
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1 origin-right">
        <StatusBadge status="Distributed" className="scale-[0.85] origin-right" />
        {doc.distributed_at && (
          <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium tabular-nums uppercase tracking-tighter">
            {new Date(doc.distributed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
          </span>
        )}
      </div>
    </CardBody>
  </Card>
);

export default FinishedCard;
