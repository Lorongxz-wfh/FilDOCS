import React from "react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "../ui/Badge";
import SkeletonList from "../ui/loader/SkeletonList";
import InlineSpinner from "../ui/loader/InlineSpinner";
import type { PendingAction } from "../../services/types";
import { FileText, CheckCircle, Megaphone } from "lucide-react";

type Props = {
  items: PendingAction[];
  loading: boolean;
  hasData?: boolean;
};

const DashboardPendingList: React.FC<Props> = ({ items, loading, hasData }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 px-4 py-3">
        <div className="flex items-center gap-2">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
              Pending actions
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Items requiring your attention right now.
            </p>
          </div>
          {loading && hasData && (
            <InlineSpinner size="xs" variant="neutral" className="shrink-0" />
          )}
        </div>
      </div>

      {/* List container with fade */}
      <div className="relative h-[240px] overflow-hidden">
        <div className={`divide-y divide-slate-100 dark:divide-surface-400 transition-opacity duration-200 ${loading && hasData ? "opacity-60" : "opacity-100"}`}>
          {loading && !hasData ? (
            <div className="flex flex-col h-full bg-white dark:bg-surface-500">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-surface-400">
                <SkeletonList variant="text" count={1} />
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                <SkeletonList variant="document" count={4} />
              </div>
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
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
                  className="flex w-full items-center gap-2.5 sm:gap-3 p-3.5 sm:px-4 sm:py-2.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-surface-400 min-w-0"
                >
                  {/* Icon */}
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${isRequest ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-slate-100 dark:bg-surface-400'}`}>
                    <Icon className={`h-3.5 w-3.5 ${isRequest ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`} />
                  </div>

                  {/* Title + code */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100 leading-tight">
                      {x.title}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                      {x.type === "document" ? (x.code || (x.item as any)?.document?.reserved_code || "—") : (x.code || "—")}
                      {x.type === "document" && x.item?.version?.version_number !== undefined && (
                        <> · v{x.item.version.version_number}</>
                      )}
                    </p>
                  </div>

                  {/* Status badge */}
                  <StatusBadge status={x.status} className="shrink-0" />
                </button>
              );
            })
          )}
        </div>

        {/* Fading overlay + Minimal Button */}
        {!loading && (
          <div className={`inset-x-0 bottom-0 flex items-center justify-center ${items.length > 0 ? "absolute h-24 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none" : "py-2"}`}>
            <div className={`${items.length > 0 ? "pb-4 pointer-events-auto" : "mt-2"}`}>
              <button
                type="button"
                onClick={() => navigate("/documents/all")}
                className="flex items-center gap-1.5 px-3 py-1 border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 rounded-sm text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] shadow-xs hover:bg-slate-50 dark:hover:bg-surface-300 transition-all active:scale-95"
              >
                <FileText className="h-2.5 w-2.5" />
                View all workflows
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPendingList;
