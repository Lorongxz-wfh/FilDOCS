import React from "react";
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
import type { ActivityTrendDatum } from "../../services/types";
import ChartSkeleton from "../ui/loader/ChartSkeleton";

const formatDate = (dateStr: string, options: Intl.DateTimeFormatOptions) => {
  try {
    return new Intl.DateTimeFormat('en-US', options).format(new Date(dateStr));
  } catch (e) {
    return dateStr;
  }
};

const CATEGORY_COLORS: Record<string, string> = {
  Workflows: "#6366f1", // indigo-500
  Access: "#f59e0b",    // amber-500
  System: "#10b981",    // emerald-500
  Others: "#94a3b8",    // slate-400
};



const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  try {
    const dateStr = formatDate(label, { month: 'short', day: 'numeric', year: 'numeric' });
    return (
      <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
        <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">{dateStr}</p>
        <div className="flex flex-col gap-1">
          {payload.map((entry: any) => (
            <div key={entry.name} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.fill }} />
                <span className="text-slate-600 dark:text-slate-400 font-medium">{entry.name}</span>
              </div>
              <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">{entry.value}</span>
            </div>
          ))}
          <div className="mt-1 border-t border-slate-100 dark:border-surface-400 pt-1 flex items-center justify-between gap-4">
            <span className="text-slate-500 font-medium">Total</span>
            <span className="tabular-nums font-semibold text-slate-900 dark:text-slate-100">
              {payload.reduce((sum: number, entry: any) => sum + entry.value, 0)}
            </span>
          </div>
        </div>
      </div>
    );
  } catch (e) {
    return null;
  }
};

interface Props {
  data: ActivityTrendDatum[];
  height?: number;
  loading?: boolean;
}

const DailyActivityStackedBarChart: React.FC<Props> = ({ data, height = 220, loading = false }) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) return <ChartSkeleton height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full h-full" />;

  // Label formatting for XAxis
  const formatDateLabel = (tick: string) => {
    return formatDate(tick, { month: 'short', day: 'numeric' });
  };

  return (
    <div style={{ height, minHeight: height, minWidth: 0, display: "block" }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          barCategoryGap="25%"
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.1)" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 10 }} 
            tickFormatter={formatDateLabel}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            allowDecimals={false} 
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.05)" }} />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 15 }}
          />
          <Bar name="Workflows" dataKey="Workflows" stackId="a" fill={CATEGORY_COLORS.Workflows} radius={[0, 0, 0, 0]} />
          <Bar name="Access" dataKey="Access" stackId="a" fill={CATEGORY_COLORS.Access} radius={[0, 0, 0, 0]} />
          <Bar name="System" dataKey="System" stackId="a" fill={CATEGORY_COLORS.System} radius={[0, 0, 0, 0]} />
          <Bar name="Others" dataKey="Others" stackId="a" fill={CATEGORY_COLORS.Others} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DailyActivityStackedBarChart;
