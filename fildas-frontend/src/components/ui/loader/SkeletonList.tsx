import React from "react";
import Skeleton from "./Skeleton";

type Props = {
  count?: number;
  rows?: number; // Alias for count
  variant?: "simple" | "card" | "activity" | "document" | "text" | "comments";
  rowClassName?: string; // only applies to 'simple' variant
  className?: string;    // applies to the container
};

const SkeletonList: React.FC<Props> = ({
  count,
  rows,
  variant = "simple",
  rowClassName = "h-10",
  className = "space-y-4",
}) => {
  const finalCount = count ?? rows ?? 3;
  return (
    <div className={["animate-pulse", className].join(" ")}>
      {Array.from({ length: finalCount }).map((_, i) => {
        if (variant === "card") {
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-md border border-slate-200 bg-white p-3 sm:px-4 sm:py-3 dark:border-surface-400 dark:bg-surface-500"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <Skeleton
                  className="h-3.5 rounded-sm"
                  style={{ width: `${60 + (i % 3) * 15}%` }}
                />
                <div className="flex items-center gap-2">
                  <Skeleton className="h-2.5 w-24 opacity-60" />
                  <Skeleton className="h-4 w-16 rounded-full opacity-40 shrink-0" />
                </div>
              </div>
              <Skeleton className="h-5 w-20 shrink-0 rounded-full opacity-30" />
            </div>
          );
        }

        if (variant === "activity") {
          return (
            <div key={i} className="w-full flex flex-col gap-1.5 px-3 py-2.5">
              <Skeleton 
                className="h-3 w-3/4" 
                style={{ width: `${65 + (i % 3) * 10}%` }}
              />
              <div className="flex items-center justify-between gap-4">
                <Skeleton className="h-2.5 w-20 opacity-50" />
                <Skeleton className="h-2 w-12 opacity-30 shrink-0" />
              </div>
            </div>
          );
        }

        if (variant === "document") {
          return (
            <div key={i} className="mb-4 last:mb-0 pb-4 last:pb-0 border-b last:border-0 border-slate-50 dark:border-surface-400/50 space-y-3">
              <div className="flex justify-between items-start">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-5 w-16 rounded-full opacity-40" />
              </div>
              <div className="flex gap-4">
                <Skeleton className="h-3 w-24 opacity-50" />
                <Skeleton className="h-3 w-32 opacity-50" />
              </div>
            </div>
          );
        }

        if (variant === "comments") {
          const isMine = i % 2 === 1;
          const widths = ["w-1/2", "w-2/5", "w-2/3", "w-1/3", "w-3/5"];
          const bubbleWidth = widths[i % widths.length];
          return (
            <div key={i} className={["flex items-start gap-2 py-1", isMine ? "justify-end" : "justify-start"].join(" ")}>
              {!isMine && <Skeleton className="h-7 w-7 rounded-full shrink-0 opacity-40" />}
              <div className={["flex flex-col gap-1.5", isMine ? "items-end" : "items-start"].join(" ")}>
                 <div className="flex items-center gap-1.5">
                    <Skeleton className="h-2.5 w-16 opacity-30" />
                    <Skeleton className="h-2.5 w-12 opacity-20" />
                 </div>
                 <Skeleton 
                  className={["h-9 rounded-xl", bubbleWidth, isMine ? "rounded-tr-none" : "rounded-tl-none"].join(" ")} 
                 />
              </div>
              {isMine && <Skeleton className="h-7 w-7 rounded-full shrink-0 opacity-40 ml-1" />}
            </div>
          );
        }

        if (variant === "text") {
          return (
            <div key={i} className="space-y-2">
               <Skeleton className="h-4 w-32" />
               <Skeleton className="h-3 w-48 opacity-60" />
            </div>
          );
        }

        return <Skeleton key={i} className={rowClassName} />;
      })}
    </div>
  );
};

export default SkeletonList;
