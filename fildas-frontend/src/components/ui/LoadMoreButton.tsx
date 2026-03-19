import React from "react";

interface LoadMoreButtonProps {
  loading: boolean;
  onClick: () => void;
  className?: string;
}

export default function LoadMoreButton({
  loading,
  onClick,
  className = "",
}: LoadMoreButtonProps) {
  return (
    <div className={`flex justify-center py-3 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
      >
        {loading ? "Loading…" : "Load more"}
      </button>
    </div>
  );
}
