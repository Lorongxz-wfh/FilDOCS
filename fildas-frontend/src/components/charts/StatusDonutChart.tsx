import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

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

const StatusDonutChart: React.FC<Props> = ({
  segments,
  centerLabel,
  centerValue,
  size = 160,
}) => {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const data = segments.filter((s) => s.value > 0);

  return (
    <div className="flex items-center gap-6">
      <div style={{ width: size, height: size }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={
                data.length
                  ? data
                  : [{ label: "Empty", value: 1, color: "#e2e8f0" }]
              }
              cx="50%"
              cy="50%"
              innerRadius="62%"
              outerRadius="85%"
              dataKey="value"
              paddingAngle={data.length > 1 ? 3 : 0}
              strokeWidth={0}
            >
              {(data.length
                ? data
                : [{ label: "Empty", value: 1, color: "#e2e8f0" }]
              ).map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        {centerValue !== undefined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-none">
              {centerValue}
            </span>
            {centerLabel && (
              <span className="mt-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                {centerLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="space-y-2 min-w-0">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-xs text-slate-600 dark:text-slate-400 truncate">
              {s.label}
            </span>
            <span className="ml-auto text-xs font-semibold text-slate-900 dark:text-slate-100">
              {s.value}
            </span>
            {total > 0 && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 w-8 text-right">
                {Math.round((s.value / total) * 100)}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StatusDonutChart;
