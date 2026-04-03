import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
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
    <div className="rounded-lg border border-slate-200 bg-white dark:border-surface-300 dark:bg-surface-500 px-3 py-2 shadow-md">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.payload.color }} />
        <span className="text-xs text-slate-600 dark:text-slate-300">{entry.name}</span>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 pl-2">{entry.value}</span>
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
        <Skeleton
          className="shrink-0 rounded-full"
          style={{ width: size, height: size }}
        />
        <div className="flex-1 space-y-3">
          {[70, 55, 40].map((w, i) => (
            <div key={i} className="space-y-1.5">
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
  const displayData = data.length ? data : [{ label: "Empty", value: 1, color: "#e2e8f0" }];

  return (
    <div className="flex items-center gap-6">
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
            <span className="text-2xl font-bold leading-none text-slate-900 dark:text-slate-100">
              {centerValue}
            </span>
            {centerLabel && (
              <span className="mt-1 text-[10px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {segments.map((s) => {
          const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
          return (
            <div key={s.label} className="group">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">{s.value}</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 w-7 text-right">{pct}%</span>
                </div>
              </div>
              <div className="h-0.5 w-full rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, backgroundColor: s.color, opacity: 0.7 }}
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
