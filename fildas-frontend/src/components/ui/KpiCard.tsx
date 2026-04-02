import React from "react";
import Skeleton from "./loader/Skeleton";

interface KpiCardProps {
  label: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  sub,
  icon,
  iconBg,
  loading,
}) => (
  <div className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2.5 sm:px-4 sm:py-3.5 flex items-center gap-3 sm:gap-4 shadow-sm">
    <div
      className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-md ${iconBg} scale-90 sm:scale-100`}
    >
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      {loading ? (
        <div className="space-y-1">
          <Skeleton className="h-4 w-12 sm:h-5 sm:w-16" />
          <Skeleton className="h-2 w-20 sm:h-3 sm:w-24" />
        </div>
      ) : (
        <div className="flex flex-col sm:block">
          <p className="text-base sm:text-xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
            {value}
          </p>
          <p className="mt-0.5 sm:mt-1 text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
            {label}
          </p>
        </div>
      )}
    </div>
    <p className="hidden sm:block shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400 text-right leading-tight max-w-[5rem]">
      {sub}
    </p>
  </div>
);

export default KpiCard;
