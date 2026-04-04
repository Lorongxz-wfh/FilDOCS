import React from "react";

// ── StatusBadge ─────────────────────────────────────────────────────────────
// Style C — flat muted. Neutral states = gray, signal states = semantic color.
// Shape: rounded-md (rectangular) for status, rounded-full (pill) for type.

const STATUS_MAP: Record<string, string> = {
  // ── Document Phases & Workflow Tasks ──────────────────────────────────────
  draft: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  
  // Review Phase
  "for office review": "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  "for vp review": "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  review: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  
  // Approval Phase
  "for office approval": "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  "for vp approval": "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  "for president approval": "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  approval: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  
  // Finalization Phase
  "for qa final check": "bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400",
  "for qa registration": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  "for qa distribution": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  finalization: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  registration: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  distribution: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",

  // Outcomes
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  distributed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  accepted: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  rejected: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
  cancelled: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",

  // Archival Reasons
  "manually archived": "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-200 dark:border-brand-500/30",
  "superseded (new version)": "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30",
  "superseded": "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30",

  // ── Document Requests & Generic Tasks ─────────────────────────────────────
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  submitted: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
  closed: "bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-500",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  urgent: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",

  // User/Office Status
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
  disabled: "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400",
};

export function StatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const s = String(status).toLowerCase();
  const cls =
    STATUS_MAP[s] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400";
  
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] sm:text-[11px] font-semibold leading-tight transition-colors ${cls} ${className}`}
    >
      {status}
    </span>
  );
}

// ── TypePill ────────────────────────────────────────────────────────────────
// Fully rounded, always muted gray — for mode/type labels like Multi-doc, Internal.

export function TypePill({
  label,
  icon,
  className = "",
}: {
  label: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-surface-400 dark:text-slate-400 ${className}`}>
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

export function AnnouncementTypePill({ type, className = "" }: { type: string, className?: string }) {
  const t = String(type).toLowerCase();
  const cls =
    ANN_TYPE_MAP[t] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400";
  const label = t.charAt(0).toUpperCase() + t.slice(1);
  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${cls} ${className}`}
    >
      {label}
    </span>
  );
}
