import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon,
  label,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-2 py-16 px-6 text-center ${className}`}
    >
      {icon && (
        <div className="text-slate-300 dark:text-slate-600 mb-1">{icon}</div>
      )}
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      {description && (
        <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
