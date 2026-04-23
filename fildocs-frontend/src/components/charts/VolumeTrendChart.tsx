import React from "react";
import { BarChart2 } from "lucide-react";
import ChartSkeleton from "../ui/loader/ChartSkeleton";

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
          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" strokeOpacity={0.15} vertical={false} />
          <XAxis
            dataKey="label"
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.07)" }} />
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
              color: '#94a3b8' 
            }}
          />
          <Bar dataKey="created" name="Created" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
          <Bar dataKey="approved_final" name="Approved" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VolumeTrendChart;
