import React from "react";

export function roleLower(me: any): string {
  const raw = typeof me?.role === "string" ? me?.role : me?.role?.name;
  return String(raw ?? "").toLowerCase();
}

export { formatDate, formatDateTime } from "../../utils/formatters";

export function StatusBadge({ status }: { status: string }) {
  const s = String(status).toLowerCase();
  const map: Record<string, string> = {
    open: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    closed:
      "bg-slate-100 text-slate-600 border-slate-200 dark:bg-surface-400 dark:text-slate-400 dark:border-surface-300",
    cancelled:
      "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
    pending:
      "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    submitted:
      "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800",
    accepted:
      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
    rejected:
      "bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${map[s] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}
    >
      {String(status).toUpperCase()}
    </span>
  );
}

export function RoleBadge({ role }: { role?: string | null }) {
  if (!role) return null;
  const r = String(role).toUpperCase();
  const map: Record<string, string> = {
    QA: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    SYSADMIN:
      "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
    ADMIN:
      "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
    OFFICE_STAFF:
      "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
    OFFICE_HEAD:
      "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  };
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${map[r] ?? "bg-slate-100 text-slate-600"}`}
    >
      {r}
    </span>
  );
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
  badge,
}: {
  tabs: { value: T; label: string; icon?: React.ReactNode }[];
  active: T;
  onChange: (v: T) => void;
  badge?: Partial<Record<T, number>>;
}) {
  return (
    <div className="flex items-center gap-0 border-b border-slate-200 dark:border-surface-400">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            active === t.value
              ? "border-sky-500 text-sky-600 dark:text-sky-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {t.icon}
          {t.label}
          {badge?.[t.value] ? (
            <span className="rounded-full bg-sky-100 px-1.5 text-[10px] font-bold text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              {badge[t.value]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
