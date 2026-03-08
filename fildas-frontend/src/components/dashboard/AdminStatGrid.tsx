import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { AdminDashboardStats } from "../../services/documents";

type Props = { data: AdminDashboardStats | null; loading: boolean };

const AdminStatGrid: React.FC<Props> = ({ data, loading }) => {
  const items = [
    {
      label: "Total users",
      value: data?.users.total ?? 0,
      sub: `${data?.users.active ?? 0} active`,
      icon: "👤",
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-50 dark:bg-indigo-950/20",
      border: "border-indigo-100 dark:border-indigo-900",
    },
    {
      label: "Total offices",
      value: data?.offices.total ?? 0,
      sub: `${data?.offices.active ?? 0} active`,
      icon: "🏢",
      color: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-950/20",
      border: "border-sky-100 dark:border-sky-900",
    },
    {
      label: "Total documents",
      value: data?.documents.total ?? 0,
      sub: `${data?.documents.distributed ?? 0} distributed`,
      icon: "📄",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-100 dark:border-emerald-900",
    },
    {
      label: "In progress",
      value: data?.documents.in_progress ?? 0,
      sub: "active workflows",
      icon: "⚙️",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-100 dark:border-amber-900",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl border px-4 py-4 ${item.bg} ${item.border}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
            <span className="text-xl">{item.icon}</span>
          </div>
          {loading ? (
            <Skeleton className="mt-3 h-8 w-16" />
          ) : (
            <p className={`mt-2 text-3xl font-bold leading-none ${item.color}`}>
              {item.value}
            </p>
          )}
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            {item.sub}
          </p>
        </div>
      ))}
    </div>
  );
};

export default AdminStatGrid;
