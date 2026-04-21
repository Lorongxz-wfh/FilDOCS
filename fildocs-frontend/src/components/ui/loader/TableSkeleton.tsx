import React from "react";

type Props = {
  rows?: number;
  cols?: number;
  gridTemplateColumns?: string;
  showHeader?: boolean;
  bare?: boolean; // when true, no outer border/bg wrapper — for use inside existing table containers
};

const TableSkeleton: React.FC<Props> = ({
  rows = 8,
  cols,
  gridTemplateColumns,
  showHeader = true,
  bare = false,
}) => {
  const colCount =
    cols ?? (gridTemplateColumns ? gridTemplateColumns.split(" ").length : 4);
  const colTemplate =
    gridTemplateColumns ?? `repeat(${colCount}, minmax(0, 1fr))`;

  const content = (
    <>
      {showHeader && (
        <div
          className="grid gap-3 border-b border-slate-200 bg-slate-50 px-5 py-2.5 dark:border-surface-400 dark:bg-surface-600"
          style={{ gridTemplateColumns: colTemplate }}
        >
          {Array.from({ length: colCount }).map((_, i) => (
            <div
              key={i}
              className="h-2.5 rounded-sm bg-slate-200 animate-pulse dark:bg-surface-400"
            />
          ))}
        </div>
      )}
      <div className="divide-y divide-slate-100 dark:divide-surface-400 px-2 py-1">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-3 items-center px-3 py-3 rounded-md"
            style={{ gridTemplateColumns: colTemplate }}
          >
            {Array.from({ length: colCount }).map((_, c) => (
              <div
                key={c}
                className="h-3 rounded-sm animate-pulse bg-slate-100 dark:bg-surface-400"
                style={{ width: c === 1 ? "60%" : c === 0 ? "50%" : "75%" }}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );

  if (bare) return <>{content}</>;

  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      {content}
    </div>
  );
};

export default TableSkeleton;
