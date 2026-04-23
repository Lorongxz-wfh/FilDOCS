import React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

import { ChartSkeleton } from "../ui/loader/ChartSkeleton";

type Props = { data: { label: string; count: number }[]; height?: number; loading?: boolean };

const AdminActivityBarChart: React.FC<Props> = ({ data, height = 180, loading = false }) => {
  if (loading) return <ChartSkeleton type="bar" height={height} />;
  return (
    <div style={{ height, minWidth: 0 }} className="w-full">
      <ResponsiveContainer width="100%" height="100%" debounce={1}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 500 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 500 }} />
          <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? "#6366f1" : "#c7d2fe"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminActivityBarChart;
