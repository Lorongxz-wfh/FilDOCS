import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { DocumentStats } from "../../services/documents";
import { isQA, type UserRole } from "../../lib/roleFilters";
import { Bell, FileText, Clock, CheckCircle2, Eye } from "lucide-react";

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
  iconColor: string;
  valueColor: string;
  sub?: string;
};

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
      icon: <Bell className="h-4 w-4" />,
      iconColor: "text-rose-500 dark:text-rose-400",
      valueColor: "text-rose-600 dark:text-rose-400",
      sub: pendingCount === 1 ? "task waiting" : "tasks waiting",
    },
    {
      label: "Total documents",
      value: stats?.total ?? 0,
      icon: <FileText className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "in system",
    },
    {
      label: "In progress",
      value: stats?.pending ?? 0,
      icon: <Clock className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "active workflows",
    },
    {
      label: "Distributed",
      value: stats?.distributed ?? 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "official versions",
    },
    {
      label: "Monitoring",
      value: monitoringCount,
      icon: <Eye className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "tracked docs",
    },
  ];

  const officeItems: StatItem[] = [
    {
      label: "Action needed",
      value: pendingCount,
      icon: <Bell className="h-4 w-4" />,
      iconColor: "text-rose-500 dark:text-rose-400",
      valueColor: "text-rose-600 dark:text-rose-400",
      sub: pendingCount === 1 ? "task waiting" : "tasks waiting",
    },
    {
      label: "My documents",
      value: stats?.total ?? 0,
      icon: <FileText className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "in system",
    },
    {
      label: "In progress",
      value: stats?.pending ?? 0,
      icon: <Clock className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
      sub: "active workflows",
    },
    {
      label: "Distributed",
      value: stats?.distributed ?? 0,
      icon: <CheckCircle2 className="h-4 w-4" />,
      iconColor: "text-slate-400 dark:text-slate-500",
      valueColor: "text-slate-900 dark:text-slate-100",
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
          className="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-500"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
              {item.label}
            </p>
            <span className={`shrink-0 ${item.iconColor}`}>{item.icon}</span>
          </div>

          {loading ? (
            <Skeleton className="mt-3 h-7 w-14" />
          ) : (
            <p className={`mt-2 text-2xl font-bold leading-none ${item.valueColor}`}>
              {item.value}
            </p>
          )}

          {item.sub && (
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default DashboardStatRow;
