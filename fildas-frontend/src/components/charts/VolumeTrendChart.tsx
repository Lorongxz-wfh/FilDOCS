import React from "react";
import { BarChart2 } from "lucide-react";
import Skeleton from "../ui/loader/Skeleton";

const ChartSkeleton = ({ height = 200 }: { height?: number }) => (
  <div style={{ height }} className="relative flex flex-col justify-end px-2 pt-2 animate-pulse">
    {/* Minimal Axis Lines */}
    <div className="absolute inset-x-0 top-[20%] border-t border-slate-100/50 dark:border-surface-400/20" />
    <div className="absolute inset-x-0 top-[50%] border-t border-slate-100/50 dark:border-surface-400/20" />
    <div className="absolute inset-x-0 top-[80%] border-t border-slate-100/50 dark:border-surface-400/20" />
    
    <div className="flex items-end gap-3 px-1 h-full pb-8">
      {[45, 70, 35, 90, 55, 80, 40, 65].map((h, i) => (
        <div key={i} className="flex-1 flex gap-1.5 items-end h-full">
          <Skeleton 
            className="flex-1 rounded-t-sm" 
            style={{ height: `${h}%` }} 
          />
          <Skeleton 
            className="flex-1 rounded-t-sm opacity-40" 
            style={{ height: `${h * 0.7}%` }} 
          />
        </div>
      ))}
    </div>

    {/* Legend Skeleton Area */}
    <div className="flex justify-center gap-6 pb-2">
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full" />
        <Skeleton className="h-2 w-12 rounded-sm" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-2 w-2 rounded-full opacity-60" />
        <Skeleton className="h-2 w-12 rounded-sm opacity-60" />
      </div>
    </div>
  </div>
);

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
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
          <span className="ml-auto font-semibold text-slate-800 dark:text-slate-100 pl-3">{p.value}</span>
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

  if (loading) return <ChartSkeleton height={height} />;
  if (!data?.length) return <EmptyChart height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full" />;
  return (
    <div style={{ height, minWidth: 0 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={1}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
          barCategoryGap="40%"
          barGap={3}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "currentColor" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.07)" }} />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 15 }}
          />
          <Bar dataKey="created" name="Created" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="approved_final" name="Approved" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VolumeTrendChart;
