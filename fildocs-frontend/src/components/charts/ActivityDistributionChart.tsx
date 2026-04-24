import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { ActivityDistributionDatum } from "../../services/types";
import { BarChart2 } from "lucide-react";
import { ChartSkeleton } from "../ui/loader/ChartSkeleton";

const CATEGORY_COLORS: Record<string, string> = {
  Workflows: "var(--color-brand-500)",
  Access: "var(--color-neutral-400)",
  System: "var(--color-neutral-600)",
  Others: "var(--color-neutral-200)",
};

const fallbackColor = "var(--color-neutral-200)";

const EmptyChart = ({ height = 220 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-200 dark:border-surface-400 bg-neutral-50/50 dark:bg-surface-600/30 text-neutral-400 dark:text-neutral-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-medium uppercase tracking-wider">No activity data</span>
  </div>
);

const CustomTooltip = ({ active, payload, total }: any) => {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const percentage = total ? Math.round((value / total) * 100) : 0;

  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-3 py-2 shadow-xl shadow-neutral-900/5 text-xs">
      <p className="font-bold text-neutral-900 dark:text-neutral-50 mb-0.5 uppercase tracking-tight">
        {name}
      </p>
      <p className="text-neutral-500 dark:text-neutral-400 font-medium">
        <span className="font-bold text-neutral-900 dark:text-neutral-50 tabular-nums">{value}</span> actions &middot; <span className="font-mono">{percentage}%</span>
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
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) return <ChartSkeleton type="donut" height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full h-full" />;

  if (!data || data.length === 0 || data.every(d => d.count === 0)) {
    return <EmptyChart height={height} />;
  }

  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <div style={{ height, minHeight: height, minWidth: 0, display: "block" }} className="w-full relative">
      <ResponsiveContainer width="100%" height="100%" debounce={100}>
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
            iconSize={6}
            wrapperStyle={{ fontSize: 10, paddingTop: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Center total count */}
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center leading-none"
        style={{ top: "40%" }}
      >
        <span className="text-2xl font-bold font-display tabular-nums text-neutral-900 dark:text-neutral-50 leading-none tracking-tight">
          {total}
        </span>
        <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500 leading-none">
          Total
        </span>
      </div>
    </div>
  );
};

export default ActivityDistributionChart;
