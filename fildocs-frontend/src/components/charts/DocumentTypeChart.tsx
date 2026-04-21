import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import Skeleton from "../ui/loader/Skeleton";

export type DoctypeDatum = { doctype: string; count: number };

const COLORS: Record<string, string> = {
  internal: "#38bdf8", // sky-400
  external: "#a78bfa", // violet-400
  forms:    "#34d399", // emerald-400
};
const LABELS: Record<string, string> = {
  internal: "Internal",
  external: "External",
  forms:    "Forms",
};
const FALLBACK = "#94a3b8";

const color  = (doctype: string) => COLORS[doctype] ?? FALLBACK;
const label  = (doctype: string) => LABELS[doctype] ?? doctype;

// ── Skeleton ──────────────────────────────────────────────────────────────────

const ChartSkeleton = ({ height }: { height: number }) => (
  <div style={{ height }} className="flex items-center justify-center gap-6">
    <Skeleton className="h-28 w-28 rounded-full" />
    <div className="flex flex-col gap-2">
      {[60, 44, 50].map((w, i) => (
        <div key={i} className="flex items-center gap-2">
          <Skeleton className="h-2 w-2 rounded-full shrink-0" />
          <Skeleton className={`h-2.5`} style={{ width: w }} />
        </div>
      ))}
    </div>
  </div>
);

// ── Empty ─────────────────────────────────────────────────────────────────────

const EmptyChart = ({ height }: { height: number }) => (
  <div
    style={{ height }}
    className="flex items-center justify-center text-xs text-slate-400 dark:text-slate-500"
  >
    No data available
  </div>
);

// ── Tooltip ───────────────────────────────────────────────────────────────────

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d: DoctypeDatum = payload[0].payload;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 px-3 py-2 shadow-md text-xs space-y-0.5">
      <p className="font-semibold text-slate-700 dark:text-slate-200">{label(d.doctype)}</p>
      <p className="text-slate-500 dark:text-slate-400">
        Count:{" "}
        <span className="font-semibold text-slate-800 dark:text-slate-100">{d.count}</span>
      </p>
    </div>
  );
};

// ── Main ──────────────────────────────────────────────────────────────────────

const DocumentTypeChart: React.FC<{
  data: DoctypeDatum[];
  height?: number;
  loading?: boolean;
}> = ({ data, height = 200, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} />;
  if (!data?.length) return <EmptyChart height={height} />;

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <div className="flex flex-col gap-3">
      {/* Chart + legend side by side */}
      <div className="flex items-center gap-4">
        {/* Donut */}
        <div className="relative shrink-0" style={{ width: height * 0.8, height: height * 0.8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="count"
                nameKey="doctype"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="74%"
                strokeWidth={2}
                stroke="transparent"
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.doctype} fill={color(d.doctype)} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-[20px] font-semibold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
              {total}
            </span>
            <span className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 leading-none">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-col gap-2 min-w-0">
          {data.map((d) => {
            const pct = total ? Math.round((d.count / total) * 100) : 0;
            return (
              <div key={d.doctype} className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: color(d.doctype) }}
                />
                <span className="text-xs text-slate-600 dark:text-slate-300 truncate">
                  {label(d.doctype)}
                </span>
                <span className="ml-auto text-xs font-semibold tabular-nums text-slate-700 dark:text-slate-200 shrink-0">
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Count row */}
      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
        {data.map((d) => (
          <div
            key={d.doctype}
            className="rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 px-2 py-1.5 text-center"
          >
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
              {d.count}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">{label(d.doctype)}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DocumentTypeChart;
