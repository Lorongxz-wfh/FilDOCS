import React from "react";
import { BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
  Legend,
  CartesianGrid,
} from "recharts";

export type StageDelay = {
  stage: string;
  avg_hours: number;
  median_hours?: number;
  count: number;
  task_count: number;
};

// Phase colour palette
// Phase colour palette
const PHASE_COLORS: Record<string, string> = {
  Review:      "var(--color-brand-400)",
  Approval:    "var(--color-brand-600)",
  Finalization: "var(--color-neutral-600)",
};
const FALLBACK_COLOR = "var(--color-neutral-400)";

const phaseColor = (stage: string) => PHASE_COLORS[stage] ?? FALLBACK_COLOR;

// ── Skeleton ──────────────────────────────────────────────────────────────────

import { ChartSkeleton } from "../ui/loader/ChartSkeleton";

// ── Empty ─────────────────────────────────────────────────────────────────────

const EmptyChart = ({ height = 200 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 w-full rounded-lg border border-dashed border-neutral-200 dark:border-surface-400 bg-neutral-50/20 dark:bg-surface-600/10 text-neutral-400 dark:text-neutral-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-semibold uppercase tracking-widest opacity-60">No data available</span>
  </div>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d: StageDelay = payload[0].payload;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-3 py-2.5 shadow-xl shadow-neutral-900/5 text-xs space-y-1">
      <p className="font-bold text-neutral-900 dark:text-neutral-50 mb-1.5 uppercase tracking-tight">{label}</p>
      <p className="text-neutral-500 dark:text-neutral-400 font-medium">
        Median:{" "}
        <span className="font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
          {d.median_hours != null ? `${d.median_hours}h` : "—"}
        </span>
      </p>
      <p className="text-neutral-500 dark:text-neutral-400 font-medium">
        Avg:{" "}
        <span className="font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
          {d.avg_hours}h
        </span>
      </p>
      <p className="text-neutral-500 dark:text-neutral-400 font-medium">
        Tasks:{" "}
        <span className="font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
          {d.task_count}
        </span>{" "}
        across{" "}
        <span className="font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">
          {d.count}
        </span>{" "}
        docs
      </p>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const StageDelayChart: React.FC<{
  data: StageDelay[];
  height?: number;
  loading?: boolean;
}> = ({ data, height = 200, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} type="bar-horizontal" />;
  const hasValues = data?.some(d => (d.median_hours ?? d.avg_hours) > 0);
  if (!data?.length || !hasValues) return <EmptyChart height={height} />;

  // Use median_hours if present, fall back to avg_hours
  const chartData = data.map((d) => ({
    ...d,
    display_hours: d.median_hours ?? d.avg_hours,
  }));

  // Identify the bottleneck (highest median/avg)
  const bottleneckStage = chartData.reduce(
    (best, d) => (d.display_hours > best.display_hours ? d : best),
    chartData[0],
  ).stage;

  const maxVal = Math.max(...chartData.map((d) => d.display_hours), 0.1);

  return (
    <div className="flex flex-col gap-3">
      {/* Legend row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
        {chartData.map((d) => (
          <div key={d.stage} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full shrink-0 border border-black/5 dark:border-white/10"
              style={{ backgroundColor: phaseColor(d.stage) }}
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{d.stage}</span>
            {d.stage === bottleneckStage && d.display_hours > 0 && (
              <span className="rounded-full bg-rose-50 dark:bg-rose-950/30 px-1.5 py-px text-[9px] font-bold text-rose-600 dark:text-rose-400 leading-none uppercase tracking-widest border border-rose-200/50 dark:border-rose-800/50">
                slowest
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ height, minWidth: 0 }} className="w-full">
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 52, left: 4, bottom: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-400)" strokeOpacity={0.1} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, maxVal * 1.15]}
              tick={{ fontSize: 10, fontWeight: 600, fill: "var(--color-neutral-400)" }}
              unit="h"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 10, fontWeight: 600, fill: "var(--color-neutral-500)", textTransform: 'uppercase', letterSpacing: '0.05em' }}
              width={88}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148, 163, 184, 0.1)" }} />
            <Bar dataKey="display_hours" radius={[0, 2, 2, 0]} maxBarSize={28}>
              <LabelList
                dataKey="display_hours"
                position="right"
                formatter={(v: unknown) => {
                  const n = v as number;
                  return n > 0 ? `${n}h` : "—";
                }}
                style={{ fontSize: 10, fontWeight: 700, fill: "var(--color-neutral-600)", fontVariantNumeric: 'tabular-nums' }}
              />
              {chartData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={phaseColor(entry.stage)}
                  opacity={entry.stage === bottleneckStage ? 1 : 0.7}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote */}
      <p className="text-[10px] text-neutral-400 dark:text-neutral-500 px-1 italic font-medium leading-tight">
        Median task hold time · completed documents only · all routing modes
      </p>
    </div>
  );
};

export default StageDelayChart;
