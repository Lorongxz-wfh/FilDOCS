import React from "react";

export const InfoRow: React.FC<{ 
  label: string; 
  value: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  valueClassName?: string;
}> = ({
  label,
  value,
  icon,
  highlight = false,
  valueClassName = "",
}) => (
  <div className={`flex items-center justify-between transition-all duration-700 rounded-lg px-3 py-2 ${
    highlight 
      ? "bg-emerald-50/80 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30" 
      : "bg-slate-50/50 dark:bg-surface-600/30 border-slate-100/80 dark:border-surface-300/10"
    } border`}
  >
    <div className="flex items-center gap-2 shrink-0">
      {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </span>
    </div>
    <span className={`text-xs font-semibold text-slate-700 dark:text-slate-100 text-right flex-1 min-w-0 break-words ${valueClassName}`}>
      {value ?? (
        <span className="text-slate-300 dark:text-surface-500 font-normal">
          —
        </span>
      )}
    </span>
  </div>
);

export function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (e) {
    return "—";
  }
}
