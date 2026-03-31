import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ActivityDistributionDatum } from "../../services/types";
import { BarChart2 } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Workflows: "#6366f1", // indigo-500
  Access: "#f59e0b",    // amber-500
  System: "#10b981",    // emerald-500
  Others: "#94a3b8",    // slate-400
};

const fallbackColor = "#cbd5e1";

const EmptyChart = ({ height = 220 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-surface-300 bg-slate-50/50 dark:bg-surface-600/30 text-slate-400 dark:text-slate-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-medium">No activity data</span>
  </div>
);

const ChartSkeleton = ({ height = 220 }: { height?: number }) => (
  <div style={{ height }} className="flex items-center justify-center">
    <div className="h-32 w-32 animate-pulse rounded-full bg-slate-100 dark:bg-surface-400" />
  </div>
);

const CustomTooltip = ({ active, payload, total }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const percentage = total ? Math.round((value / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-0.5">
        {name}
      </p>
      <p className="text-slate-500 dark:text-slate-400">
        {value} actions &middot; {percentage}%
      </p>
    </div>
  );
};

interface Props {
  data: ActivityDistributionDatum[];
  height?: number;
  loading?: boolean;
}

const ActivityDistributionChart: React.FC<Props> = ({ data, height = 220, loading = false }) => {
  if (loading) return <ChartSkeleton height={height} />;
  if (!data || data.length === 0 || data.every(d => d.count === 0)) {
    return <EmptyChart height={height} />;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="relative" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            nameKey="label"
            dataKey="count"
            cx="50%"
            cy="45%"
            innerRadius="50%"
            outerRadius="70%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((entry) => (
              <Cell 
                key={entry.label} 
                fill={CATEGORY_COLORS[entry.label] || fallbackColor} 
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip total={total} />} />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, paddingTop: 10 }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center total count */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center leading-none"
        style={{ top: "40%" }}
      >
        <span className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
          {total}
        </span>
        <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500 leading-none">
          Total
        </span>
      </div>
    </div>
  );
};

export default ActivityDistributionChart;
