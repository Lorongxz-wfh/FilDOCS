import React from "react";
import { BarChart2 } from "lucide-react";
import { ChartSkeleton } from "../ui/loader/ChartSkeleton";

const EmptyChart = ({ height = 200 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 w-full rounded-lg border border-dashed border-neutral-200 dark:border-surface-400 bg-neutral-50/20 dark:bg-surface-600/10 text-neutral-400 dark:text-neutral-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-semibold uppercase tracking-widest opacity-60">No data available</span>
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
  Legend,
} from "recharts";

export type VolumeSeries = {
  label: string;
  created: number;
  approved_final: number;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-3 py-2 shadow-xl shadow-neutral-900/5 text-xs">
      <p className="font-bold text-neutral-900 dark:text-neutral-50 mb-1.5 uppercase tracking-tight">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mt-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">{p.name}</span>
          <span className="ml-auto font-bold text-neutral-900 dark:text-neutral-50 pl-3 tabular-nums">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const VolumeTrendChart: React.FC<{ data: VolumeSeries[]; height?: number; loading?: boolean }> = ({
  data,
  height = 200,
  loading = false,
}) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) return <ChartSkeleton height={height} type="bar" />;
  if (!data?.length) return <EmptyChart height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full" />;
  return (
    <div style={{ height, minWidth: 0 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={1}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 20 }}
          barCategoryGap="40%"
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-400)" strokeOpacity={0.1} vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fontWeight: 600, fill: "var(--color-neutral-400)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 10, fontWeight: 600, fill: "var(--color-neutral-400)" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(var(--color-neutral-900), 0.04)" }} />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            iconSize={6}
            wrapperStyle={{ 
              fontSize: 10, 
              fontWeight: 600, 
              paddingTop: 16,
              textTransform: 'uppercase', 
              letterSpacing: '0.05em',
              color: 'var(--color-neutral-400)' 
            }}
          />
          <Bar dataKey="created" name="Created" fill="var(--color-brand-400)" radius={[2, 2, 0, 0]} maxBarSize={28} />
          <Bar dataKey="approved_final" name="Approved" fill="var(--color-brand-600)" radius={[2, 2, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VolumeTrendChart;
