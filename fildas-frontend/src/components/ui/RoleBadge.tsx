import React from "react";

export type UserRole = 
  | "ADMIN" 
  | "SYSADMIN" 
  | "QA" 
  | "OFFICE_STAFF" 
  | "OFFICE_HEAD" 
  | "PRESIDENT" 
  | "VPAA" 
  | "VPAD" 
  | "VPFIN" 
  | "VPREQA" 
  | "AUDITOR"
  | string;

interface RoleBadgeProps {
  role: UserRole;
  className?: string;
  dot?: boolean;
}

const ROLE_CONFIG: Record<string, { label: string; classes: string }> = {
  admin: {
    label: "Admin",
    classes: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  sysadmin: {
    label: "Sysadmin",
    classes: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  qa: {
    label: "QA",
    classes: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  },
  office_staff: {
    label: "Office Staff",
    classes: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  office_head: {
    label: "Office Head",
    classes: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  president: {
    label: "President",
    classes: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  vpaa: {
    label: "VPAA",
    classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  vpad: {
    label: "VPAD",
    classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  vpfin: {
    label: "VPFIN",
    classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  vpreqa: {
    label: "VPREQA",
    classes: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  },
  auditor: {
    label: "Auditor",
    classes: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  },
};

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, className = "", dot = false }) => {
  const raw = String(role).toLowerCase();
  const config = ROLE_CONFIG[raw] || {
    label: role.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    classes: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  };

  return (
    <div className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${config.classes} ${className}`}>
      {dot && (
        <span className="h-1 w-1 rounded-full bg-current opacity-60" />
      )}
      {config.label}
    </div>
  );
};

export default RoleBadge;
