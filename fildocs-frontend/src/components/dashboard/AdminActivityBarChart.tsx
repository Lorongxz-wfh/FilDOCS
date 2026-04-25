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
        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid vertical={false} strokeDasharray="0" stroke="rgba(148,163,184,0.1)" />
          <XAxis 
            dataKey="label" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
            dy={10}
          />
          <YAxis 
            allowDecimals={false} 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} 
          />
          <Tooltip 
            cursor={{ fill: 'rgba(148,163,184,0.05)' }}
            contentStyle={{ 
              borderRadius: 6, 
              fontSize: 12, 
              border: '1px solid rgba(148,163,184,0.2)',
              backgroundColor: 'rgba(255,255,255,0.95)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              padding: '8px 12px'
            }} 
            itemStyle={{ fontWeight: 700, color: '#1e293b' }}
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} barSize={24}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === data.length - 1 ? "#6366f1" : "#e2e8f0"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default AdminActivityBarChart;
