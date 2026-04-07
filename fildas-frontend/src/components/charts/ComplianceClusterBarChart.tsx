import React from "react";
import { BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

export type ComplianceClusterDatum = {
  cluster: string; // e.g. "VAd", "VA", "VF", "VR", "PO"
  in_review: number; // reached office head OR VP review
  sent_to_qa: number; // reached QA approval step
  approved: number; // distributed
  returned: number; // returned-for-edit count
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-slate-700 dark:text-slate-200 mb-1.5">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: p.fill ?? p.color }} />
          <span className="text-slate-500 dark:text-slate-400">{p.name}</span>
          <span className="ml-auto font-semibold text-slate-800 dark:text-slate-100 pl-3">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const EmptyChart = ({ height = 280 }: { height?: number }) => (
  <div
    className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-surface-300 bg-slate-50/50 dark:bg-surface-600/30 text-slate-400 dark:text-slate-500"
    style={{ height }}
  >
    <BarChart2 className="h-5 w-5 opacity-40" />
    <span className="text-xs font-medium">No data available</span>
  </div>
);

const ChartSkeleton = ({ height = 280 }: { height?: number }) => (
  <div style={{ height }} className="flex items-end gap-4 px-4 pb-5 pt-2">
    {[65, 80, 45, 70, 55].map((h, i) => (
      <div key={i} className="flex-1 flex gap-0.5 items-end">
        {[h, h * 0.7, h * 0.5, h * 0.3].map((bh, j) => (
          <div key={j} className="flex-1 animate-pulse rounded-t-sm bg-slate-100 dark:bg-surface-400" style={{ height: `${bh}%` }} />
        ))}
      </div>
    ))}
  </div>
);

export default function ComplianceClusterBarChart(props: {
  data: ComplianceClusterDatum[];
  height?: number;
  loading?: boolean;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const height = props.height ?? 280;
  if (props.loading) return <ChartSkeleton height={height} />;
  if (!mounted) return <div style={{ height }} className="w-full h-full" />;
  if (!props.data?.length) return <EmptyChart height={height} />;

  return (
    <div style={{ width: "100%", height: "100%", minHeight: height, minWidth: 0 }}>
      <ResponsiveContainer width="100%" height={height} debounce={1}>
        <BarChart
          data={props.data}
          margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
          <XAxis dataKey="cluster" tick={{ fontSize: 11, fontWeight: 500 }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fontWeight: 500 }} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(148,163,184,0.07)" }} />
          <Legend 
            verticalAlign="bottom" 
            align="center"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, fontWeight: 500, paddingTop: 15 }}
          />
          <Bar dataKey="in_review" fill="#0ea5e9" name="In review" radius={[3, 3, 0, 0] as any} />
          <Bar dataKey="sent_to_qa" fill="#a855f7" name="Sent to QA" radius={[3, 3, 0, 0] as any} />
          <Bar dataKey="approved" fill="#10b981" name="Final approved" radius={[3, 3, 0, 0] as any} />
          <Bar dataKey="returned" fill="#f43f5e" name="Returned" radius={[3, 3, 0, 0] as any} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
