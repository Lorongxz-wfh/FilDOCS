import React from "react";
import PageHeading from "../ui/PageHeading";
import Breadcrumb, { type BreadcrumbItem } from "../ui/Breadcrumb";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  breadcrumbs?: BreadcrumbItem[];
  contentClassName?: string;
  className?: string;
  fullHeight?: boolean;
  children: React.ReactNode;
};

export default function PageFrame({
  title,
  subtitle,
  right,
  onBack,
  breadcrumbs,
  contentClassName = "",
  className = "",
  fullHeight = false,
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
        <div className="flex flex-col sm:flex-row sm:items-center min-h-15 px-4 sm:px-6 py-2 sm:py-3 gap-3">
          <div className="flex flex-1 items-center sm:items-center justify-between gap-3 sm:gap-4 min-w-0">
            {/* Left: back arrow + breadcrumbs + title */}
            <div className="flex items-center sm:items-center gap-2 sm:gap-3 min-w-0 flex-1">
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
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                {breadcrumbs && breadcrumbs.length > 0 && (
                  <Breadcrumb items={breadcrumbs} />
                )}
                <PageHeading title={title} subtitle={subtitle} />
              </div>
            </div>

            {/* Right: action buttons — now on same level on mobile */}
            {right && (
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {right}
              </div>
            )}
          </div>
        </div>
      </div>
      <div
        className={[
          "min-h-0 flex-1",
          fullHeight ? "flex flex-col overflow-y-auto lg:overflow-hidden" : "overflow-y-auto",
        ].join(" ")}
      >
        <div
          className={[
            fullHeight ? "flex-1 flex flex-col min-h-0" : "px-4 py-4 sm:px-6 sm:py-5",
            contentClassName,
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
