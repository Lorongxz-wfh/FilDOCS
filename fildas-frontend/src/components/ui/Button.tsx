import React from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

const base =
  "cursor-pointer inline-flex items-center justify-center font-medium rounded transition disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-300 text-white hover:bg-brand-400 dark:bg-brand-300 dark:hover:bg-brand-400",
  secondary:
    "bg-surface-500 text-white hover:bg-surface-400 dark:bg-surface-400 dark:hover:bg-surface-300",
  outline:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:hover:bg-surface-400",
  ghost:
    "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-500",
  danger:
    "border border-rose-300 bg-white text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-transparent dark:text-rose-400 dark:hover:bg-rose-950/40",
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
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={[base, variants[variant], sizes[size], className].join(" ")}
    >
      {loading ? "Loading..." : children}
    </button>
  );
}
