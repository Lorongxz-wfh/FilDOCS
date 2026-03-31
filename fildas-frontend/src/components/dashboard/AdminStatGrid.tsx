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
      sub: `${data?.users.active ?? 0} active · ${data?.users.online ?? 0} online now`,
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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-slate-200 bg-white p-2.5 sm:px-4 sm:py-3.5 dark:border-surface-400 dark:bg-surface-500 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider leading-tight truncate">
              {item.label}
            </p>
            <span className="text-slate-400 dark:text-slate-500 sm:scale-100 scale-75 shrink-0">
              {item.icon}
            </span>
          </div>
          
          <div className="mt-1 sm:mt-2.5">
            {loading ? (
              <Skeleton className="h-5 sm:h-7 w-12 sm:w-14" />
            ) : (
              <p className="text-lg sm:text-2xl font-black leading-none text-slate-900 dark:text-slate-100 tabular-nums">
                {item.value}
              </p>
            )}
          </div>

          <p className="hidden sm:block mt-1.5 text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 truncate leading-tight italic">
            {item.sub}
          </p>
        </div>
      ))}
    </div>
  );
};

export default AdminStatGrid;
