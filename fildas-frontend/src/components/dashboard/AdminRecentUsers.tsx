import React from "react";
import Skeleton from "../ui/loader/Skeleton";

type User = {
  id: number;
  name: string;
  email: string;
  role: string;
  office_name: string | null;
  is_active: boolean;
  created_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  qa: "QA",
  admin: "Admin",
  president: "President",
  vp: "VP",
  office_head: "Office Head",
  office_staff: "Office Staff",
  auditor: "Auditor",
  sysadmin: "Sysadmin",
};

const ROLE_COLORS: Record<string, string> = {
  qa: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  admin: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  president:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  vp: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  office_head:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  office_staff:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
};

const AdminRecentUsers: React.FC<{ users: User[]; loading: boolean }> = ({
  users,
  loading,
}) => (
  <div className="min-h-52.5 space-y-0.5">
    {loading
      ? Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full rounded-md" />
        ))
      : users.slice(0, 5).map((u) => (
          <div
            key={u.id}
            className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50 dark:hover:bg-surface-600 transition-colors"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-surface-400 text-xs font-bold text-slate-600 dark:text-slate-300">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                {u.name}
              </p>
              <p className="truncate text-[11px] text-slate-400 dark:text-slate-500">
                {u.office_name ?? "No office"}
              </p>
            </div>
            <span
              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${ROLE_COLORS[u.role] ?? "bg-slate-100 text-slate-600"}`}
            >
              {ROLE_LABELS[u.role] ?? u.role}
            </span>
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${u.is_active ? "bg-emerald-400" : "bg-slate-300"}`}
            />
          </div>
        ))}
  </div>
);

export default AdminRecentUsers;
