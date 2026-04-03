import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

type Props = {
  byPhase?: Record<string, number>;
  height?: number;
  loading?: boolean;
};

import Skeleton from "../ui/loader/Skeleton";

const ChartSkeleton = ({ height = 180 }: { height?: number }) => (
  <div style={{ height }} className="flex flex-col justify-center gap-4 px-4 py-3">
    {[80, 55, 65, 40, 70].map((w, i) => (
      <div key={i} className="flex items-center gap-3">
        <Skeleton className="w-20 h-2.5 shrink-0 opacity-40" />
        <Skeleton className="rounded-r-sm h-4 flex-1" style={{ maxWidth: `${w}%` }} />
      </div>
    ))}
  </div>
);

const PHASES = [
  { key: "draft",        label: "Draft",        color: "#94a3b8" },
  { key: "review",       label: "Review",        color: "#f59e0b" },
  { key: "approval",     label: "Approval",      color: "#6366f1" },
  { key: "finalization", label: "Finalization",  color: "#8b5cf6" },
  { key: "distributed",  label: "Distributed",   color: "#10b981" },
];

const AdminDocumentPhaseChart: React.FC<Props> = ({ byPhase, height = 180, loading = false }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) return <ChartSkeleton height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full" />;

  const data = PHASES.map((p) => ({
    label: p.label,
    count: byPhase?.[p.key] ?? 0,
    color: p.color,
  }));

  const allZero = data.every((d) => d.count === 0);

  if (allZero) {
    return (
      <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
        No documents yet
      </p>
    );
  }

  return (
    <div style={{ height, minHeight: height, minWidth: 0, display: "block" }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 0, right: 32, left: 0, bottom: 0 }}
        >
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={82}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(148,163,184,0.08)" }}
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
                  <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">{label}</p>
                  <p className="text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-100">{payload[0].value}</span> documents
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminDocumentPhaseChart;
