import React from "react";

type Align = "left" | "center" | "right";

export type TableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: Align;
};

export type TableProps<T> = {
  columns: TableColumn<T>[];
  rows: T[];
  loading?: boolean;
  initialLoading?: boolean;
  error?: string | null;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  rowKey: (row: T) => string | number;
  className?: string;
  // infinite scroll
  hasMore?: boolean;
  onLoadMore?: () => void;
  // when true, no outer border/bg — for use inside existing containers
  bare?: boolean;
  // custom column widths — overrides equal repeat(n, 1fr)
  gridTemplateColumns?: string;
};

const alignClass = (align: Align | undefined) => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

export default function Table<T>({
  columns,
  rows,
  loading = false,
  initialLoading = false,
  error = null,
  emptyMessage = "No data.",
  onRowClick,
  rowKey,
  className,
  hasMore = false,
  onLoadMore,
  bare = false,
  gridTemplateColumns,
}: TableProps<T>) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // Infinite scroll observer
  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !onLoadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          onLoadMore();
        }
      },
      { root: scrollRef.current, rootMargin: "100px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loading, hasMore, onLoadMore]);

  const colCount = columns.length;
  const colTemplate =
    gridTemplateColumns ?? `repeat(${colCount}, minmax(0, 1fr))`;

  const inner = (
    <>
      {/* Sticky header */}
      <div
        className="shrink-0 grid gap-3 px-5 py-2.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-surface-400 bg-slate-50 dark:bg-surface-600"
        style={{ gridTemplateColumns: colTemplate }}
      >
        {columns.map((c) => (
          <div
            key={c.key}
            className={[alignClass(c.align), c.headerClassName ?? ""].join(" ")}
          >
            {c.header}
          </div>
        ))}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {initialLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-surface-400 px-2 py-1">
            {Array.from({ length: 10 }).map((_, r) => (
              <div
                key={r}
                className="grid gap-3 items-center px-3 py-3 rounded-lg"
                style={{ gridTemplateColumns: colTemplate }}
              >
                {columns.map((_, c) => (
                  <div
                    key={c}
                    className="h-3 rounded-full animate-pulse bg-slate-100 dark:bg-surface-400"
                    style={{ width: c === 1 ? "60%" : c === 0 ? "50%" : "75%" }}
                  />
                ))}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-4">
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-surface-400 px-2 py-1">
            {rows.map((row) => {
              const clickable = !!onRowClick;
              return (
                <div
                  key={rowKey(row)}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  className={[
                    "grid gap-3 items-center px-3 py-3 rounded-lg text-sm transition-colors group",
                    clickable
                      ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-400/60"
                      : "",
                  ].join(" ")}
                  style={{ gridTemplateColumns: colTemplate }}
                >
                  {columns.map((c) => (
                    <div
                      key={c.key}
                      className={[alignClass(c.align), c.className ?? ""].join(
                        " ",
                      )}
                    >
                      {c.render(row)}
                    </div>
                  ))}
                </div>
              );
            })}

            {/* Sentinel + bottom loader */}
            {onLoadMore && (
              <div ref={sentinelRef} className="py-3 flex justify-center">
                {loading && !initialLoading && (
                  <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                )}
                {!loading && !hasMore && rows.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    All caught up
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  if (bare) {
    return (
      <div
        className={["flex flex-col min-h-0 h-full", className ?? ""].join(" ")}
      >
        <div className="flex flex-col min-h-0 h-full overflow-x-auto">
          <div className="min-w-150 flex flex-col min-h-0 h-full">
            {inner}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex flex-col min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex flex-col min-h-0 h-full overflow-x-auto">
        <div className="min-w-150 flex flex-col min-h-0 h-full">
          {inner}
        </div>
      </div>
    </div>
  );
}
