import React from "react";

interface DateRangeInputProps {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  className?: string;
}

export default function DateRangeInput({
  from,
  to,
  onFromChange,
  onToChange,
  className = "",
}: DateRangeInputProps) {
  return (
    <div
      className={`flex items-center gap-0 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-2.5 py-1.5 ${className}`}
    >
      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 mr-1.5">
        From
      </span>
      <input
        type="date"
        value={from}
        onChange={(e) => onFromChange(e.target.value)}
        className="bg-transparent outline-none text-xs text-slate-600 dark:text-slate-300"
      />
      <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500 mx-1.5">
        To
      </span>
      <input
        type="date"
        value={to}
        onChange={(e) => onToChange(e.target.value)}
        className="bg-transparent outline-none text-xs text-slate-600 dark:text-slate-300"
      />
    </div>
  );
}
