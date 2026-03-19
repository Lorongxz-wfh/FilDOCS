// Event categorization and color mapping for activity calendar/log components.

export type EventCategory = "positive" | "warning" | "negative" | "neutral";

export function categorizeEvent(event: string): EventCategory {
  const e = event.toLowerCase();
  if (e.includes("distribut") || e.includes("approv") || e.includes("register"))
    return "positive";
  if (e.includes("return") || e.includes("reject") || e.includes("cancel"))
    return "negative";
  if (
    e.includes("review") ||
    e.includes("forward") ||
    e.includes("submit") ||
    e.includes("sent")
  )
    return "warning";
  return "neutral";
}

export const CATEGORY_COLORS: Record<
  EventCategory,
  { dot: string; bg: string; text: string; heat: string[] }
> = {
  positive: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    text: "text-emerald-700 dark:text-emerald-400",
    heat: [
      "bg-emerald-100 dark:bg-emerald-900/30",
      "bg-emerald-200 dark:bg-emerald-800/50",
      "bg-emerald-300 dark:bg-emerald-700/60",
      "bg-emerald-400 dark:bg-emerald-600/80",
      "bg-emerald-500",
    ],
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    text: "text-amber-700 dark:text-amber-400",
    heat: [
      "bg-amber-100",
      "bg-amber-200",
      "bg-amber-300",
      "bg-amber-400",
      "bg-amber-500",
    ],
  },
  negative: {
    dot: "bg-rose-500",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    text: "text-rose-700 dark:text-rose-400",
    heat: [
      "bg-rose-100",
      "bg-rose-200",
      "bg-rose-300",
      "bg-rose-400",
      "bg-rose-500",
    ],
  },
  neutral: {
    dot: "bg-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    text: "text-sky-700 dark:text-sky-400",
    heat: [
      "bg-sky-100 dark:bg-sky-900/30",
      "bg-sky-200 dark:bg-sky-800/40",
      "bg-sky-300 dark:bg-sky-700/50",
      "bg-sky-400 dark:bg-sky-600/70",
      "bg-sky-500",
    ],
  },
};

export function heatColor(count: number, max: number): string {
  if (count === 0 || max === 0) return "bg-slate-100 dark:bg-surface-400";
  const idx = Math.min(4, Math.floor((count / max) * 5));
  const steps = [
    "bg-sky-100 dark:bg-sky-900/30",
    "bg-sky-200 dark:bg-sky-800/50",
    "bg-sky-300 dark:bg-sky-700/60",
    "bg-sky-400 dark:bg-sky-600",
    "bg-sky-500 dark:bg-sky-500",
  ];
  return steps[idx];
}
