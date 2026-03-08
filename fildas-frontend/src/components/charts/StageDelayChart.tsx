import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  LabelList,
} from "recharts";

export type StageDelay = {
  stage: string;
  avg_hours: number;
  count: number;
  task_count: number;
};

const COLORS: Record<string, string> = {
  Office: "#6366f1",
  VP: "#f59e0b",
  QA: "#10b981",
  Registration: "#0ea5e9",
};

const StageDelayChart: React.FC<{ data: StageDelay[]; height?: number }> = ({
  data,
  height = 200,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <BarChart
      data={data}
      layout="vertical"
      margin={{ top: 4, right: 40, left: 20, bottom: 0 }}
    >
      <XAxis type="number" tick={{ fontSize: 11 }} unit="h" />
      <YAxis
        type="category"
        dataKey="stage"
        tick={{ fontSize: 11 }}
        width={80}
      />
      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
      <Bar dataKey="avg_hours" radius={[0, 4, 4, 0]}>
        <LabelList
          dataKey="avg_hours"
          position="right"
          formatter={(v: unknown) => {
            const n = v as number;
            return n > 0 ? `${n.toFixed(1)}h` : "—";
          }}
          style={{ fontSize: 11 }}
        />
        {data.map((entry) => (
          <Cell key={entry.stage} fill={COLORS[entry.stage] ?? "#94a3b8"} />
        ))}
      </Bar>
    </BarChart>
  </ResponsiveContainer>
);

export default StageDelayChart;
