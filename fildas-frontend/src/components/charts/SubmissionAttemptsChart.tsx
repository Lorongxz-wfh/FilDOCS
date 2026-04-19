import React from "react";
import { BarChart2 } from "lucide-react";

const EmptyChart = ({ height = 200 }: { height?: number }) => (
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

export type AttemptDatum = {
  attempt: string;
  count: number;
};

// ── Colors — green → amber → red (severity of ping-pong) ──────────────────────

const ATTEMPT_COLORS: Record<string, string> = {
  "1st pass": "#34d399",
  "2nd attempt": "#f59e0b",
  "3rd+ attempt": "#f43f5e",
};

// ── Tooltip ────────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
        {label}
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-800 dark:text-slate-100">
          {payload[0].value}
        </span>{" "}
        recipients
      </p>
    </div>
  );
};

// ── Component ──────────────────────────────────────────────────────────────────

const ChartSkeleton = ({ height = 200 }: { height?: number }) => (
  <div style={{ height }} className="flex items-end justify-center gap-6 px-8 pb-5 pt-2">
    {[75, 45, 20].map((h, i) => (
      <div key={i} className="flex-1 animate-pulse rounded-t-sm bg-slate-100 dark:bg-surface-400" style={{ height: `${h}%` }} />
    ))}
  </div>
);

const SubmissionAttemptsChart: React.FC<{
  data: AttemptDatum[];
  height?: number;
  loading?: boolean;
}> = ({ data, height = 200, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} />;
  if (!data?.length) return <EmptyChart height={height} />;
  return (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart
      data={data}
      margin={{ top: 16, right: 8, left: -16, bottom: 0 }}
      barCategoryGap="45%"
    >
      <XAxis
        dataKey="attempt"
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fontSize: 11 }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip
        content={<CustomTooltip />}
        cursor={{ fill: "rgba(148,163,184,0.07)" }}
      />
      <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={64}>
        <LabelList
          dataKey="count"
          position="top"
          style={{ fontSize: 12, fontWeight: 600, fill: "currentColor" }}
        />
        {data.map((d) => (
          <Cell key={d.attempt} fill={ATTEMPT_COLORS[d.attempt] ?? "#94a3b8"} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
  );
};

export default SubmissionAttemptsChart;
