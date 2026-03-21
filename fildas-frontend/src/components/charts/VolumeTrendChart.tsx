import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
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

const VolumeTrendChart: React.FC<{ data: VolumeSeries[]; height?: number }> = ({
  data,
  height = 200,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart
      data={data}
      margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
      barCategoryGap="40%"
      barGap={3}
    >
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fontSize: 11, fill: "currentColor" }}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        allowDecimals={false}
        tick={{ fontSize: 11, fill: "currentColor" }}
        axisLine={false}
        tickLine={false}
      />
      <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.07)" }} />
      <Bar dataKey="created" name="Created" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
      <Bar dataKey="approved_final" name="Approved" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={32} />
    </BarChart>
  </ResponsiveContainer>
);

export default VolumeTrendChart;
