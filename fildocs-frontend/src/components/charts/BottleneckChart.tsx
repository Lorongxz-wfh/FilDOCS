import React from "react";
import { BarChart2 } from "lucide-react";

const EmptyChart = ({ height = 220 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-surface-300 bg-slate-50/50 dark:bg-surface-600/30 text-slate-400 dark:text-slate-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-medium">No data available</span>
  </div>
);
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

export type BottleneckDatum = {
  office: string;
  avg_hours: number;
  task_count: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Red ≥ 72h · Amber ≥ 48h · Sky = normal */
const severityColor = (hours: number): string => {
  if (hours >= 72) return "#f43f5e";
  if (hours >= 48) return "#f59e0b";
  return "#38bdf8";
};

const severityLabel = (hours: number): string => {
  if (hours >= 72) return "Critical";
  if (hours >= 48) return "Slow";
  return "Normal";
};

// ── Tooltip ────────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const hours: number = payload[0].value;
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1">
        {label}
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        Avg hold:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {hours}h
        </span>
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        Active tasks:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {payload[0].payload.task_count}
        </span>
      </p>
      <p className="mt-1" style={{ color: severityColor(hours) }}>
        {severityLabel(hours)}
      </p>
    </div>
  );
};

// ── Chart ──────────────────────────────────────────────────────────────────────

const ChartSkeleton = ({ height = 220 }: { height?: number }) => (
  <div style={{ height }} className="flex flex-col justify-center gap-3 px-4 py-3">
    {[80, 55, 70, 40, 65].map((w, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="w-16 h-2.5 animate-pulse rounded bg-slate-100 dark:bg-surface-400 shrink-0" />
        <div className="animate-pulse rounded-r-sm bg-slate-100 dark:bg-surface-400 h-4" style={{ width: `${w}%` }} />
      </div>
    ))}
  </div>
);

const BottleneckChart: React.FC<{
  data: BottleneckDatum[];
  height?: number;
  loading?: boolean;
}> = ({ data, height = 220, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} />;
  if (!data?.length) return <EmptyChart height={height} />;
  const sorted = [...data].sort((a, b) => b.avg_hours - a.avg_hours);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 56, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          unit="h"
        />
        <YAxis
          type="category"
          dataKey="office"
          tick={{ fontSize: 11 }}
          width={80}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(148,163,184,0.07)" }}
        />
        <Bar dataKey="avg_hours" radius={[0, 4, 4, 0]} maxBarSize={20}>
          <LabelList
            dataKey="avg_hours"
            position="right"
            formatter={(v: unknown) => `${v}h`}
            style={{ fontSize: 11, fill: "currentColor" }}
          />
          {sorted.map((d) => (
            <Cell key={d.office} fill={severityColor(d.avg_hours)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default BottleneckChart;
