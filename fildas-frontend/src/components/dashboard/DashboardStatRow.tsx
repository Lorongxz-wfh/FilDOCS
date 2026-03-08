import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { DocumentStats } from "../../services/documents";
import { isQA, type UserRole } from "../../lib/roleFilters";

type Props = {
  role: UserRole;
  stats: DocumentStats | null;
  pendingCount: number;
  monitoringCount: number;
  loading: boolean;
};

type StatItem = {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent: string;
  bg: string;
  border: string;
  valueColor: string;
  sub?: string;
};

const IconDoc = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const IconClock = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const IconCheck = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const IconBell = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

const IconEye = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
    />
  </svg>
);

const DashboardStatRow: React.FC<Props> = ({
  role,
  stats,
  pendingCount,
  monitoringCount,
  loading,
}) => {
  const qaItems: StatItem[] = [
    {
      label: "Action needed",
      value: pendingCount,
      icon: <IconBell />,
      accent: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/30",
      border: "border-rose-100 dark:border-rose-900",
      valueColor: "text-rose-600 dark:text-rose-400",
      sub: pendingCount === 1 ? "task waiting" : "tasks waiting",
    },
    {
      label: "Total documents",
      value: stats?.total ?? 0,
      icon: <IconDoc />,
      accent: "text-slate-600 dark:text-slate-300",
      bg: "bg-slate-50 dark:bg-surface-600",
      border: "border-slate-200 dark:border-surface-400",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "in system",
    },
    {
      label: "In progress",
      value: stats?.pending ?? 0,
      icon: <IconClock />,
      accent: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-100 dark:border-amber-900",
      valueColor: "text-amber-600 dark:text-amber-400",
      sub: "active workflows",
    },
    {
      label: "Distributed",
      value: stats?.distributed ?? 0,
      icon: <IconCheck />,
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-100 dark:border-emerald-900",
      valueColor: "text-emerald-600 dark:text-emerald-400",
      sub: "official versions",
    },
    {
      label: "Monitoring",
      value: monitoringCount,
      icon: <IconEye />,
      accent: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-50 dark:bg-sky-950/20",
      border: "border-sky-100 dark:border-sky-900",
      valueColor: "text-sky-600 dark:text-sky-400",
      sub: "tracked docs",
    },
  ];

  const officeItems: StatItem[] = [
    {
      label: "Action needed",
      value: pendingCount,
      icon: <IconBell />,
      accent: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/30",
      border: "border-rose-100 dark:border-rose-900",
      valueColor: "text-rose-600 dark:text-rose-400",
      sub: pendingCount === 1 ? "task waiting" : "tasks waiting",
    },
    {
      label: "My documents",
      value: stats?.total ?? 0,
      icon: <IconDoc />,
      accent: "text-slate-600 dark:text-slate-300",
      bg: "bg-slate-50 dark:bg-surface-600",
      border: "border-slate-200 dark:border-surface-400",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "in system",
    },
    {
      label: "In progress",
      value: stats?.pending ?? 0,
      icon: <IconClock />,
      accent: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/20",
      border: "border-amber-100 dark:border-amber-900",
      valueColor: "text-amber-600 dark:text-amber-400",
      sub: "active workflows",
    },
    {
      label: "Distributed",
      value: stats?.distributed ?? 0,
      icon: <IconCheck />,
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/20",
      border: "border-emerald-100 dark:border-emerald-900",
      valueColor: "text-emerald-600 dark:text-emerald-400",
      sub: "official versions",
    },
  ];

  const items = isQA(role) ? qaItems : officeItems;

  return (
    <div
      className={`grid gap-3 ${isQA(role) ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-2 sm:grid-cols-4"}`}
    >
      {items.map((item) => (
        <div
          key={item.label}
          className={`rounded-2xl border px-4 py-4 ${item.bg} ${item.border} transition-shadow hover:shadow-sm`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
              {item.label}
            </p>
            <span className={`shrink-0 ${item.accent}`}>{item.icon}</span>
          </div>

          {loading ? (
            <Skeleton className="mt-3 h-8 w-16" />
          ) : (
            <p
              className={`mt-2 text-3xl font-bold leading-none ${item.valueColor}`}
            >
              {item.value}
            </p>
          )}

          {item.sub && (
            <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default DashboardStatRow;
