import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import ChartSkeleton from "../ui/loader/ChartSkeleton";

type Props = { active: number; inactive: number; loading?: boolean; height?: number };

const COLORS = ["#10b981", "#94a3b8"];

const AdminUsersByRoleChart: React.FC<Props> = ({ active, inactive, loading = false, height = 220 }) => {
  if (loading) return <ChartSkeleton height={height} />;

  const total = active + inactive;

  if (total === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
         <p className="text-xs text-slate-400 dark:text-slate-500">No user data</p>
      </div>
    );
  }

  const data = [
    { name: "Enabled", value: active },
    { name: "Disabled", value: inactive },
  ];

  const pct = Math.round((active / total) * 100);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6" style={{ height }}>
      {/* Donut Container */}
      <div className="relative shrink-0 flex items-center justify-center h-full aspect-square max-h-full">
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="75%"
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} className="hover:opacity-80 transition-opacity" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              formatter={(v) => [v ?? 0, "Users"]}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center label with focus animation */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-75 duration-500">
          <span className="text-2xl font-bold font-display leading-none text-slate-900 dark:text-slate-100">
            {total}
          </span>
          <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            TOTAL
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 px-2">
        <div className="flex items-center gap-3 group">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 truncate">
              {active}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
              Enabled Accounts · {pct}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 group">
          <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500 group-hover:scale-125 transition-transform" />
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100 truncate">
              {inactive}
            </p>
            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate uppercase tracking-tight">
              Disabled Accounts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersByRoleChart;
