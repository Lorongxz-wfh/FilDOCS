import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import type { AdminDashboardStats } from "../../services/documents";
import { Users, FileText, Activity } from "lucide-react";
import LiveValuePulse from "../ui/LiveValuePulse";
import { Card, CardBody } from "../ui/Card";

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
      label: "Total workflows",
      value: data?.documents.total_all_time ?? 0,
      sub: "all-time documents",
      icon: <FileText className="h-4 w-4" />,
    },
    {
      label: "Pending workflows",
      value: data?.documents.in_progress ?? 0,
      sub: "active cycles",
      icon: <Activity className="h-4 w-4" />,
    },
    {
      label: "Open requests",
      value: data?.requests?.open ?? 0,
      sub: "pending evidence",
      icon: <Activity className="h-4 w-4" />,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
      {items.map((item) => (
        <Card key={item.label} className="bg-white dark:bg-surface-500">
          <CardBody className="py-2.5 sm:px-4 sm:py-3.5 flex flex-col justify-between h-full">
            <div className="flex items-center justify-between gap-1">
              <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none truncate">
                {item.label}
              </p>
              <span className="text-slate-400 dark:text-slate-500 sm:scale-110 scale-90 shrink-0">
                {item.icon}
              </span>
            </div>

            <div className="mt-1.5 sm:mt-3">
              {loading && !data ? (
                <Skeleton className="h-5 sm:h-7 w-12 sm:w-14" />
              ) : (
                <div className="text-lg sm:text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50 leading-none h-6 sm:h-7 flex items-center">
                  <LiveValuePulse value={item.value}>
                    {item.value}
                  </LiveValuePulse>
                </div>
              )}
            </div>

            <div className="hidden sm:block mt-2 text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 truncate leading-tight font-medium uppercase tracking-tight">
              {(() => {
                if (item.label === "Total users" && data?.users.online && data.users.online > 0) {
                  return (
                    <span className="flex items-center gap-1.5">
                      {data.users.active} active 
                      <div className="h-1 w-1 rounded-full bg-slate-200 dark:bg-surface-400" />
                      <span className="text-emerald-500 font-bold">{data.users.online} online</span>
                    </span>
                  );
                }
                if (item.label === "Total workflows" && data?.documents.distributed && data.documents.distributed > 0) {
                  return (
                    <span className="text-brand-600 dark:text-brand-400 font-bold">
                      {data.documents.distributed} distributed
                    </span>
                  );
                }
                return item.sub;
              })()}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
};

export default AdminStatGrid;
