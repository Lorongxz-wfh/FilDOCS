import React from "react";
import Tooltip from "./Tooltip";
import { Loader2 } from "lucide-react";

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
  "cursor-pointer inline-flex items-center justify-center font-medium rounded-md transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap active:scale-95";

const variants: Record<Variant, string> = {
  primary:
    "bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-400 shadow-sm",
  secondary:
    "bg-slate-600 text-white hover:bg-slate-700 dark:bg-surface-400 dark:hover:bg-surface-300 shadow-sm",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-200 dark:hover:bg-surface-500 shadow-sm",
  ghost:
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-500",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500/90 dark:hover:bg-rose-500 shadow-sm",
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
