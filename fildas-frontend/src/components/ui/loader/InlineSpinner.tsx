import React from "react";

type SpinnerSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface InlineSpinnerProps {
  className?: string;
  size?: SpinnerSize;
  variant?: "primary" | "neutral" | "white";
}

const SIZE_MAP: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border-[1.5px]",
  sm: "h-4 w-4 border-2",
  md: "h-5 w-5 border-2",
  lg: "h-6 w-6 border-2",
  xl: "h-8 w-8 border-[3px]",
  "2xl": "h-10 w-10 border-[3px]",
};

const InlineSpinner: React.FC<InlineSpinnerProps> = ({
  className = "",
  size = "sm",
  variant = "primary",
}) => {
  const variantClasses =
    variant === "primary"
      ? "border-slate-200 dark:border-surface-400 border-t-sky-600 dark:border-t-sky-400"
      : variant === "white"
      ? "border-white/20 border-t-white"
      : "border-slate-200 dark:border-surface-400 border-t-slate-500 dark:border-t-slate-300";

  return (
    <span
      className={`inline-block animate-spin rounded-full ${SIZE_MAP[size]} ${variantClasses} ${className}`}
      aria-label="Loading"
    />
  );
};

export default InlineSpinner;
