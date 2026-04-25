import React from "react";
import Skeleton from "./loader/Skeleton";
import { Card, CardBody } from "./Card";

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  loading?: boolean;
  onClick?: () => void;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label,
  value,
  icon,
  iconBg,
  loading,
  onClick,
}) => (
  <Card 
    onClick={onClick}
    className={`min-h-0 ${onClick ? "cursor-pointer active:scale-[0.98] transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]" : ""}`}
  >
    <CardBody className="flex-row items-center gap-3 sm:gap-4 py-3 sm:py-4 px-4 sm:px-5">
      <div
        className={`flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-lg ${iconBg} transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`}
      >
        <span className="scale-110 sm:scale-125">{icon}</span>
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        {loading ? (
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-12 sm:h-6 sm:w-16" />
            <Skeleton className="h-2 w-20 sm:h-3 sm:w-24" />
          </div>
        ) : (
          <div className="flex flex-col">
            <p className="text-lg sm:text-2xl font-bold tabular-nums leading-tight text-slate-900 dark:text-slate-100">
              {value}
            </p>
            <p className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
              {label}
            </p>
          </div>
        )}
      </div>
    </CardBody>
  </Card>
);

export default KpiCard;
