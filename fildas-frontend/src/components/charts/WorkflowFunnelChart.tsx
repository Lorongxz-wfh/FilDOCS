import React from "react";
import { GitMerge } from "lucide-react";
import Skeleton from "../ui/loader/Skeleton";

export type FunnelDatum = { stage: string; count: number };

// Stage color + visual config
const STAGE_CONFIG: Record<string, { bar: string; text: string }> = {
  "Created":            { bar: "bg-sky-400 dark:bg-sky-500",      text: "text-sky-600 dark:text-sky-400" },
  "Completed Review":   { bar: "bg-violet-400 dark:bg-violet-500", text: "text-violet-600 dark:text-violet-400" },
  "Completed Approval": { bar: "bg-amber-400 dark:bg-amber-500",   text: "text-amber-600 dark:text-amber-400" },
  "Distributed":        { bar: "bg-emerald-400 dark:bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  "Cancelled":          { bar: "bg-rose-400 dark:bg-rose-500",     text: "text-rose-500 dark:text-rose-400" },
};
const fallbackConfig = { bar: "bg-slate-400", text: "text-slate-600" };

// Main funnel stages (not Cancelled — rendered separately below)
const FUNNEL_ORDER = ["Created", "Completed Review", "Completed Approval", "Distributed"];

// ── Skeleton ──────────────────────────────────────────────────────────────────

const ChartSkeleton = () => (
  <div className="flex flex-col gap-3 py-1">
    {[100, 82, 70, 60].map((w, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="h-3 w-32 shrink-0" />
        <Skeleton className="h-6 rounded-sm flex-1" style={{ maxWidth: `${w}%` }} />
        <Skeleton className="h-3 w-8 shrink-0" />
      </div>
    ))}
  </div>
);

// ── Empty ─────────────────────────────────────────────────────────────────────

const EmptyChart = () => (
  <div className="flex flex-col items-center justify-center gap-2 py-10 rounded-lg border border-dashed border-slate-200 dark:border-surface-300 bg-slate-50/50 dark:bg-surface-600/30 text-slate-400 dark:text-slate-500">
    <GitMerge className="h-5 w-5 opacity-40" />
    <span className="text-xs font-medium">No data available</span>
  </div>
);

// ── Drop-off badge ────────────────────────────────────────────────────────────

const DropBadge = ({ pct }: { pct: number }) => (
  <span className="inline-flex items-center rounded-full bg-rose-50 dark:bg-rose-900/20 px-1.5 py-px text-[10px] font-semibold text-rose-500 dark:text-rose-400 leading-none">
    -{pct}%
  </span>
);

// ── Main ──────────────────────────────────────────────────────────────────────

const WorkflowFunnelChart: React.FC<{
  data: FunnelDatum[];
  loading?: boolean;
}> = ({ data, loading = false }) => {
  if (loading) return <ChartSkeleton />;
  if (!data?.length) return <EmptyChart />;

  const byStage = Object.fromEntries(data.map((d) => [d.stage, d.count]));
  const topCount = byStage["Created"] ?? 1;

  const mainStages = FUNNEL_ORDER.filter((s) => byStage[s] !== undefined);
  const cancelledCount = byStage["Cancelled"] ?? 0;

  return (
    <div className="flex flex-col gap-1">
      {/* Funnel rows */}
      {mainStages.map((stage, i) => {
        const count = byStage[stage] ?? 0;
        const barPct = topCount ? (count / topCount) * 100 : 0;
        const cfg = STAGE_CONFIG[stage] ?? fallbackConfig;

        // Drop-off from previous stage
        const prevCount = i === 0 ? null : (byStage[mainStages[i - 1]] ?? 0);
        const dropPct = prevCount && prevCount > 0
          ? Math.round(((prevCount - count) / prevCount) * 100)
          : null;

        return (
          <div key={stage}>
            {/* Drop indicator between rows */}
            {dropPct !== null && dropPct > 0 && (
              <div className="flex items-center gap-2 py-0.5 pl-32 opacity-70">
                <div className="h-px flex-1 border-t border-dashed border-slate-200 dark:border-surface-300 max-w-[60%]" />
                <DropBadge pct={dropPct} />
              </div>
            )}

            <div className="flex items-center gap-3">
              {/* Stage label */}
              <span className="w-32 shrink-0 text-right text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {stage}
              </span>

              {/* Bar track */}
              <div className="flex-1 h-6 bg-slate-100 dark:bg-surface-400 rounded-sm overflow-hidden">
                <div
                  className={`h-full rounded-sm transition-all duration-700 ${cfg.bar}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>

              {/* Count */}
              <span className={`w-10 shrink-0 text-right text-sm font-semibold tabular-nums ${cfg.text}`}>
                {count}
              </span>
            </div>
          </div>
        );
      })}

      {/* Cancelled — shown as a separate note below the funnel */}
      {cancelledCount > 0 && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-rose-100 dark:border-rose-900/30 bg-rose-50 dark:bg-rose-900/10 px-3 py-2">
          <span className="text-xs text-rose-500 dark:text-rose-400 font-medium">
            {cancelledCount} cancelled
          </span>
          <span className="text-[11px] text-rose-400 dark:text-rose-500">
            — removed from flow before distribution
          </span>
        </div>
      )}

      <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
        Document versions · creation date range applied · drop-off shown between stages
      </p>
    </div>
  );
};

export default WorkflowFunnelChart;
