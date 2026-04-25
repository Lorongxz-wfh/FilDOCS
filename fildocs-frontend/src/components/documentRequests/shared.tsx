import React from "react";

export function roleLower(me: any): string {
  const raw = typeof me?.role === "string" ? me?.role : me?.role?.name;
  return String(raw ?? "").toLowerCase();
}

export { formatDate, formatDateTime } from "../../utils/formatters";

export { StatusBadge } from "../ui/Badge";

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
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${map[r] ?? "bg-slate-100 text-slate-600"}`}
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
    <div className="flex items-center gap-0">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
            active === t.value
              ? "border-sky-500 text-slate-900 dark:text-slate-50"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          {t.icon}
          {t.label}
          {badge?.[t.value] ? (
            <span className="rounded-full bg-sky-100 px-1.5 text-[10px] font-semibold text-sky-600 dark:bg-sky-950/40 dark:text-sky-400">
              {badge[t.value]}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}
