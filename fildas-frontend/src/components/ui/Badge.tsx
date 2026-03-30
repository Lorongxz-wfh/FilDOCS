import React from "react";

// ── StatusBadge ─────────────────────────────────────────────────────────────
// Style C — flat muted. Neutral states = gray, signal states = semantic color.
// Shape: rounded-md (rectangular) for status, rounded-full (pill) for type.

const STATUS_MAP: Record<string, string> = {
  // Neutral — gray, no distraction
  draft: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  pending:
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  review: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  approval:
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  submitted:
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  open: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  closed: "bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-500",
  finalization:
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",

  // Signal — outcome states only
  accepted:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  distributed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  completed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
};

export function StatusBadge({ status }: { status: string }) {
  const s = String(status).toLowerCase();
  const cls =
    STATUS_MAP[s] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400";
  const label = s.charAt(0).toUpperCase() + s.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {label}
    </span>
  );
}

// ── TypePill ────────────────────────────────────────────────────────────────
// Fully rounded, always muted gray — for mode/type labels like Multi-doc, Internal.

export function TypePill({
  label,
  icon,
}: {
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-surface-400 dark:text-slate-400">
      {icon}
      {label}
    </span>
  );
}

// ── AnnouncementTypePill ────────────────────────────────────────────────────
// For announcement type tags: info / warning / urgent.

const ANN_TYPE_MAP: Record<string, string> = {
  info: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400",
  warning:
    "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

export function AnnouncementTypePill({ type }: { type: string }) {
  const t = String(type).toLowerCase();
  const cls =
    ANN_TYPE_MAP[t] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400";
  const label = t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}
    >
      {label}
    </span>
  );
}
