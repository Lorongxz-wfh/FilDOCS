import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { ChartSkeleton } from "../ui/loader/ChartSkeleton";

type Props = { active: number; inactive: number; loading?: boolean; height?: number };

const COLORS = ["#10b981", "#cbd5e1"];

const AdminUsersByRoleChart: React.FC<Props> = ({ active, inactive, loading = false, height = 220 }) => {
  if (loading) return <ChartSkeleton type="donut" height={height} />;

  const total = active + inactive;

  if (total === 0) {
    return (
      <div style={{ height }} className="flex items-center justify-center">
         <p className="text-xs text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">No user data</p>
      </div>
    );
  }

  const data = [
    { name: "Enabled", value: active },
    { name: "Disabled", value: inactive },
  ];

  const pct = Math.round((active / total) * 100);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6" style={{ height }}>
      {/* Donut Container */}
      <div className="relative shrink-0 flex items-center justify-center h-full aspect-square max-h-full">
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="65%"
              outerRadius="85%"
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} className="hover:opacity-80 transition-opacity cursor-pointer" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ 
                borderRadius: 6, 
                fontSize: 12, 
                border: '1px solid rgba(148,163,184,0.2)',
                backgroundColor: 'rgba(255,255,255,0.95)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
                padding: '8px 12px'
              }}
              itemStyle={{ fontWeight: 700, color: '#1e293b' }}
              formatter={(v) => [v ?? 0, "Users"]}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Center label with focus animation */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center animate-in fade-in zoom-in-95 duration-500">
          <span className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
            {total}
          </span>
          <span className="mt-1.5 text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Accounts
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 px-2">
        <div className="flex items-center gap-3 group">
          <div className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 group-hover:scale-125 transition-transform" />
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100 truncate leading-none">
              {active}
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight mt-1">
              Active · {pct}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 group">
          <div className="h-2 w-2 shrink-0 rounded-full bg-slate-300 dark:bg-slate-500 group-hover:scale-125 transition-transform" />
          <div className="min-w-0">
            <p className="text-sm font-bold tabular-nums text-slate-800 dark:text-slate-100 truncate leading-none">
              {inactive}
            </p>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight mt-1">
              Disabled
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersByRoleChart;
