import React from "react";

type Variant = "info" | "success" | "warning" | "error" | "danger";
type Style = "box" | "accent"; // box = full border, accent = left-border stripe

const boxStyles: Record<Variant, string> = {
  info:    "border-slate-200 bg-slate-50 text-slate-800 dark:border-surface-300 dark:bg-surface-400 dark:text-slate-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300",
  warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300",
  error:   "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/15 dark:text-rose-300",
  danger:  "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/15 dark:text-rose-300",
};

const accentStyles: Record<Variant, { wrap: string; icon: string; border: string }> = {
  info:    { wrap: "bg-slate-50 dark:bg-surface-400",           icon: "text-slate-500 dark:text-slate-300",      border: "border-l-4 border-brand-400 dark:border-brand-300" },
  success: { wrap: "bg-emerald-50 dark:bg-emerald-950/20",      icon: "text-emerald-500 dark:text-emerald-400",  border: "border-l-4 border-emerald-400 dark:border-emerald-600" },
  warning: { wrap: "bg-amber-50 dark:bg-amber-950/20",          icon: "text-amber-500 dark:text-amber-400",      border: "border-l-4 border-amber-400 dark:border-amber-600" },
  error:   { wrap: "bg-rose-50 dark:bg-rose-950/15",            icon: "text-rose-500 dark:text-rose-400",        border: "border-l-4 border-rose-400 dark:border-rose-800" },
  danger:  { wrap: "bg-rose-50 dark:bg-rose-950/15",            icon: "text-rose-500 dark:text-rose-400",        border: "border-l-4 border-rose-400 dark:border-rose-800" },
};

const titleStyles: Record<Variant, string> = {
  info:    "text-slate-800 dark:text-slate-100",
  success: "text-emerald-700 dark:text-emerald-300",
  warning: "text-amber-800 dark:text-amber-300",
  error:   "text-rose-700 dark:text-rose-300",
  danger:  "text-rose-700 dark:text-rose-300",
};

const bodyStyles: Record<Variant, string> = {
  info:    "text-slate-600 dark:text-slate-400",
  success: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-700 dark:text-amber-400",
  error:   "text-rose-600 dark:text-rose-400",
  danger:  "text-rose-600 dark:text-rose-400",
};

export type AlertProps = {
  variant?: Variant;
  alertStyle?: Style;
  title?: string;
  /** Optional icon element, e.g. <Upload className="h-4 w-4" /> */
  icon?: React.ReactNode;
  /** Optional right-side action button */
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};

export default function Alert({
  variant = "info",
  alertStyle = "box",
  title,
  icon,
  action,
  className = "",
  children,
}: AlertProps) {
  if (alertStyle === "accent") {
    const s = accentStyles[variant];
    return (
      <div className={["flex flex-col sm:flex-row sm:items-start gap-3 rounded-md px-4 py-2.5", s.wrap, s.border, className].join(" ")}>
        <div className="flex flex-1 items-start gap-3 min-w-0">
          {icon && <span className={["shrink-0 mt-0.5", s.icon].join(" ")}>{icon}</span>}
          <div className="flex-1 min-w-0">
            {title && <p className={["text-xs font-semibold", titleStyles[variant]].join(" ")}>{title}</p>}
            {children && <div className={["text-xs mt-0.5 leading-relaxed", bodyStyles[variant]].join(" ")}>{children}</div>}
          </div>
        </div>
        {action && <div className="shrink-0 flex items-center gap-2 mt-1 sm:mt-0">{action}</div>}
      </div>
    );
  }

  // Box style (default)
  return (
    <div className={["rounded-xl border px-4 py-3 text-sm", boxStyles[variant], className].join(" ")}>
      <div className="flex flex-col sm:flex-row sm:items-start gap-3">
        <div className="flex flex-1 items-start gap-3 min-w-0">
          {icon && <span className="shrink-0 mt-0.5">{icon}</span>}
          <div className="flex-1 min-w-0">
            {title && <div className="mb-1 font-semibold">{title}</div>}
            {children && <div className="leading-relaxed">{children}</div>}
          </div>
        </div>
        {action && <div className="shrink-0 flex items-center gap-2 mt-2 sm:mt-0">{action}</div>}
      </div>
    </div>
  );
}
