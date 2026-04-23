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
 * Standardized Chart Skeleton for FilDOCS.
 * Use this as the loading state for all charts to ensure consistent, premium UI transition.
 */
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
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-3 w-12" />
        </div>
      )}
      
      <div className="flex-1 relative overflow-hidden flex flex-col justify-end bg-slate-50 dark:bg-surface-600 rounded-md border border-slate-200 dark:border-surface-400 p-6">
        {/* Shimmer Area */}
        <div className="w-full flex items-end gap-3 sm:gap-5 justify-around px-2 z-10">
          {type === "bar" && (
            <>
              <Skeleton className="w-[10%] h-[45%] rounded-t-sm" />
              <Skeleton className="w-[10%] h-[75%] rounded-t-sm" />
              <Skeleton className="w-[10%] h-[55%] rounded-t-sm opacity-50" />
              <Skeleton className="w-[10%] h-[90%] rounded-t-sm" />
              <Skeleton className="w-[10%] h-[65%] rounded-t-sm" />
              <Skeleton className="w-[10%] h-[50%] rounded-t-sm opacity-50" />
              <Skeleton className="w-[10%] h-[70%] rounded-t-sm" />
              <Skeleton className="w-[10%] h-[40%] rounded-t-sm opacity-30" />
            </>
          )}
          {type === "line" && (
            <div className="absolute inset-0 flex flex-col justify-end pb-10">
               <div className="relative h-[70%] w-full overflow-hidden">
                 <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 100 100" preserveAspectRatio="none">
                   <path d="M0,80 L20,50 L40,65 L60,25 L80,45 L100,15" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-slate-300 dark:text-surface-300" />
                 </svg>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <Skeleton className="h-0.5 w-[92%] opacity-40" />
                 </div>
               </div>
               <div className="flex justify-around px-6">
                 <Skeleton className="h-2 w-10 rounded-full" />
                 <Skeleton className="h-2 w-10 rounded-full" />
                 <Skeleton className="h-2 w-10 rounded-full" />
                 <Skeleton className="h-2 w-10 rounded-full" />
               </div>
            </div>
          )}
          {(type === "pie" || type === "donut") && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`relative rounded-full border-[18px] border-slate-100 dark:border-surface-400 h-40 w-40 flex items-center justify-center ${type === "donut" ? "" : "bg-slate-50 dark:bg-surface-500"}`}>
                <div className="absolute inset-0 rounded-full border-[18px] border-t-slate-200 dark:border-t-surface-200 border-r-transparent border-b-transparent border-l-transparent animate-pulse" />
                {type === "donut" && (
                  <div className="flex flex-col items-center justify-center leading-none">
                    <Skeleton className="h-4 w-12 mb-1.5" />
                    <Skeleton className="h-2 w-8 opacity-40" />
                  </div>
                )}
              </div>
            </div>
          )}
          {type === "funnel" && (
            <div className="flex flex-col items-center gap-3 w-full max-w-md mx-auto mb-4">
              <Skeleton className="w-full h-10 rounded-sm" />
              <Skeleton className="w-[85%] h-10 rounded-sm opacity-80" />
              <Skeleton className="w-[70%] h-10 rounded-sm opacity-60" />
              <Skeleton className="w-[55%] h-10 rounded-sm opacity-40" />
              <Skeleton className="w-[40%] h-10 rounded-sm opacity-20" />
            </div>
          )}
        </div>
        
        {/* Grid lines mockup */}
        <div className="absolute inset-x-0 bottom-0 top-0 pointer-events-none flex flex-col justify-between py-10 opacity-10 px-4">
          <div className="border-t border-slate-300 dark:border-surface-300 w-full" />
          <div className="border-t border-slate-300 dark:border-surface-300 w-full" />
          <div className="border-t border-slate-300 dark:border-surface-300 w-full" />
          <div className="border-t border-slate-300 dark:border-surface-300 w-full" />
        </div>
      </div>

      {showLegend && (
        <div className="flex items-center justify-center gap-6 mt-8">
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-2 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-2 w-16 rounded-full" />
          </div>
        </div>
      )}
    </div>
  );
};

export default ChartSkeleton;
