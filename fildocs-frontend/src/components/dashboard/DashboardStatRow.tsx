import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "../ui/loader/Skeleton";
import { Bell, FileText, Clock, Inbox } from "lucide-react";
import { Card, CardBody } from "../ui/Card";
import { TRANSITION_EASE_OUT } from "../../utils/animations";

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
  const prevValues = React.useRef<(number | null)[]>([]);
  const [highlightIndices, setHighlightIndices] = React.useState<Set<number>>(new Set());

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
        onClick: () => onStatClick?.("Pending workflows"),
      },
      {
        label: "Open requests",
        value: openRequestsCount,
        icon: <Inbox className="h-4 w-4" />,
        iconColor: "text-sky-400 dark:text-sky-400",
        valueColor: "text-slate-900 dark:text-slate-100",
        sub: "pending evidence",
        onClick: () => onStatClick?.("Open requests"),
      },
      {
        label: "Total workflows",
        value: allTimeWorkflowsCount,
        icon: <FileText className="h-4 w-4" />,
        iconColor: "text-slate-400 dark:text-slate-500",
        valueColor: "text-slate-900 dark:text-slate-100",
        sub: "all-time documents",
        onClick: () => onStatClick?.("Total workflows"),
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

  // Handle subtle highlight on value change
  React.useEffect(() => {
    const currentValues = items.map(i => i.value);
    const indicesToHighlight = new Set<number>();

    currentValues.forEach((val, idx) => {
      const prev = prevValues.current[idx];
      if (prev !== undefined && prev !== null && prev !== val) {
        indicesToHighlight.add(idx);
      }
    });

    if (indicesToHighlight.size > 0) {
      setHighlightIndices(indicesToHighlight);
      const timer = setTimeout(() => setHighlightIndices(new Set()), 2000);
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
        const isHighlighted = highlightIndices.has(idx);

        return (
          <Card
            key={item.label}
            onClick={item.onClick}
            className={`
              relative transition-all duration-500 min-h-0 ${mobileColSpan} sm:col-span-1
              ${isActionNeeded && item.value > 0 ? "border-rose-200/60 bg-rose-50/5 dark:border-rose-900/40 dark:bg-rose-500/5" : "border-neutral-200/60 dark:border-surface-400"}
              overflow-hidden
            `}
          >
            {/* Subtle background flash */}
            <AnimatePresence>
              {isHighlighted && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className={`absolute inset-0 pointer-events-none ${isActionNeeded ? "bg-rose-500/5" : "bg-sky-500/5"}`}
                />
              )}
            </AnimatePresence>

            <CardBody className="h-full justify-between gap-1 py-2 sm:py-2.5 px-3 sm:px-4 relative z-10">
              <div className="flex flex-col gap-1.5 sm:gap-2">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 ${item.iconColor} sm:scale-110`}>{item.icon}</span>
                  <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 truncate">
                    {item.label}
                  </p>
                </div>

                <div className="flex items-center h-6 sm:h-8">
                  {loading ? (
                    <Skeleton className="h-6 w-10 sm:h-8 sm:w-16" />
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.p
                        key={item.value}
                        initial={{ opacity: 0, transform: "translateY(4px)" }}
                        animate={{ opacity: 1, transform: "translateY(0)" }}
                        exit={{ opacity: 0, transform: "translateY(-4px)" }}
                        transition={{ duration: 0.3, ease: TRANSITION_EASE_OUT }}
                        className={`text-xl sm:text-3xl font-display font-semibold tabular-nums leading-none ${item.valueColor}`}
                      >
                        {item.value}
                      </motion.p>
                    </AnimatePresence>
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
