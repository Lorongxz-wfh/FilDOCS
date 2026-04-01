import React from "react";
import Tooltip from "./Tooltip";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";
type Side = "top" | "bottom" | "left" | "right";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  tooltip?: string;
  tooltipSide?: Side;
  /** If true, and the button has multiple words or is specifically marked, it hides the text on mobile */
  responsive?: boolean;
};

const base =
  "cursor-pointer inline-flex items-center justify-center font-medium rounded-md transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-400 text-white hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400",
  secondary:
    "bg-surface-500 text-white hover:bg-surface-400 dark:bg-surface-400 dark:hover:bg-surface-300",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:hover:bg-surface-400",
  ghost:
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-500",
  danger:
    "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 hover:border-rose-400 dark:border-rose-900 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/15 dark:hover:border-rose-800",
};

const sizes: Record<Size, string> = {
  xs: "px-2.5 py-1 text-xs gap-1",
  sm: "px-3 py-1.5 text-xs gap-1.5",
  md: "px-3.5 py-2 text-sm gap-2",
  lg: "px-4 py-2.5 text-base gap-2",
};

export default function Button({
  variant = "outline",
  size = "sm",
  loading = false,
  tooltip,
  tooltipSide = "top",
  responsive = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const btn = (
    <button
      {...props}
      disabled={disabled || loading}
      className={[
        base,
        variants[variant],
        sizes[size],
        responsive ? "[&>span]:hidden [&>span]:sm:inline" : "",
        className,
      ].join(" ")}
    >
      {loading ? "Loading..." : children}
    </button>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} side={tooltipSide}>{btn}</Tooltip>;
  }
  return btn;
}
