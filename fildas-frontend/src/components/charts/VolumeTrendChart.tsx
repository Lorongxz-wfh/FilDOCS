import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export type VolumeSeries = {
  label: string;
  created: number;
  approved_final: number;
};

const VolumeTrendChart: React.FC<{ data: VolumeSeries[]; height?: number }> = ({
  data,
  height = 200,
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
      <Legend wrapperStyle={{ fontSize: 12 }} />
      <Line
        type="monotone"
        dataKey="created"
        stroke="#6366f1"
        strokeWidth={2}
        dot={{ r: 3 }}
        name="Created"
      />
      <Line
        type="monotone"
        dataKey="approved_final"
        stroke="#10b981"
        strokeWidth={2}
        dot={{ r: 3 }}
        name="Approved"
      />
    </LineChart>
  </ResponsiveContainer>
);

export default VolumeTrendChart;
