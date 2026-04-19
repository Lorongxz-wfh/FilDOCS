import React from "react";
import BackButton from "../ui/buttons/BackButton";
import Breadcrumb, { type BreadcrumbItem } from "../ui/Breadcrumb";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "../../hooks/useMediaQuery";
import { Info, X } from "lucide-react";

type Props = {
  // Left header
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  onBack?: () => void;
  onBackDisabled?: boolean;
  breadcrumbs?: BreadcrumbItem[];

  // Right header
  rightHeader: React.ReactNode;
  onCollapseToggle?: () => void;

  // Content
  left: React.ReactNode;
  right: React.ReactNode;

  // Right panel collapse
  rightCollapsed?: boolean;
  rightWidthClass?: string;
};

export default function DocFrame({
  title,
  subtitle,
  actions,
  onBack,
  onBackDisabled,
  breadcrumbs,
  rightHeader,
  left,
  right,
  rightCollapsed = false,
  rightWidthClass = "w-[340px]",
  onCollapseToggle,
}: Props) {
  const [mobileRightOpen, setMobileRightOpen] = React.useState(false);
  const isMobile = useIsMobile();

  // Close mobile sheet if window is resized to desktop
  React.useEffect(() => {
    if (!isMobile) setMobileRightOpen(false);
  }, [isMobile]);

  return (
    <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
      {/* Split top header */}
      <div className="shrink-0 flex border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600">
        {/* Left header — gets full width on mobile since right header is hidden */}
        <div className="flex flex-col sm:flex-row flex-1 min-w-0 sm:items-center gap-3 px-4 py-2.5 sm:px-6 sm:py-3 leading-tight sm:leading-normal">
          <div className="flex flex-1 min-w-0 items-start sm:items-center gap-3">
            {onBack && (
              <div className="mt-1 sm:mt-0">
                <BackButton onClick={onBack} disabled={onBackDisabled} />
              </div>
            )}
            <div className="flex min-w-0 flex-1 flex-col">
              {breadcrumbs && breadcrumbs.length > 0 && (
                <Breadcrumb items={breadcrumbs} />
              )}
              <div className="min-w-0 text-base font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                {title}
              </div>
              {subtitle && (
                <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          {actions && (
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
          )}
        </div>

        {/* Right header — hidden on mobile, shown on md+ */}
        <div
          className={[
            "shrink-0 hidden md:flex md:flex-col",
            rightCollapsed ? "" : "border-l border-slate-200 dark:border-surface-400",
            "bg-white dark:bg-surface-600",
            "transition-all duration-200 overflow-visible",
            rightCollapsed ? "w-10" : rightWidthClass,
          ].join(" ")}
        >
          {rightCollapsed ? (
            /* Collapsed: just the expand button, vertically centered */
            <div className="flex h-full items-center justify-center">
              <button
                type="button"
                onClick={onCollapseToggle}
                className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-500 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-100 transition"
                title="Expand panel"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            </div>
          ) : (
            /* Expanded: collapse button left, VERSIONS + dropdown right */
            <div className="flex items-center h-full px-2 gap-2">
              <button
                type="button"
                onClick={onCollapseToggle}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-500 text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-100 transition"
                title="Collapse panel"
              >
                <svg
                  className="h-3.5 w-3.5"
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

              {/* Version label + dropdown inline, pushed to right */}
              <div className="flex items-center gap-2 ml-auto overflow-visible">
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">
                  Version
                </span>
                <div className="overflow-visible">{rightHeader}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left content */}
        <div className="flex-1 min-w-0 min-h-0 overflow-y-auto">
          <div className="px-4 py-4 sm:px-6 sm:py-5">{left}</div>
        </div>

        {/* Right panel — desktop only */}
        {!rightCollapsed && (
          <aside
            className={[
              "hidden md:flex md:flex-col shrink-0",
              "border-l border-slate-200 dark:border-surface-400",
              "bg-white dark:bg-surface-500",
              "transition-all duration-200",
              rightWidthClass,
            ].join(" ")}
          >
            <div className="flex-1 min-h-0 overflow-hidden">{right}</div>
          </aside>
        )}
      </div>

      {/* Mobile-only Bottom Sheet for right panel */}
      <AnimatePresence>
        {isMobile && (
          <motion.div
            initial={false}
            animate={{ 
              scale: mobileRightOpen ? 0.8 : 1, 
              opacity: mobileRightOpen ? 0 : 1 
            }}
            transition={{ duration: 0.15 }}
            className={`fixed bottom-24 right-6 z-40 md:hidden ${mobileRightOpen ? "pointer-events-none" : ""}`}
          >
            <button
              onClick={() => setMobileRightOpen(true)}
              className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/20 ring-4 ring-white dark:ring-surface-500 hover:scale-105 active:scale-95 transition-all duration-150"
            >
              <div className="relative">
                <Info size={28} />
              </div>
            </button>
          </motion.div>
        )}

        {mobileRightOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileRightOpen(false)}
              className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl bg-white dark:bg-surface-500 shadow-2xl md:hidden max-h-[85vh] flex flex-col"
            >
              <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-surface-400">
                <div className="flex items-center gap-2">
                  <div className="h-1 w-8 rounded-full bg-slate-200 dark:bg-surface-400 absolute left-1/2 -top-2 -translate-x-1/2" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white uppercase tracking-tight">
                    Document Hub
                  </span>
                </div>
                <button
                  onClick={() => setMobileRightOpen(false)}
                  className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-surface-400 text-slate-500 dark:text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                {right}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
