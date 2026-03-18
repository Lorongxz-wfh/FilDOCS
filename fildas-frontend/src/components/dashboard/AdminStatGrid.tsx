import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { AdminDashboardStats } from "../../services/documents";
import { Users, Building2, FileText, Activity } from "lucide-react";

type Props = { data: AdminDashboardStats | null; loading: boolean };

const AdminStatGrid: React.FC<Props> = ({ data, loading }) => {
  const items = [
    {
      label: "Total users",
      value: data?.users.total ?? 0,
      sub: `${data?.users.active ?? 0} active`,
      icon: <Users className="h-4 w-4" />,
    },
    {
      label: "Total offices",
      value: data?.offices.total ?? 0,
      sub: `${data?.offices.active ?? 0} active`,
      icon: <Building2 className="h-4 w-4" />,
    },
    {
      label: "Total documents",
      value: data?.documents.total ?? 0,
      sub: `${data?.documents.distributed ?? 0} distributed`,
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "In progress",
      value: data?.documents.in_progress ?? 0,
      sub: "active workflows",
      icon: <Activity className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-500"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {item.label}
            </p>
            <span className="text-slate-400 dark:text-slate-500">{item.icon}</span>
          </div>
          {loading ? (
            <Skeleton className="mt-3 h-7 w-14" />
          ) : (
            <p className="mt-2 text-2xl font-bold leading-none text-slate-900 dark:text-slate-100">
              {item.value}
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            {item.sub}
          </p>
        </div>
      ))}
    </div>
  );
};

export default AdminStatGrid;
