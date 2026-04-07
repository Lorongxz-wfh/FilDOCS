import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Props = { active: number; inactive: number; loading?: boolean };

const COLORS = ["#10b981", "#94a3b8"];

const AdminUsersByRoleChart: React.FC<Props> = ({ active, inactive, loading = false }) => {
  if (loading) {
    return (
      <div className="flex items-center gap-6">
        <div className="h-24 w-24 shrink-0 animate-pulse rounded-full bg-slate-100 dark:bg-surface-400" />
        <div className="flex flex-col gap-3">
          {[60, 45].map((w, i) => (
            <div key={i} className="space-y-1">
              <div className="h-3.5 animate-pulse rounded bg-slate-100 dark:bg-surface-400" style={{ width: `${w}px` }} />
              <div className="h-2.5 animate-pulse rounded bg-slate-100 dark:bg-surface-400" style={{ width: `${w * 0.7}px` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }
  const total = active + inactive;

  if (total === 0) {
    return (
      <p className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
        No user data
      </p>
    );
  }

  const data = [
    { name: "Enabled", value: active },
    { name: "Disabled", value: inactive },
  ];

  const pct = Math.round((active / total) * 100);

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <div className="relative shrink-0" style={{ width: 100, height: 100, minWidth: 0 }}>
        <ResponsiveContainer width="100%" height="100%" debounce={1}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={32}
              outerRadius={46}
              dataKey="value"
              startAngle={90}
              endAngle={-270}
              strokeWidth={0}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
              formatter={(v) => [v ?? 0, ""]}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold font-display leading-none text-slate-900 dark:text-slate-100">
            {total}
          </span>
          <span className="mt-0.5 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            total
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 truncate">
              {active}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Enabled · {pct}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-slate-400 dark:bg-slate-500" />
          <div className="min-w-0">
            <p className="text-sm font-semibold tabular-nums text-slate-900 dark:text-slate-100 truncate">
              {inactive}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">Disabled</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsersByRoleChart;
