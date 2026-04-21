import React from "react";

type Color = "default" | "emerald" | "rose" | "sky" | "violet" | "amber";

const neutralValue = "text-slate-900 dark:text-slate-100";

const colorMap: Record<Color, { value: string; bg: string; icon: string }> = {
  default: {
    value: neutralValue,
    bg: "bg-slate-100 dark:bg-surface-400",
    icon: "text-slate-500 dark:text-slate-400",
  },
  emerald: {
    value: neutralValue,
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    icon: "text-emerald-600 dark:text-emerald-400",
  },
  rose: {
    value: neutralValue,
    bg: "bg-rose-50 dark:bg-rose-900/30",
    icon: "text-rose-600 dark:text-rose-400",
  },
  sky: {
    value: neutralValue,
    bg: "bg-sky-50 dark:bg-sky-900/30",
    icon: "text-sky-600 dark:text-sky-400",
  },
  violet: {
    value: neutralValue,
    bg: "bg-violet-50 dark:bg-violet-900/30",
    icon: "text-violet-600 dark:text-violet-400",
  },
  amber: {
    value: neutralValue,
    bg: "bg-amber-50 dark:bg-amber-900/30",
    icon: "text-amber-600 dark:text-amber-400",
  },
};

type Props = {
  label: string;
  value: React.ReactNode;
  sub?: string;
  color?: Color;
  icon?: React.ReactNode;
  loading?: boolean;
};

const ReportStatCard: React.FC<Props> = ({
  label,
  value,
  sub,
  color = "default",
  icon,
  loading = false,
}) => {
  const c = colorMap[color];

  if (loading) {
    return (
      <div className="flex-1 min-w-0 sm:min-w-40 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-5 py-4 flex items-start gap-4">
        <div className="mt-0.5 rounded-md p-2 bg-slate-100 dark:bg-surface-400 animate-pulse w-9 h-9 shrink-0" />
        <div className="min-w-0 flex-1 space-y-2 pt-0.5">
          <div className="h-7 w-16 rounded bg-slate-200 dark:bg-surface-300 animate-pulse" />
          <div className="h-2.5 w-24 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
          <div className="h-2 w-32 rounded bg-slate-100 dark:bg-surface-400 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0 sm:min-w-40 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-5 py-4 flex items-start gap-4">
      {icon && (
        <div className={`mt-0.5 rounded-md p-2 ${c.bg}`}>
          <span className={`text-lg ${c.icon}`}>{icon}</span>
        </div>
      )}
      <div className="min-w-0">
        <div
          className={`text-2xl font-semibold tabular-nums leading-none ${c.value}`}
        >
          {value}
        </div>
        <div className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          {label}
        </div>
        {sub && (
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {sub}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportStatCard;
