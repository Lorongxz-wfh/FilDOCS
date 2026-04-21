import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import { Bell, FileText, Clock, Inbox } from "lucide-react";
import { Card, CardBody } from "../ui/Card";

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
  pendingCount: number;
  pendingWorkflowsCount: number;
  openRequestsCount: number;
  allTimeWorkflowsCount: number;
  allTimeRequestsCount: number;
  loading: boolean;
  onStatClick?: (label: string) => void;
};

const DashboardStatRow: React.FC<Props> = ({
  pendingCount,
  pendingWorkflowsCount,
  openRequestsCount,
  allTimeWorkflowsCount,
  allTimeRequestsCount,
  loading,
  onStatClick,
}) => {
  const [pulseIndices, setPulseIndices] = React.useState<Set<number>>(new Set());
  const prevValues = React.useRef<(number | null)[]>([]);

  const items = React.useMemo(() => {
    const kpis: StatItem[] = [
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
        label: "Pending workflows",
        value: pendingWorkflowsCount,
        icon: <Clock className="h-4 w-4" />,
        iconColor: "text-slate-400 dark:text-slate-500",
        valueColor: "text-slate-900 dark:text-slate-100",
        sub: "active cycles",
        onClick: () => onStatClick?.("In progress"),
      },
      {
        label: "Open requests",
        value: openRequestsCount,
        icon: <Inbox className="h-4 w-4" />,
        iconColor: "text-sky-400 dark:text-sky-400",
        valueColor: "text-slate-900 dark:text-slate-100",
        sub: "pending evidence",
        onClick: () => onStatClick?.("Pending requests"),
      },
      {
        label: "Total workflows",
        value: allTimeWorkflowsCount,
        icon: <FileText className="h-4 w-4" />,
        iconColor: "text-slate-400 dark:text-slate-500",
        valueColor: "text-slate-900 dark:text-slate-100",
        sub: "all-time documents",
        onClick: () => onStatClick?.("Total documents"),
      },
      {
        label: "Total requests",
        value: allTimeRequestsCount,
        icon: <Inbox className="h-4 w-4" />,
        iconColor: "text-slate-400 dark:text-slate-500",
        valueColor: "text-slate-900 dark:text-slate-100",
        sub: "all-time batches",
        onClick: () => onStatClick?.("Total requests"),
      },
    ];

    return kpis;
  }, [pendingCount, pendingWorkflowsCount, openRequestsCount, allTimeWorkflowsCount, allTimeRequestsCount, onStatClick]);

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
      const timer = setTimeout(() => setPulseIndices(new Set()), 1500);
      return () => clearTimeout(timer);
    }

    prevValues.current = currentValues;
  }, [items]);

  return (
    <div className="grid gap-2 sm:gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
      {items.map((item, idx) => {
        const isActionNeeded = item.label === "Action needed";
        const isLastAndNeedsSpan = (idx === items.length - 1) && (items.length % 2 === 0);
        const mobileColSpan = (isActionNeeded || isLastAndNeedsSpan) ? "col-span-2" : "col-span-1";
        const isPulsing = pulseIndices.has(idx);

        return (
          <Card
            key={item.label}
            onClick={item.onClick}
            className={`
              transition-all duration-200 min-h-0 ${mobileColSpan} sm:col-span-1
              ${isActionNeeded && item.value > 0 ? "ring-1 ring-rose-500/20 bg-rose-50/15 dark:ring-rose-500/40 dark:bg-rose-500/5 border-rose-200 dark:border-rose-900/50" : ""}
              ${isPulsing ? "animate-pulse-highlight ring-emerald-500/30" : ""}
            `}
          >
            <CardBody className="h-full justify-between gap-1 py-2 sm:py-2.5 px-3 sm:px-4">
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 ${item.iconColor} sm:scale-110`}>{item.icon}</span>
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
                    {item.label}
                  </p>
                </div>

                <div className="flex items-center">
                  {loading ? (
                    <Skeleton className="h-6 w-10 sm:h-8 sm:w-16" />
                  ) : (
                    <p className={`text-xl sm:text-3xl font-semibold tabular-nums leading-none transition-transform duration-300 ${item.valueColor} ${isPulsing ? "scale-110" : "scale-100"}`}>
                      {item.value}
                    </p>
                  )}
                </div>
              </div>

            </CardBody>
          </Card>
        );
      })}
    </div>
  );
};

export default DashboardStatRow;
