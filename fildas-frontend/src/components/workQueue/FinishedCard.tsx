import React from "react";
import { CheckCircle2, FileText } from "lucide-react";
import type { FinishedDocumentRow } from "../../services/documents";

interface FinishedCardProps {
  doc: FinishedDocumentRow;
  onClick: () => void;
}

const FinishedCard: React.FC<FinishedCardProps> = ({ doc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left flex items-center gap-4 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3 transition hover:border-slate-300 dark:hover:border-slate-600 group"
  >
    <div className="shrink-0 flex h-8 w-8 items-center justify-center rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
      <FileText className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
        {doc.title}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
        {doc.code ?? "—"} · v{doc.version_number}
        {doc.owner_office_code && ` · ${doc.owner_office_code}`}
      </p>
    </div>
    <div className="shrink-0 flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1 rounded bg-slate-100 dark:bg-surface-400 border border-slate-200 dark:border-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Distributed
      </span>
      {doc.distributed_at && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {new Date(doc.distributed_at).toLocaleDateString()}
        </span>
      )}
    </div>
  </button>
);

export default FinishedCard;
