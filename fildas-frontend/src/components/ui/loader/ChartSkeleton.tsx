import React from "react";
import Skeleton from "./Skeleton";

interface ChartSkeletonProps {
  /** The type of chart shimmer to show */
  type?: "bar" | "line" | "pie" | "funnel" | "donut";
  /** If true, shows a legend placeholder area */
  showLegend?: boolean;
  /** If true, shows a title area */
  showTitle?: boolean;
  /** Height of the chart area */
  height?: string | number;
  /** Custom wrapper classes */
  className?: string;
}

/**
 * Standardized Chart Skeleton for FilDAS.
 * Use this as the loading state for all charts to ensure consistent, premium UI transition.
 */
const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  type = "bar",
  showLegend = true,
  showTitle = true,
  height = "250px",
  className = "",
}) => {
  return (
    <div className={`flex flex-col gap-4 ${className}`} style={{ height: typeof height === "number" ? `${height}px` : height }}>
      {showTitle && (
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-12" />
        </div>
      )}
      
      <div className="flex-1 relative overflow-hidden rounded-md border border-slate-100 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/20 p-4">
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
              <div className={`rounded-full border-[15px] border-slate-200/50 dark:border-surface-400/50 h-32 w-32 flex items-center justify-center ${type === "donut" ? "" : "bg-slate-200/50 dark:bg-surface-400/50"}`}>
                <Skeleton className="h-4 w-10 opacity-30" />
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

export default ChartSkeleton;
