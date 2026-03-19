import React from "react";
import InlineSpinner from "../ui/loader/InlineSpinner";

interface StatCardProps {
  label: string;
  value: number | null;
  loading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, loading }) => (
  <div className="flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3">
    <div className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
      {loading ? (
        <InlineSpinner className="h-5 w-5 border-2" />
      ) : (
        (value ?? 0)
      )}
    </div>
    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
      {label}
    </div>
  </div>
);

export default StatCard;
