import React from "react";
import { BarChart2 } from "lucide-react";
import ChartSkeleton from "../ui/loader/ChartSkeleton";

const EmptyChart = ({ height = 220 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 w-full rounded-md border border-dashed border-slate-200/60 dark:border-surface-400/30 bg-slate-50/20 dark:bg-surface-600/10 text-slate-400 dark:text-slate-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-[11px] font-semibold uppercase tracking-wider opacity-60">No data available</span>
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
  PieChart,
  Pie,
  Legend,
  CartesianGrid,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

export type PhaseDistributionDatum = {
  phase: string;
  count: number;
};

export type PhaseDistributionVariant =
  | "stacked-bar"
  | "donut"
  | "stat-cards"
  | "vertical-bar";

// ── Default color map ──────────────────────────────────────────────────────────

const DEFAULT_COLORS: Record<string, string> = {
  Draft: "#94a3b8",
  Review: "#38bdf8",
  Approval: "#a855f7",
  Finalization: "#f59e0b",
  Completed: "#34d399",
};

const fallback = "#94a3b8";

const resolveColor = (
  phase: string,
  colorMap?: Record<string, string>,
): string => (colorMap ?? DEFAULT_COLORS)[phase] ?? fallback;

// ── Tooltip ────────────────────────────────────────────────────────────────────

const ChartTooltip = ({ active, payload, total }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
        {name}
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        {value} docs &middot; {total ? Math.round((value / total) * 100) : 0}%
      </p>
    </div>
  );
};

// ── Variant: Stacked horizontal bar ───────────────────────────────────────────

const StackedBar: React.FC<{
  data: PhaseDistributionDatum[];
  colorMap?: Record<string, string>;
}> = ({ data, colorMap }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="space-y-4">
      <div className="flex h-7 w-full overflow-hidden rounded-md">
        {data.map((d) => (
          <div
            key={d.phase}
            title={`${d.phase}: ${d.count}`}
            style={{
              width: `${total ? (d.count / total) * 100 : 0}%`,
              backgroundColor: resolveColor(d.phase, colorMap),
            }}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {data.map((d) => {
          const p = total ? Math.round((d.count / total) * 100) : 0;
          return (
            <div
              key={d.phase}
              className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400"
            >
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: resolveColor(d.phase, colorMap) }}
              />
              <span>{d.phase}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {d.count}
              </span>
              <span className="text-slate-400 dark:text-slate-500">({p}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Variant: Donut ─────────────────────────────────────────────────────────────

const DonutChart: React.FC<{
  data: PhaseDistributionDatum[];
  height: number;
  colorMap?: Record<string, string>;
}> = ({ data, height, colorMap }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  const pieData = data.map((d) => ({ name: d.phase, value: d.count }));

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="45%"
            innerRadius="48%"
            outerRadius="66%"
            dataKey="value"
            paddingAngle={2}
            stroke="none"
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={resolveColor(entry.name, colorMap)} />
            ))}
          </Pie>
          <Tooltip
            content={(props: any) => <ChartTooltip {...props} total={total} />}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 8, color: '#94a3b8' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label — HTML overlay, always pixel-perfect */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center leading-none"
        style={{ top: "40%" }}
      >
        <span className="text-[22px] font-semibold font-display tabular-nums text-slate-900 dark:text-slate-100 leading-none">
          {total}
        </span>
        <span className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 leading-none">
          total
        </span>
      </div>
    </div>
  );
};

// ── Variant: Stat cards ────────────────────────────────────────────────────────

const StatCards: React.FC<{
  data: PhaseDistributionDatum[];
  colorMap?: Record<string, string>;
}> = ({ data, colorMap }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {data.map((d) => {
        const p = total ? Math.round((d.count / total) * 100) : 0;
        const color = resolveColor(d.phase, colorMap);
        return (
          <div
            key={d.phase}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-3"
          >
            <div className="text-2xl font-semibold font-display tabular-nums text-slate-900 dark:text-slate-100">
              {d.count}
            </div>
            <div className="mt-0.5 text-xs font-semibold uppercase tracking-tight text-slate-500 dark:text-slate-400">
              {d.phase}
            </div>
            <div className="mt-2.5 h-1 w-full rounded-full bg-slate-200 dark:bg-surface-400 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${p}%`, backgroundColor: color }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {p}%
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── Variant: Vertical bar ──────────────────────────────────────────────────────

const VerticalBar: React.FC<{
  data: PhaseDistributionDatum[];
  height: number;
  colorMap?: Record<string, string>;
}> = ({ data, height, colorMap }) => {
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
        barCategoryGap="40%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.1} vertical={false} />
        <XAxis
          dataKey="phase"
          tick={{ fontSize: 11, fontWeight: 500, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fontWeight: 500, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={(props: any) => <ChartTooltip {...props} total={total} />}
          cursor={{ fill: "rgba(148,163,184,0.07)" }}
        />
        <Bar
          dataKey="count"
          name="Documents"
          radius={[4, 4, 0, 0]}
          maxBarSize={40}
        >
          {data.map((d) => (
            <Cell key={d.phase} fill={resolveColor(d.phase, colorMap)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};



const PhaseDistributionChart: React.FC<{
  data: PhaseDistributionDatum[];
  variant: PhaseDistributionVariant;
  height?: number;
  colorMap?: Record<string, string>;
  loading?: boolean;
}> = ({ data, variant, height = 220, colorMap, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} type={variant === "donut" ? "donut" : "bar"} />;
  if (!data?.length) return <EmptyChart height={height} />;
  if (variant === "stacked-bar")
    return <StackedBar data={data} colorMap={colorMap} />;
  if (variant === "donut")
    return <DonutChart data={data} height={height} colorMap={colorMap} />;
  if (variant === "stat-cards")
    return <StatCards data={data} colorMap={colorMap} />;
  return <VerticalBar data={data} height={height} colorMap={colorMap} />;
};

export default PhaseDistributionChart;
