import React from "react";

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  message = "Loading...",
}) => (
  <div className="flex h-full items-center justify-center bg-slate-50/70 dark:bg-surface-600/70 backdrop-blur-sm">
    <div className="mx-4 w-full max-w-xs rounded-xl border border-slate-200 dark:border-surface-400 bg-white/85 dark:bg-surface-500/85 px-6 py-5 shadow-sm">
      <div className="flex flex-col items-center text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 dark:border-surface-400 border-t-sky-600 dark:border-t-sky-400" />
        <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">
          {message}
        </p>
        {message === "Loading..." ? (
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            Loading document version…
          </p>
        ) : null}
      </div>
    </div>
  </div>
);

export default LoadingSpinner;
