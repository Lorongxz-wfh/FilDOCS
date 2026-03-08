import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type Props = { data: { role: string; count: number }[] };

const ROLE_COLORS: Record<string, string> = {
  qa: "#6366f1",
  admin: "#f43f5e",
  president: "#f59e0b",
  vp: "#0ea5e9",
  office_head: "#10b981",
  office_staff: "#8b5cf6",
  auditor: "#94a3b8",
  sysadmin: "#ec4899",
};

const ROLE_LABELS: Record<string, string> = {
  qa: "QA",
  admin: "Admin",
  president: "President",
  vp: "VP",
  office_head: "Office Head",
  office_staff: "Office Staff",
  auditor: "Auditor",
  sysadmin: "Sysadmin",
};

const AdminUsersByRoleChart: React.FC<Props> = ({ data }) => {
  const total = data.reduce((s, x) => s + x.count, 0);
  return (
    <div className="flex items-center gap-4">
      <div style={{ width: 140, height: 140 }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="58%"
              outerRadius="85%"
              dataKey="count"
              paddingAngle={3}
              strokeWidth={0}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.role}
                  fill={ROLE_COLORS[entry.role] ?? "#94a3b8"}
                />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {total}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-wide">
            users
          </span>
        </div>
      </div>
      <div className="space-y-1.5 min-w-0 flex-1">
        {data.map((entry) => (
          <div key={entry.role} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: ROLE_COLORS[entry.role] ?? "#94a3b8" }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {ROLE_LABELS[entry.role] ?? entry.role}
            </span>
            <span className="ml-auto text-xs font-semibold text-slate-900 dark:text-slate-100">
              {entry.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminUsersByRoleChart;
