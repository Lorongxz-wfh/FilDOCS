import React from "react";
import { motion } from "framer-motion";
import { TRANSITION_EASE_OUT } from "../../utils/animations";

type Variant = "info" | "success" | "warning" | "error" | "danger" | "primary";

const boxStyles: Record<Variant, string> = {
  info:    "border-slate-200 bg-slate-50 text-slate-800 dark:border-surface-300 dark:bg-surface-400 dark:text-neutral-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900 dark:text-emerald-50",
  warning: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-600 dark:text-white",
  error:   "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900 dark:text-rose-50",
  danger:  "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900 dark:text-rose-50",
  primary: "border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-700 dark:bg-brand-900 dark:text-brand-50",
};

export type AlertProps = {
  variant?: Variant;
  title?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
  dense?: boolean;
};

export default function Alert({
  variant = "info",
  title,
  icon,
  action,
  className = "",
  children,
  dense = false,
}: AlertProps) {
  return (
    <motion.div
      initial={{ opacity: 0, transform: "scale(0.98) translateY(4px)" }}
      animate={{ opacity: 1, transform: "scale(1) translateY(0)" }}
      transition={{ duration: 0.3, ease: TRANSITION_EASE_OUT }}
      className={[
        "rounded-md border text-sm transition-[background-color,border-color] duration-200",
        dense ? "px-3 py-2" : "px-4 py-3",
        boxStyles[variant],
        className,
      ].join(" ")}
    >
      <div className={["flex items-center gap-3", dense ? "flex-row" : "flex-col sm:flex-row sm:items-start"].join(" ")}>
        <div className={["flex flex-1 gap-3 min-w-0", dense ? "items-center" : "items-start"].join(" ")}>
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="flex-1 min-w-0">
            {title && (
              <div className={["font-semibold truncate", dense ? "mb-0" : "mb-1"].join(" ")}>
                {title}
              </div>
            )}
            {children && (
              <div className={["leading-relaxed text-neutral-600 dark:text-neutral-400 truncate-2-lines", dense ? "text-xs" : ""].join(" ")}>
                {children}
              </div>
            )}
          </div>
        </div>
        {action && (
          <div className="shrink-0 flex items-center gap-2">
            {action}
          </div>
        )}
      </div>
    </motion.div>
  );
}
