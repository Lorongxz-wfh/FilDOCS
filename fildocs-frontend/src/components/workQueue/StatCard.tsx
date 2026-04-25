import React from "react";
import Skeleton from "../ui/loader/Skeleton";
import { Card, CardBody } from "../ui/Card";
import LiveValuePulse from "../ui/LiveValuePulse";

interface StatCardProps {
  label: string;
  value: string | number | null;
  loading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, loading }) => (
  <Card className="flex-1">
    <CardBody className="py-3 sm:py-3.5 px-4">
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
        {label}
      </p>
      <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none h-6 sm:h-7 flex items-center">
        {loading ? (
          <Skeleton className="h-5 w-10 sm:h-6 sm:w-14" />
        ) : (
          <LiveValuePulse value={value ?? 0}>
            {value ?? 0}
          </LiveValuePulse>
        )}
      </div>
    </CardBody>
  </Card>
);

export default StatCard;
