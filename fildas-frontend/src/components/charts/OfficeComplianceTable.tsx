import React from "react";
import { type ComplianceOfficeDatum } from "../../services/types";
import ChartSkeleton from "../ui/loader/ChartSkeleton";

interface Props {
  data: ComplianceOfficeDatum[];
  loading?: boolean;
}

const OfficeComplianceTable: React.FC<Props> = ({ data, loading = false }) => {
  if (loading) return <ChartSkeleton type="bar" height={300} />;

  const sorted = [...data].sort((a, b) => b.in_review + b.approved - (a.in_review + a.approved));

  return (
    <div className="flex flex-col min-h-0 w-full overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-50 dark:bg-surface-600/50 border-b border-slate-200 dark:border-surface-400">
        <span className="w-16 shrink-0 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Office</span>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">In Review</span>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Approved</span>
        <span className="flex-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Approval %</span>
        <span className="w-16 shrink-0 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Returned</span>
      </div>

      {/* Table Body - Scrollable */}
      <div className="overflow-y-auto divide-y divide-slate-100 dark:divide-surface-400" style={{ maxHeight: "320px" }}>
        {!sorted.length ? (
          <div className="py-12 text-center text-xs text-slate-400 dark:text-slate-500">
            No compliance data available for this cluster
          </div>
        ) : (
          sorted.map((d) => {
            const total = d.in_review + d.approved + d.returned || 1;
            const approvalPct = Math.round((d.approved / total) * 100);
            
            return (
              <div key={d.office_id} className="flex items-center gap-4 px-4 py-2.5 hover:bg-slate-50/50 dark:hover:bg-surface-400/20 transition-colors group">
                {/* Office Code */}
                <span className="w-16 shrink-0 text-xs font-bold text-slate-700 dark:text-slate-100">
                  {d.office_code}
                </span>

                {/* In Review */}
                <span className="flex-1 text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {d.in_review}
                </span>

                {/* Approved */}
                <span className="flex-1 text-xs font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {d.approved}
                </span>

                {/* Progress Bar */}
                <div className="flex-[1.5] flex items-center gap-3">
                  <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                    <div 
                      className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${approvalPct}%` }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-[10px] tabular-nums font-bold text-slate-400 dark:text-slate-500 text-right">
                    {approvalPct}%
                  </span>
                </div>

                {/* Returned */}
                <span className="w-16 shrink-0 text-right text-xs font-bold tabular-nums text-rose-500 dark:text-rose-400">
                  {d.returned}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default OfficeComplianceTable;
