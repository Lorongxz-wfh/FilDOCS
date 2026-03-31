import React from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../ui/loader/Skeleton";
import type { PendingAction } from "../../services/types";
import { FileText, CheckCircle, Megaphone } from "lucide-react";

type Props = {
  items: PendingAction[];
  loading: boolean;
};

const statusColor: Record<string, string> = {
  // Document statuses
  Draft: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  "For Office Review":
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  "For VP Review":
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  "For President Approval":
    "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  "For Office Approval":
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  "For VP Approval":
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  "For QA Final Check":
    "bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400",
  "For QA Registration":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  "For QA Distribution":
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  // Request statuses
  Pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Rejected: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Open: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
};

const DashboardPendingList: React.FC<Props> = ({ items, loading }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Pending actions
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Items requiring your attention right now.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/work-queue")}
          className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors"
        >
          View all →
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-slate-100 dark:divide-surface-400">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-7 w-7 rounded" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
              <CheckCircle className="h-4.5 w-4.5 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              All caught up
            </p>
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
              No pending actions right now.
            </p>
          </div>
        ) : (
          items.slice(0, 5).map((x) => {
            const colorClass =
              statusColor[x.status] ??
              "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
            
            const isRequest = x.type === "request";
            const Icon = isRequest ? Megaphone : FileText;

            const handleClick = () => {
              if (x.type === "document") {
                navigate(`/documents/${x.item.document.id}?version_id=${x.item.version.id}`);
              } else {
                navigate(`/document-requests/${x.id}`);
              }
            };

            return (
              <button
                key={`${x.type}-${x.id}`}
                type="button"
                onClick={handleClick}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-surface-400"
              >
                {/* Icon */}
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${isRequest ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-100 dark:bg-surface-400'}`}>
                  <Icon className={`h-3.5 w-3.5 ${isRequest ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`} />
                </div>

                {/* Title + code */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {x.title}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {x.code ?? "—"}
                  </p>
                </div>

                {/* Status badge */}
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight ${colorClass}`}
                >
                  {x.status}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

export default DashboardPendingList;
