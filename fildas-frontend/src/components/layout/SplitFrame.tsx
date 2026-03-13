import React from "react";
import PageHeading from "../ui/PageHeading";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  onBackDisabled?: boolean;
  rightTitle?: React.ReactNode;
  rightSubtitle?: React.ReactNode;
  rightHeader?: React.ReactNode;
  rightWidthClassName?: string;
  left: React.ReactNode;
  rightPanel: React.ReactNode;
  onRightTitleClick?: () => void;
  rightCollapsed?: boolean;
  versionsDropdown?: React.ReactNode;
  // internal use only — do not pass both
};

export default function SplitFrame({
  title,
  subtitle,
  right,
  onBack,
  onBackDisabled,
  rightTitle = "Versions",
  rightSubtitle,
  rightHeader,
  rightWidthClassName = "w-[340px]",
  left,
  rightPanel,
  onRightTitleClick,
  rightCollapsed = false,
  versionsDropdown,
}: Props) {
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
      {/* Top header */}
      <div className="shrink-0 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-surface-400 dark:bg-surface-600/80">
        <div className="px-4 py-2 sm:px-6 sm:py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <PageHeading
                title={title}
                subtitle={subtitle}
                right={right}
                onBack={onBack}
                onBackDisabled={onBackDisabled}
              />
            </div>

            {/* Mobile versions toggle button */}
            <button
              type="button"
              onClick={() => setMobileDrawerOpen((v) => !v)}
              className="md:hidden shrink-0 mt-0.5 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              {rightTitle}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="min-h-0 flex flex-1 overflow-hidden">
        {/* Left / main content */}
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="px-4 py-4 sm:px-6 sm:py-5 flex flex-col">{left}</div>
        </div>

        {/* Desktop right aside — hidden on mobile */}
        {/* Collapsed tab — only visible when panel is closed */}
        {rightCollapsed && (
          <button
            type="button"
            onClick={onRightTitleClick}
            className="hidden md:flex shrink-0 flex-col items-center justify-start gap-1 border-l border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 w-8 pt-3 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-500 transition"
            title="Expand panel"
          >
            <svg
              className="h-3.5 w-3.5 rotate-180"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
        <aside
          className={[
            "hidden md:flex md:flex-col relative",
            rightCollapsed ? "w-0 overflow-hidden" : rightWidthClassName,
            "shrink-0 border-l border-slate-200 bg-white transition-all duration-200 overflow-visible",
            "dark:border-surface-400 dark:bg-surface-500",
          ].join(" ")}
        >
          <div className="flex h-full min-h-0 flex-col overflow-visible">
            {/* Panel header — collapse + title + versions dropdown */}
            <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 dark:border-surface-400 dark:bg-surface-600/80 px-3 py-2 overflow-visible relative z-20">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={onRightTitleClick}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
                  title="Collapse panel"
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
                  {rightTitle}
                </div>
                {versionsDropdown && (
                  <div className="min-w-0 flex-1">{versionsDropdown}</div>
                )}
                {rightHeader && (
                  <div className="shrink-0 ml-auto">{rightHeader}</div>
                )}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="p-4">{rightPanel}</div>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile bottom drawer */}
      {mobileDrawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}
      <div
        className={[
          "fixed inset-x-0 bottom-0 z-50 md:hidden",
          "flex flex-col rounded-t-2xl border-t border-slate-200 dark:border-surface-400",
          "bg-white dark:bg-surface-500",
          "transition-transform duration-300 ease-in-out",
          mobileDrawerOpen ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={{ maxHeight: "70vh" }}
      >
        {/* Drawer handle + header */}
        <div className="shrink-0 border-b border-slate-200 dark:border-surface-400 px-4 py-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 dark:bg-surface-400" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {rightTitle}
              </p>
              {rightSubtitle && (
                <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  {rightSubtitle}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(false)}
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 transition"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer content */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{rightPanel}</div>
      </div>
    </div>
  );
}
