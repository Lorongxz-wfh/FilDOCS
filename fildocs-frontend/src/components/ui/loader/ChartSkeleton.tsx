import React from "react";
import Skeleton from "./Skeleton";
import TableSkeleton from "./TableSkeleton";

export interface ChartSkeletonProps {
  type?: "bar" | "bar-horizontal" | "line" | "pie" | "donut" | "funnel" | "table";
  showLegend?: boolean;
  showTitle?: boolean;
  height?: string | number;
  className?: string;
}

/**
 * Standardized Chart Skeleton for FilDOCS.
 * Use this as the loading state for all charts to ensure consistent, premium UI transition.
 */
export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  type = "bar",
  showLegend = false,
  showTitle = false,
  height = "250px",
  className = "",
}) => {
  return (
    <div className={`flex flex-col gap-4 w-full h-full ${className}`} style={{ height: typeof height === "number" ? `${height}px` : height }}>
      {showTitle && (
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
      )}

      <div className="flex-1 relative overflow-hidden rounded-lg border border-neutral-200/60 dark:border-surface-400 bg-neutral-50/30 dark:bg-surface-600/20 p-4">
        {/* Shimmer Area */}
        <div className="h-full w-full flex items-end gap-3 justify-around pt-4">
          {type === "bar" && (
            <>
              <Skeleton className="w-[12%] h-[40%]" />
              <Skeleton className="w-[12%] h-[70%]" />
              <Skeleton className="w-[12%] h-[50%]" />
              <Skeleton className="w-[12%] h-[85%]" />
              <Skeleton className="w-[12%] h-[60%]" />
              <Skeleton className="w-[12%] h-[45%]" />
            </>
          )}
          {type === "bar-horizontal" && (
            <div className="w-full flex flex-col gap-3 justify-center">
              <Skeleton className="h-4 w-[40%]" />
              <Skeleton className="h-4 w-[70%]" />
              <Skeleton className="h-4 w-[50%]" />
              <Skeleton className="h-4 w-[85%]" />
              <Skeleton className="h-4 w-[60%]" />
            </div>
          )}
          {type === "line" && (
            <div className="absolute inset-0 flex items-center justify-center">
               <Skeleton className="h-[2px] w-full rotate-[-15deg] opacity-20" />
               <Skeleton className="h-full w-[2px] absolute left-10" />
               <div className="absolute bottom-10 left-0 right-0 flex justify-around px-10">
                 <Skeleton className="h-2 w-10" />
                 <Skeleton className="h-2 w-10" />
                 <Skeleton className="h-2 w-10" />
               </div>
            </div>
          )}
          {(type === "pie" || type === "donut") && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`rounded-full border-[12px] border-neutral-200/50 dark:border-surface-400/50 h-24 w-24 flex items-center justify-center ${type === "donut" ? "" : "bg-neutral-200/40 dark:bg-surface-400/40"}`}>
                <Skeleton className="h-3 w-8 opacity-20" />
              </div>
            </div>
          )}
          {type === "funnel" && (
            <div className="flex flex-col items-center gap-1.5 w-full">
              <Skeleton className="w-[80%] h-8" />
              <Skeleton className="w-[60%] h-8" />
              <Skeleton className="w-[45%] h-8" />
              <Skeleton className="w-[30%] h-8" />
            </div>
          )}
          {type === "table" && (
            <div className="w-full h-full absolute inset-0 py-2">
              <TableSkeleton bare={true} />
            </div>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="flex items-center justify-center gap-4 py-2">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-2 w-12" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-2 w-12" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-2 w-12" />
          </div>
        </div>
      )}
    </div>
  );
};


