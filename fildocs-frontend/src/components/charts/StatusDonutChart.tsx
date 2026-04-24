import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartSkeleton } from "../ui/loader/ChartSkeleton";
import Skeleton from "../ui/loader/Skeleton";

type Segment = {
  label: string;
  value: number;
  color: string;
};

type Props = {
  segments: Segment[];
  centerLabel?: string;
  centerValue?: string | number;
  size?: number;
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border border-neutral-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-3 py-2 shadow-xl shadow-neutral-900/5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.payload.color }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{entry.name}</span>
        <span className="text-xs font-bold text-neutral-900 dark:text-neutral-50 pl-2 tabular-nums">{entry.value}</span>
      </div>
    </div>
  );
};

type FullProps = Props & { loading?: boolean };

const StatusDonutChart: React.FC<FullProps> = ({
  segments,
  centerLabel,
  centerValue,
  size = 160,
  loading = false,
}) => {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <div style={{ width: size, height: size }} className="shrink-0">
          <ChartSkeleton type="donut" height={size} showTitle={false} showLegend={false} />
        </div>
        <div className="flex-1 space-y-3.5">
          {[70, 55, 40].map((w, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-2.5 rounded" style={{ width: `${w}%` }} />
              <Skeleton className="h-1 w-full rounded-full opacity-40" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (!mounted) return <div style={{ width: size, height: size }} />;

  const total = segments.reduce((s, x) => s + x.value, 0);
  const data = segments.filter((s) => s.value > 0);
  const displayData = data.length ? data : [{ label: "Empty", value: 1, color: "#f5f5f5" }];

  return (
    <div className="flex-1 flex items-center gap-6">
      {/* Donut */}
      <div style={{ width: size, height: size, minWidth: 0 }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%" debounce={100}>
          <PieChart>
            <Pie
              data={displayData}
              cx="50%"
              cy="50%"
              innerRadius="64%"
              outerRadius="86%"
              dataKey="value"
              paddingAngle={data.length > 1 ? 2 : 0}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
            >
              {displayData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {centerValue !== undefined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold font-display tracking-tight leading-none text-neutral-900 dark:text-neutral-50 tabular-nums">
              {centerValue}
            </span>
            {centerLabel && (
              <span className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-neutral-400 dark:text-neutral-500">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex-1 min-w-0 space-y-2">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="group">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="h-2 w-2 shrink-0 rounded-full border border-black/5 dark:border-white/10 shadow-sm" style={{ backgroundColor: s.color }} />
                  <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 truncate tracking-tight">{s.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] font-bold text-neutral-900 dark:text-neutral-200 tabular-nums">{s.value}</span>
                  <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 w-8 text-right font-mono">{pct}%</span>
                </div>
              </div>
              <div className="h-0.5 w-full rounded-full bg-neutral-100 dark:bg-surface-400 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: s.color, opacity: 0.85 }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusDonutChart;
