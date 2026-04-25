import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TRANSITION_EASE_OUT } from "../../utils/animations";
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
  /** If true, the button shows only the icon initially and expands to show text on hover */
  reveal?: boolean;
};

const base =
  "cursor-pointer inline-flex items-center justify-center font-semibold rounded-md transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2";

const variants: Record<Variant, string> = {
  primary:
    "bg-brand-500 text-white hover:bg-brand-600 border border-brand-700 dark:bg-brand-600 dark:hover:bg-brand-500",
  secondary:
    "bg-slate-800 text-white hover:bg-slate-900 dark:bg-surface-400 dark:hover:bg-surface-300",
  outline:
    "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 dark:bg-surface-500 dark:border-surface-400 dark:text-slate-300 dark:hover:bg-surface-400",
  ghost:
    "text-slate-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-surface-400/50",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 border border-rose-700 dark:bg-rose-600 dark:hover:bg-rose-500",
  success:
    "bg-emerald-600 text-white hover:bg-emerald-700 border border-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500",
};

const sizes: Record<Size, string> = {
  xs: "px-3 py-1 text-xs gap-1",
  sm: "px-5 py-2 text-xs gap-1.5",
  md: "px-8 py-2.5 text-sm gap-2",
  lg: "px-10 py-3 text-base gap-2",
};

export default function Button({
  variant = "outline",
  size = "sm",
  loading = false,
  tooltip,
  tooltipSide = "top",
  responsive = false,
  reveal = false,
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  // If reveal is true, we need to carefully separate the icon from the text
  const content = React.useMemo(() => {
    if (!reveal) return children;

    const childrenArray = React.Children.toArray(children);
    const icon = childrenArray.find((child) => React.isValidElement(child) && (child.type as any) !== "span");
    const textNode = childrenArray.find((child) => typeof child === "string" || (React.isValidElement(child) && (child.type as any) === "span"));

    const SafeAnimatePresence = AnimatePresence as any;
    const SafeMotion = motion as any;

    if (!SafeAnimatePresence || !SafeMotion) {
      return (
        <div className="flex items-center gap-2 overflow-hidden">
          {icon || childrenArray[0]}
          {isHovered && <span className="ml-2 font-semibold whitespace-nowrap">{textNode}</span>}
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 overflow-hidden">
        {icon || childrenArray[0]}
        <SafeAnimatePresence initial={false}>
          {isHovered && (
            <SafeMotion.span
              initial={{ transform: "translateX(-4px)", opacity: 0, width: 0 }}
              animate={{ transform: "translateX(0)", opacity: 1, width: "auto" }}
              exit={{ transform: "translateX(-4px)", opacity: 0, width: 0 }}
              transition={{ duration: 0.2, ease: TRANSITION_EASE_OUT }}
              className="overflow-hidden whitespace-nowrap font-semibold ml-2"
            >
              {textNode}
            </SafeMotion.span>
          )}
        </SafeAnimatePresence>
      </div>
    );
  }, [children, reveal, isHovered]);

  const btn = (
    <button
      {...props}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={[
        base,
        variants[variant],
        sizes[size],
        responsive && !reveal ? "[&>span]:hidden [&>span]:sm:inline" : "",
        reveal ? (isHovered ? "px-5" : "px-2.5") : "", 
        className,
      ].join(" ")}
    >
      {loading ? (
        <div className="flex items-center gap-2">
          {Loader2 ? <Loader2 className="h-4 w-4 animate-spin" /> : <div className="h-4 w-4 rounded-full border-2 border-slate-200 border-t-transparent animate-spin" />}
          {!reveal && size !== "xs" && <span>Processing…</span>}
        </div>
      ) : (
        content
      )}
    </button>
  );

  const SafeTooltip = Tooltip as any;
  if (tooltip && !reveal && SafeTooltip) {
    return <SafeTooltip content={tooltip} side={tooltipSide}>{btn}</SafeTooltip>;
  }
  return btn;
}
