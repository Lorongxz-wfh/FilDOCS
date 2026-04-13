import React from "react";
import Tooltip from "./Tooltip";
import { Loader2 } from "lucide-react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success";
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
  "cursor-pointer inline-flex items-center justify-center font-semibold rounded-md transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-400 shadow-sm border border-brand-700/20 dark:border-white/10",
  secondary:
    "bg-neutral-800 text-white hover:bg-neutral-900 dark:bg-surface-400 dark:hover:bg-surface-300 shadow-sm",
  outline:
    "border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-400 dark:border-surface-300 dark:bg-surface-500 dark:text-surface-100 dark:hover:bg-surface-400 shadow-sm",
  ghost:
    "text-neutral-600 hover:bg-neutral-100/80 dark:text-neutral-400 dark:hover:bg-surface-400/50",
  danger:
    "bg-red-600 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-500 shadow-sm border border-red-700/20 dark:border-white/10",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm border border-emerald-700/20 dark:border-white/10",
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
      {loading ? (
        <div className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {size !== "xs" && <span>Loading…</span>}
        </div>
      ) : (
        children
      )}
    </button>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} side={tooltipSide}>{btn}</Tooltip>;
  }
  return btn;
}
