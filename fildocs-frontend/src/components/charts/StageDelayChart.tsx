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
const PHASE_COLORS: Record<string, string> = {
  Review:      "#38bdf8", // sky-400
  Approval:    "#a78bfa", // violet-400
  Finalization: "#34d399", // emerald-400
};
const FALLBACK_COLOR = "#94a3b8";

const phaseColor = (stage: string) => PHASE_COLORS[stage] ?? FALLBACK_COLOR;

// ── Skeleton ──────────────────────────────────────────────────────────────────

import ChartSkeleton from "../ui/loader/ChartSkeleton";

// ── Empty ─────────────────────────────────────────────────────────────────────

const EmptyChart = ({ height = 200 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-surface-300 bg-slate-50/50 dark:bg-surface-600/30 text-slate-400 dark:text-slate-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-medium">No data available</span>
  </div>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const d: StageDelay = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 px-3 py-2.5 shadow-md text-xs space-y-0.5">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">{label}</p>
      <p className="text-slate-500 dark:text-slate-400">
        Median:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {d.median_hours != null ? `${d.median_hours}h` : "—"}
        </span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        Avg:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {d.avg_hours}h
        </span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        Tasks:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {d.task_count}
        </span>{" "}
        across{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
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
  if (loading) return <ChartSkeleton height={height} type="bar" />;
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
              className="h-2 w-2 rounded-full shrink-0"
              style={{ backgroundColor: phaseColor(d.stage) }}
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400">{d.stage}</span>
            {d.stage === bottleneckStage && d.display_hours > 0 && (
              <span className="rounded-full bg-rose-100 dark:bg-rose-900/30 px-1.5 py-px text-[11px] font-semibold text-rose-600 dark:text-rose-400 leading-none">
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
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 15 }}
            />
            <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} horizontal={false} />
            <XAxis
              type="number"
              domain={[0, maxVal * 1.15]}
              tick={{ fontSize: 11, fontWeight: 500, fill: "#94a3b8" }}
              unit="h"
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="stage"
              tick={{ fontSize: 11, fontWeight: 500, fill: "#94a3b8" }}
              width={88}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
            <Bar dataKey="display_hours" radius={[0, 4, 4, 0]} maxBarSize={28}>
              <LabelList
                dataKey="display_hours"
                position="right"
                formatter={(v: unknown) => {
                  const n = v as number;
                  return n > 0 ? `${n}h` : "—";
                }}
                style={{ fontSize: 11, fill: "#94a3b8" }}
              />
              {chartData.map((entry) => (
                <Cell
                  key={entry.stage}
                  fill={phaseColor(entry.stage)}
                  opacity={entry.stage === bottleneckStage ? 1 : 0.65}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footnote */}
      <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1 italic">
        Median task hold time · completed documents only · all routing modes
      </p>
    </div>
  );
};

export default StageDelayChart;
