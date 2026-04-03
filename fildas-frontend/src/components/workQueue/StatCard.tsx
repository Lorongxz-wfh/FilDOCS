import React from "react";
import InlineSpinner from "../ui/loader/InlineSpinner";

interface StatCardProps {
  label: string;
  value: number | null;
  loading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, loading }) => (
  <div className="flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-3 sm:px-4 sm:py-3.5">
    <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
      {label}
    </p>
    <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-display font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none">
      {loading ? <InlineSpinner className="h-5 w-5 border-2" /> : (value ?? 0)}
    </div>
  </div>
);

export default StatCard;
