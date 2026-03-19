import React from "react";
import PageHeading from "../ui/PageHeading";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  contentClassName?: string;
  className?: string;
  children: React.ReactNode;
};

export default function PageFrame({
  title,
  subtitle,
  right,
  onBack,
  contentClassName = "",
  className = "",
  children,
}: Props) {
  return (
    <div
      className={[
        "min-h-0 flex flex-1 flex-col overflow-hidden",
        className,
      ].join(" ")}
    >
      <div className="shrink-0 border-b border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600">
        <div className="flex items-center min-h-15 px-4 sm:px-6 py-2">
          <div className="flex flex-1 items-center justify-between gap-2 sm:gap-4">
            {/* Left: back arrow + title */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
                  aria-label="Go back"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
              )}
              <PageHeading title={title} subtitle={subtitle} />
            </div>

            {/* Right: action buttons */}
            {right && (
              <div className="flex shrink-0 items-center gap-2">{right}</div>
            )}
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div
          className={["px-4 py-4 sm:px-6 sm:py-5", contentClassName].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
