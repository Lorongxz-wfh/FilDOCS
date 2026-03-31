import React from "react";
import { FileText } from "lucide-react";
import type { FinishedDocumentRow } from "../../services/documents";
import { StatusBadge } from "../ui/Badge";

interface FinishedCardProps {
  doc: FinishedDocumentRow;
  onClick: () => void;
}

const FinishedCard: React.FC<FinishedCardProps> = ({ doc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left flex items-center gap-3 sm:gap-4 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-3 sm:px-4 sm:py-3 transition hover:border-slate-300 dark:hover:border-slate-600 group min-w-0"
  >
    <div className="shrink-0 flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
      <FileText className="h-3 sm:h-3.5 w-3 sm:w-3.5 text-slate-400 dark:text-slate-500" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[13px] sm:text-sm font-semibold text-slate-900 dark:text-slate-100 truncate leading-tight">
        {doc.title}
      </p>
      <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 truncate italic">
        {doc.code ?? "—"} · v{doc.version_number}
        {doc.owner_office_code && ` · ${doc.owner_office_code}`}
      </p>
    </div>
    <div className="shrink-0 flex flex-col items-end gap-1 scale-[0.85] sm:scale-100 origin-right">
      <StatusBadge status="Distributed" />
      {doc.distributed_at && (
        <span className="text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500 font-medium tabular-nums">
          {new Date(doc.distributed_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })}
        </span>
      )}
    </div>
  </button>
);

export default FinishedCard;
