import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
} from "recharts";

type Props = {
  byPhase?: Record<string, number>;
  height?: number;
  loading?: boolean;
};

import { ChartSkeleton } from "../ui/loader/ChartSkeleton";

const PHASES = [
  { key: "draft", label: "Draft", color: "var(--color-neutral-400)" },
  { key: "review", label: "Review", color: "var(--color-brand-400)" },
  { key: "approval", label: "Approval", color: "var(--color-brand-600)" },
  { key: "finalization", label: "Finalization", color: "var(--color-neutral-600)" },
  { key: "distributed", label: "Distributed", color: "var(--color-brand-500)" },
];

const AdminDocumentPhaseChart: React.FC<Props> = ({ byPhase, height = 180, loading = false }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) return <ChartSkeleton type="bar-horizontal" height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full" />;

  const data = PHASES.map((p) => ({
    label: p.label,
    count: byPhase?.[p.key] ?? 0,
    color: p.color,
  }));

  const allZero = data.every((d) => d.count === 0);

  if (allZero) {
    return (
      <div style={{ height }} className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 dark:border-surface-400 bg-neutral-50/50 dark:bg-surface-600/30 text-neutral-400 dark:text-neutral-500">
        <span className="text-xs font-medium uppercase tracking-wider">No documents yet</span>
      </div>
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
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-400)" strokeOpacity={0.1} horizontal={false} />
          <XAxis
            type="number"
            allowDecimals={false}
            tick={{ fontSize: 10, fill: "var(--color-neutral-400)", fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            width={82}
            tick={{ fontSize: 10, fill: "var(--color-neutral-500)", fontWeight: 600, style: { textTransform: 'uppercase', letterSpacing: '0.05em' } }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "rgba(var(--color-neutral-900), 0.04)" }}
            content={({ active, payload, label }: any) => {
              if (!active || !payload?.length) return null;
              return (
                <div className="rounded-lg border border-neutral-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-3 py-2 shadow-xl shadow-neutral-900/5 text-xs">
                  <p className="font-bold text-neutral-900 dark:text-neutral-50 mb-0.5 uppercase tracking-tight">{label}</p>
                  <p className="text-neutral-500 dark:text-neutral-400 font-medium">
                    <span className="font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">{payload[0].value}</span> documents
                  </p>
                </div>
              );
            }}
          />
          <Bar dataKey="count" radius={[0, 2, 2, 0]} maxBarSize={16}>
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
