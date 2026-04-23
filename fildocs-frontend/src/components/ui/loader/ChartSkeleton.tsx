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
};

const ChartSkeleton: React.FC<ChartSkeletonProps> = ({
  type = "bar",
  showLegend = false,
  showTitle = false,
  height = "200px",
  className = "",
}) => {
  return (
    <div 
      className={`flex flex-col w-full h-full ${className}`} 
      style={{ height: typeof height === "number" ? `${height}px` : height }}
    >
      {showTitle && (
        <div className="flex items-center justify-between mb-4 px-1">
          <Skeleton className="h-4 w-32 rounded-full" />
          <Skeleton className="h-4 w-8 rounded-full opacity-40" />
        </div>
      )}
      
      <div className="flex-1 relative overflow-hidden flex flex-col justify-end bg-slate-50/20 dark:bg-surface-600/10 rounded-md border border-slate-100/50 dark:border-surface-400/20 p-4">
        {/* Shimmer Area */}
        <div className="w-full flex items-end gap-2 sm:gap-4 justify-around px-2 z-10">
          {type === "bar" && (
            <>
              <Skeleton className="w-[8%] h-[35%] rounded-t-sm" />
              <Skeleton className="w-[8%] h-[65%] rounded-t-sm" />
              <Skeleton className="w-[8%] h-[45%] rounded-t-sm opacity-60" />
              <Skeleton className="w-[8%] h-[80%] rounded-t-sm" />
              <Skeleton className="w-[8%] h-[55%] rounded-t-sm" />
              <Skeleton className="w-[8%] h-[40%] rounded-t-sm opacity-60" />
              <Skeleton className="w-[8%] h-[60%] rounded-t-sm" />
              <Skeleton className="w-[8%] h-[30%] rounded-t-sm opacity-40" />
            </>
          )}

          {type === "line" && (
            <div className="absolute inset-0 flex flex-col justify-end pb-8">
               <div className="relative h-[60%] w-full overflow-hidden">
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-px w-[90%] bg-slate-200 dark:bg-surface-300 opacity-30" />
                 </div>
                 <div className="absolute inset-0 flex items-center justify-around px-8">
                    <Skeleton className="h-3 w-3 rounded-full" />
                    <Skeleton className="h-3 w-3 rounded-full opacity-60 translate-y-4" />
                    <Skeleton className="h-3 w-3 rounded-full opacity-40 -translate-y-4" />
                    <Skeleton className="h-3 w-3 rounded-full opacity-60" />
                 </div>
               </div>
               <div className="flex justify-around px-4">
                 <Skeleton className="h-1.5 w-8 rounded-full opacity-40" />
                 <Skeleton className="h-1.5 w-8 rounded-full opacity-40" />
                 <Skeleton className="h-1.5 w-8 rounded-full opacity-40" />
                 <Skeleton className="h-1.5 w-8 rounded-full opacity-40" />
               </div>
            </div>
          )}

          {(type === "pie" || type === "donut") && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`relative rounded-full border-[14px] border-slate-200/20 dark:border-surface-300/10 h-32 w-32 flex items-center justify-center ${type === "donut" ? "" : "bg-slate-200/10 dark:bg-surface-300/5"}`}>
                <div className="absolute inset-0 rounded-full border-[14px] border-t-slate-300 dark:border-t-surface-200 border-r-transparent border-b-transparent border-l-transparent animate-pulse" />
                {type === "donut" && <div className="h-16 w-16 rounded-full bg-slate-50/5 dark:bg-surface-600/5 shadow-inner" />}
              </div>
            </div>
          )}

          {type === "funnel" && (
            <div className="flex flex-col items-center gap-2 w-full max-w-sm mx-auto">
              <Skeleton className="w-full h-8 rounded-sm opacity-80" />
              <Skeleton className="w-[80%] h-8 rounded-sm opacity-60" />
              <Skeleton className="w-[60%] h-8 rounded-sm opacity-40" />
              <Skeleton className="w-[40%] h-8 rounded-sm opacity-20" />
            </div>
          )}
        </div>
        
        {/* Grid lines mockup */}
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none flex flex-col justify-between py-6 opacity-[0.03] dark:opacity-[0.05]">
          <div className="border-t border-current w-full" />
          <div className="border-t border-current w-full" />
          <div className="border-t border-current w-full" />
          <div className="border-t border-current w-full" />
        </div>
      </div>

      {showLegend && (
        <div className="flex items-center justify-center gap-4 mt-6">
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-1.5 w-10 rounded-full opacity-50" />
          </div>
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-1.5 w-1.5 rounded-full" />
            <Skeleton className="h-1.5 w-10 rounded-full opacity-50" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartSkeleton;
