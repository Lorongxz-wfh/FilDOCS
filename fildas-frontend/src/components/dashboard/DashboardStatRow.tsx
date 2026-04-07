import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { DocumentStats } from "../../services/documents";
import { isQA, type UserRole } from "../../lib/roleFilters";
import { Bell, FileText, Clock, CheckCircle2, Inbox } from "lucide-react";

type StatItem = {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
  valueColor: string;
  sub?: string;
  onClick?: () => void;
};

type Props = {
  role: UserRole;
  stats: DocumentStats | null;
  pendingCount: number;
  pendingRequestsCount: number;
  loading: boolean;
  onStatClick?: (label: string) => void;
};

const DashboardStatRow: React.FC<Props> = ({
  role,
  stats,
  pendingCount,
  pendingRequestsCount,
  loading,
  onStatClick,
}) => {
  const [pulseIndices, setPulseIndices] = React.useState<Set<number>>(new Set());
  const prevValues = React.useRef<(number | null)[]>([]);

  const qaItems: StatItem[] = [
    {
      label: "Action needed",
      value: pendingCount,
      icon: <Bell className="h-4 w-4" />,
      iconColor: "text-rose-400 dark:text-rose-400",
      valueColor:
        pendingCount > 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-900 dark:text-slate-100",
      sub: pendingCount === 1 ? "task waiting" : "tasks waiting",
      onClick: () => onStatClick?.("Action needed"),
    },
    {
      label: "Total documents",
      value: stats?.total ?? 0,
      icon: <FileText className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "in system",
      onClick: () => onStatClick?.("Total documents"),
    },
    {
      label: "In progress",
      value: stats?.pending ?? 0,
      icon: <Clock className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "active workflows",
      onClick: () => onStatClick?.("In progress"),
    },
    {
      label: "Distributed",
      value: stats?.distributed ?? 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "official versions",
      onClick: () => onStatClick?.("Distributed"),
    },
    {
      label: "Pending requests",
      value: pendingRequestsCount,
      icon: <Inbox className="h-4 w-4" />,
      iconColor: "text-sky-400 dark:text-sky-400",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "open doc requests",
      onClick: () => onStatClick?.("Pending requests"),
    },
  ];

  const officeItems: StatItem[] = [
    {
      label: "Action needed",
      value: pendingCount,
      icon: <Bell className="h-4 w-4" />,
      iconColor: "text-rose-400 dark:text-rose-400",
      valueColor:
        pendingCount > 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-900 dark:text-slate-100",
      sub: pendingCount === 1 ? "task waiting" : "tasks waiting",
      onClick: () => onStatClick?.("Action needed"),
    },
    {
      label: "My documents",
      value: stats?.total ?? 0,
      icon: <FileText className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "in system",
      onClick: () => onStatClick?.("My documents"),
    },
    {
      label: "In progress",
      value: stats?.pending ?? 0,
      icon: <Clock className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "active workflows",
      onClick: () => onStatClick?.("In progress"),
    },
    {
      label: "Distributed",
      value: stats?.distributed ?? 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "official versions",
      onClick: () => onStatClick?.("Distributed"),
    },
    {
      label: "Pending requests",
      value: pendingRequestsCount,
      icon: <Inbox className="h-4 w-4" />,
      iconColor: "text-sky-400 dark:text-sky-400",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "open doc requests",
      onClick: () => onStatClick?.("Pending requests"),
    },
  ];

  const items = isQA(role) ? qaItems : officeItems;

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
  }, [items]);

  return (
    <div
      className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
    >
      {items.map((item, idx) => {
        const isActionNeeded = item.label === "Action needed";
        const isLastAndNeedsSpan = (idx === items.length - 1) && (items.length % 2 === 0);
        const mobileColSpan = (isActionNeeded || isLastAndNeedsSpan) ? "col-span-2" : "col-span-1";
        const clickable = !!item.onClick;
        const isPulsing = pulseIndices.has(idx);

        return (
          <div
            key={item.label}
            className={`min-w-0 rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 transition-all ${mobileColSpan} sm:col-span-1 ${
              clickable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-400" : ""
            } ${
              isActionNeeded && item.value > 0 
                ? "ring-1 ring-rose-500/20 bg-rose-50/15 dark:ring-rose-500/40 dark:bg-rose-500/5 p-2.5 sm:p-3.5" 
                : "p-2 sm:p-3.5"
            } ${isPulsing ? "animate-pulse-highlight" : ""}`}
          >
            {/* Action Needed - Horizontal Banner for Mobile, Vertical for Desktop */}
            {isActionNeeded ? (
              <div className="flex flex-col h-full">
                  <div className={`flex items-center justify-between sm:flex-col sm:items-start w-full h-full gap-2`}>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`shrink-0 ${item.iconColor} sm:scale-110 scale-100`}>
                        {item.icon}
                      </span>
                      <p className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
                        {item.label}
                      </p>
                    </div>
                    
                    {loading ? (
                      <Skeleton className="mt-1 h-6 w-10 sm:h-7 sm:w-14" />
                    ) : (
                      <p className={`text-xl sm:text-2xl font-display font-bold tabular-nums leading-none sm:mt-1.5 transition-all ${item.valueColor} ${isPulsing ? "scale-110" : "scale-100"}`}>
                        {item.value}
                      </p>
                    )}
                  </div>
                {item.sub && (
                  <p className={`hidden sm:block mt-2 text-[11px] text-slate-400 dark:text-slate-500 italic truncate transition-opacity duration-200 ${loading && stats ? "opacity-60" : "opacity-100"}`}>
                    {item.sub}
                  </p>
                )}
              </div>
            ) : (
              /* Secondary KPIs - Compact for Mobile */
              <div className="flex flex-col">
                <div className={`flex items-center justify-between sm:justify-start sm:flex-col sm:items-start gap-1 sm:gap-2`}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`shrink-0 ${item.iconColor} sm:scale-100 scale-90`}>{item.icon}</span>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
                      {item.label}
                    </p>
                  </div>

                  {loading ? (
                    <Skeleton className="mt-1 sm:mt-1.5 h-5 sm:h-7 w-10 sm:w-14" />
                  ) : (
                    <p className={`text-lg sm:text-2xl font-display font-bold tabular-nums leading-none sm:mt-1 transition-all ${item.valueColor} ${isPulsing ? "scale-110" : "scale-100"}`}>
                      {item.value || 0}
                    </p>
                  )}
                </div>

                <p className={`hidden sm:block mt-1.5 text-[11px] text-slate-400 dark:text-slate-500 italic truncate transition-opacity duration-200 ${loading && stats ? "opacity-60" : "opacity-100"}`}>
                  {item.sub}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default DashboardStatRow;
