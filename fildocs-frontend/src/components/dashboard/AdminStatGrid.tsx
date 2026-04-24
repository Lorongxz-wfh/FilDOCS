import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { AdminDashboardStats } from "../../services/documents";
import { Users, FileText, Activity } from "lucide-react";

type Props = { data: AdminDashboardStats | null; loading: boolean };

const AdminStatGrid: React.FC<Props> = ({ data, loading }) => {
  const [pulseIndices, setPulseIndices] = React.useState<Set<number>>(new Set());
  const prevValues = React.useRef<(number | null)[]>([]);

  const items = [
    {
      label: "Total users",
      value: data?.users.total ?? 0,
      sub: `${data?.users.active ?? 0} active · ${data?.users.online ?? 0} online now`,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Total workflows",
      value: data?.documents.total_all_time ?? 0,
      sub: "all-time documents",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "Pending workflows",
      value: data?.documents.in_progress ?? 0,
      sub: "active cycles",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Open requests",
      value: data?.requests?.open ?? 0,
      sub: "pending evidence",
      icon: <Activity className="h-4 w-4" />,
    },
  ];

  // Pulse effect on value change
  React.useEffect(() => {
    const currentValues = items.map(i => i.value);
    const indicesToPulse = new Set<number>();

    currentValues.forEach((val, idx) => {
      const prev = prevValues.current[idx];
      if (prev !== undefined && prev !== null && prev !== val) {
        indicesToPulse.add(idx);
      }
    });

    if (indicesToPulse.size > 0) {
      setPulseIndices(indicesToPulse);
      const timer = setTimeout(() => setPulseIndices(new Set()), 300);
      return () => clearTimeout(timer);
    }

    prevValues.current = currentValues;
  }, [data]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((item, idx) => {
        const isPulsing = pulseIndices.has(idx);
        return (
          <div
            key={item.label}
            className={`rounded-lg border border-neutral-200/60 bg-white p-2.5 sm:px-4 sm:py-3.5 dark:border-surface-400 dark:bg-surface-500 flex flex-col justify-between transition-all ${isPulsing ? "animate-pulse-highlight ring-1 ring-brand-500/10" : ""}`}
          >
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] sm:text-[11px] text-neutral-500 dark:text-neutral-400 font-semibold uppercase tracking-widest leading-none truncate">
                {item.label}
              </p>
              <span className="text-neutral-400 dark:text-neutral-500 sm:scale-110 scale-90 shrink-0">
                {item.icon}
              </span>
            </div>

            <div className="mt-1.5 sm:mt-3">
              {loading && !data ? (
                <Skeleton className="h-5 sm:h-7 w-12 sm:w-14" />
              ) : (
                <p className={`text-lg sm:text-2xl font-display font-semibold leading-none text-neutral-900 dark:text-neutral-50 tabular-nums transition-all ${isPulsing ? "scale-105 text-brand-600 dark:text-brand-400" : "scale-100"}`}>
                  {item.value}
                </p>
              )}
            </div>

            <div className="hidden sm:block mt-1.5 text-[11px] text-neutral-400 dark:text-neutral-500 truncate leading-tight italic font-medium">
              {(() => {
                if (item.label === "Total users" && data?.users.online && data.users.online > 0) {
                  return (
                    <span>
                      {data.users.active} active · <span className="text-emerald-500 font-semibold">{data.users.online} online now</span>
                    </span>
                  );
                }
                if (item.label === "Total workflows" && data?.documents.distributed && data.documents.distributed > 0) {
                  return (
                    <span className="text-brand-500 font-semibold">
                      {data.documents.distributed} distributed
                    </span>
                  );
                }
                return item.sub;
              })()}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AdminStatGrid;
