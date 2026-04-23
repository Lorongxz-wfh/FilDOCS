import React from "react";

type Side = "top" | "bottom" | "left" | "right";

interface TooltipProps {
  /** Tooltip content to display on hover */
  content: React.ReactNode;
  side?: Side;
  children: React.ReactNode;
  /** Extra classes on the wrapper div */
  className?: string;
}

const SIDE_CLS: Record<Side, string> = {
  top:    "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
  left:   "right-full top-1/2 -translate-y-1/2 mr-1.5",
  right:  "left-full top-1/2 -translate-y-1/2 ml-1.5",
};

/**
 * Lightweight CSS-only tooltip.
 * Wraps children in a `group/tt` container and shows text on hover.
 *
 * @example
 * <Tooltip content="Refresh">
 *   <button>...</button>
 * </Tooltip>
 */
export default function Tooltip({
  content,
  side = "top",
  children,
  className = "",
}: TooltipProps) {
  if (!content) return <>{children}</>;
  return (
    <div className={`group/tt relative inline-flex ${className}`}>
      {children}
      <div
        role="tooltip"
        className={[
          "pointer-events-none absolute z-[9999] whitespace-nowrap rounded",
          "bg-slate-800 dark:bg-slate-900 px-2.5 py-1.5 text-[11px] leading-relaxed text-white shadow-xl border border-white/10",
          "opacity-0 group-hover/tt:opacity-100 transition-opacity duration-150",
          SIDE_CLS[side] || SIDE_CLS.top,
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}
