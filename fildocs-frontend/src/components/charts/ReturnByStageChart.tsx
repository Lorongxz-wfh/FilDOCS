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
  CartesianGrid,
  LineChart,
  Line,
  Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReturnByStageItem = {
  stage: string;
  returns: number;
  total: number; // total tasks that passed through this step
};

export type ReturnTrendItem = {
  label: string;
  Office: number;
  VP: number;
  President: number;
  QA: number;
};

export type ReturnByStageVariant = "horizontal" | "grouped" | "table" | "line";

// ── Helpers ────────────────────────────────────────────────────────────────────

const returnRate = (returns: number, total: number) =>
  total ? Math.round((returns / total) * 100) : 0;

// ── Shared tooltip ─────────────────────────────────────────────────────────────

const SharedTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
        {label}
      </p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
          <span className="ml-auto font-semibold text-slate-800 dark:text-slate-100 pl-3">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ── Variant: Horizontal bar (ranked by return count) ──────────────────────────

const HorizontalBar: React.FC<{
  data: ReturnByStageItem[];
  height: number;
}> = ({ data, height }) => {
  const sorted = [...data].sort((a, b) => b.returns - a.returns);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={sorted}
        layout="vertical"
        margin={{ top: 4, right: 48, left: 0, bottom: 0 }}
      >
        <XAxis
          type="number"
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="stage"
          tick={{ fontSize: 11 }}
          width={136}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<SharedTooltip />}
          cursor={{ fill: "rgba(148,163,184,0.07)" }}
        />
        <Bar
          dataKey="returns"
          name="Returns"
          fill="#f43f5e"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
        />
      </BarChart>
    </ResponsiveContainer>
  );
};

// ── Variant: Grouped bar (total passed vs returned per stage) ─────────────────

const GroupedBar: React.FC<{ data: ReturnByStageItem[]; height: number }> = ({
  data,
  height,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart
      data={data}
      margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
      barCategoryGap="35%"
      barGap={3}
    >
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="rgba(148,163,184,0.12)"
        vertical={false}
      />
      <XAxis
        dataKey="stage"
        tick={{ fontSize: 10 }}
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
        content={<SharedTooltip />}
        cursor={{ fill: "rgba(148,163,184,0.07)" }}
      />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <Bar
        dataKey="total"
        name="Total passed"
        fill="#38bdf8"
        radius={[4, 4, 0, 0]}
        maxBarSize={28}
      />
      <Bar
        dataKey="returns"
        name="Returned"
        fill="#f43f5e"
        radius={[4, 4, 0, 0]}
        maxBarSize={28}
      />
    </BarChart>
  </ResponsiveContainer>
);

// ── Variant: Table with inline bar indicators ──────────────────────────────────

const TableView: React.FC<{ data: ReturnByStageItem[] }> = ({ data }) => {
  const sorted = [...data].sort((a, b) => b.returns - a.returns);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-surface-400">
            {["Stage", "Total passed", "Returns", "Return rate"].map((h) => (
              <th
                key={h}
                className="pb-3 pr-6 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => {
            const rate = returnRate(row.returns, row.total);
            return (
              <tr
                key={row.stage}
                className="border-b border-slate-100 dark:border-surface-400 last:border-0"
              >
                <td className="py-3 pr-6 font-semibold text-slate-900 dark:text-slate-100">
                  {row.stage}
                </td>
                <td className="py-3 pr-6 tabular-nums text-slate-600 dark:text-slate-400">
                  {row.total}
                </td>
                <td className="py-3 pr-6 tabular-nums font-medium text-rose-600 dark:text-rose-400">
                  {row.returns}
                </td>
                <td className="py-3 pr-6">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-rose-500"
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400">
                      {rate}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// ── Variant: Line trend over time ──────────────────────────────────────────────

const LineTrend: React.FC<{ data: ReturnTrendItem[]; height: number }> = ({
  data,
  height,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
      <CartesianGrid
        strokeDasharray="3 3"
        stroke="rgba(148,163,184,0.12)"
        vertical={false}
      />
      <XAxis
        dataKey="label"
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
        content={<SharedTooltip />}
        cursor={{ stroke: "rgba(148,163,184,0.2)" }}
      />
      <Legend wrapperStyle={{ fontSize: 11 }} />
      <Line
        type="monotone"
        dataKey="Office"
        stroke="#38bdf8"
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4 }}
      />
      <Line
        type="monotone"
        dataKey="VP"
        stroke="#f59e0b"
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4 }}
      />
      <Line
        type="monotone"
        dataKey="President"
        stroke="#a855f7"
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4 }}
      />
      <Line
        type="monotone"
        dataKey="QA"
        stroke="#10b981"
        strokeWidth={2}
        dot={false}
        activeDot={{ r: 4 }}
      />
    </LineChart>
  </ResponsiveContainer>
);

// ── Main export ────────────────────────────────────────────────────────────────

const ChartSkeleton = ({ height = 220 }: { height?: number }) => (
  <div style={{ height }} className="flex flex-col justify-center gap-3 px-4 py-3">
    {[75, 50, 90, 35, 60].map((w, i) => (
      <div key={i} className="flex items-center gap-3">
        <div className="w-32 h-2.5 animate-pulse rounded bg-slate-100 dark:bg-surface-400 shrink-0" />
        <div className="animate-pulse rounded-r-sm bg-slate-100 dark:bg-surface-400 h-4" style={{ width: `${w}%` }} />
      </div>
    ))}
  </div>
);

const ReturnByStageChart: React.FC<{
  data: ReturnByStageItem[];
  trendData?: ReturnTrendItem[];
  variant: ReturnByStageVariant;
  height?: number;
  loading?: boolean;
}> = ({ data, trendData = [], variant, height = 220, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} />;
  const isEmpty = variant === "line" ? !trendData?.length : !data?.length;
  if (isEmpty) return <EmptyChart height={height} />;
  if (variant === "horizontal")
    return <HorizontalBar data={data} height={height} />;
  if (variant === "grouped") return <GroupedBar data={data} height={height} />;
  if (variant === "table") return <TableView data={data} />;
  return <LineTrend data={trendData} height={height} />;
};

export default ReturnByStageChart;
