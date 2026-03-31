import React from "react";

type Align = "left" | "center" | "right";

export type TableColumn<T> = {
  key: string;
  header: React.ReactNode;
  render: (row: T) => React.ReactNode;
  className?: string;
  headerClassName?: string;
  align?: Align;
  /**
   * Hint for how to render the skeleton cell while initialLoading.
   * badge   — pill shape (status/type badges)
   * double  — two stacked lines (title + subtitle)
   * narrow  — short single line (date/code/version)
   * text    — regular single line (default)
   */
  skeletonShape?: "badge" | "double" | "narrow" | "text";
  /** If set, this column header becomes clickable for sorting. Value is the sort_by key sent to the API. */
  sortKey?: string;
};

export type SortDir = "asc" | "desc";

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
  // sorting
  sortBy?: string;
  sortDir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;
  /** Optional custom renderer for mobile card view. If provided, table hides on mobile and shows these cards instead. */
  mobileRender?: (row: T) => React.ReactNode;
};

const alignClass = (align: Align | undefined) => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

const SortIcon = ({
  active,
  dir,
}: {
  active: boolean;
  dir: SortDir;
}) => (
  <span className="inline-flex flex-col justify-center ml-1 gap-[2px]">
    <svg
      width="6"
      height="4"
      viewBox="0 0 6 4"
      className={
        active && dir === "asc"
          ? "text-slate-700 dark:text-slate-200"
          : "text-slate-300 dark:text-slate-600"
      }
    >
      <path d="M3 0L6 4H0L3 0Z" fill="currentColor" />
    </svg>
    <svg
      width="6"
      height="4"
      viewBox="0 0 6 4"
      className={
        active && dir === "desc"
          ? "text-slate-700 dark:text-slate-200"
          : "text-slate-300 dark:text-slate-600"
      }
    >
      <path d="M3 4L0 0H6L3 4Z" fill="currentColor" />
    </svg>
  </span>
);

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
  onSortChange,
  sortBy = "",
  sortDir = "desc" as SortDir,
  mobileRender,
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
      {/* Sticky header — hidden if mobileRender is active on small screen */}
      <div
        className={`shrink-0 grid gap-3 px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 ${mobileRender ? "hidden sm:grid" : "grid"}`}
        style={{ gridTemplateColumns: colTemplate }}
      >
        {columns.map((c) => {
          const isSortable = !!c.sortKey && !!onSortChange;
          const isActive = isSortable && sortBy === c.sortKey;
          const nextDir: SortDir =
            isActive && sortDir === "desc" ? "asc" : "desc";

          if (isSortable) {
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSortChange!(c.sortKey!, nextDir)}
                className={[
                  "inline-flex items-center gap-0.5 transition-colors select-none",
                  alignClass(c.align),
                  c.headerClassName ?? "",
                  isActive
                    ? "text-slate-700 dark:text-slate-200"
                    : "hover:text-slate-700 dark:hover:text-slate-200",
                ].join(" ")}
              >
                {c.header}
                <SortIcon active={isActive} dir={isActive ? sortDir : "desc"} />
              </button>
            );
          }

          return (
            <div
              key={c.key}
              className={[alignClass(c.align), c.headerClassName ?? ""].join(
                " ",
              )}
            >
              {c.header}
            </div>
          );
        })}
      </div>

      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {initialLoading ? (
          <div className="divide-y divide-slate-200 dark:divide-surface-400">
            {Array.from({ length: 10 }).map((_, r) => (
              <div
                key={r}
                className={`grid gap-3 items-center px-4 py-3 sm:py-2 ${mobileRender ? "flex flex-col items-start sm:grid" : "grid"}`}
                style={mobileRender ? undefined : { gridTemplateColumns: colTemplate }}
              >
                {columns.slice(0, mobileRender ? 3 : columns.length).map((col, c) => {
                  const shape = col.skeletonShape ?? "text";
                  const base =
                    "animate-pulse rounded bg-slate-100 dark:bg-surface-400";
                  // vary widths across rows so it doesn't look like a grid
                  const textWidths = ["72%", "58%", "80%", "64%", "75%"];
                  if (shape === "badge") {
                    return (
                      <div
                        key={c}
                        className={`${base} rounded-full h-5`}
                        style={{ width: `${56 + (r % 3) * 12}px` }}
                      />
                    );
                  }
                  if (shape === "double") {
                    return (
                      <div key={c} className="flex flex-col gap-1.5 w-full">
                        <div
                          className={`${base} h-3`}
                          style={{ width: textWidths[r % textWidths.length] }}
                        />
                        <div
                          className={`${base} h-2`}
                          style={{ width: `${36 + (r % 4) * 8}%` }}
                        />
                      </div>
                    );
                  }
                  if (shape === "narrow") {
                    return (
                      <div
                        key={c}
                        className={`${base} h-3`}
                        style={{ width: `${48 + (r % 3) * 10}%` }}
                      />
                    );
                  }
                  return (
                    <div
                      key={c}
                      className={`${base} h-3`}
                      style={{ width: textWidths[(c + r) % textWidths.length] }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-4">
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            {emptyMessage}
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-surface-400">
            {rows.map((row) => {
              const clickable = !!onRowClick;
              const key = rowKey(row);
              
              // Mobile Card view
              if (mobileRender) {
                return (
                  <div key={key}>
                    <div className="block sm:hidden">
                      {mobileRender(row)}
                    </div>
                    <div
                      onClick={clickable ? () => onRowClick?.(row) : undefined}
                      className={[
                        "hidden sm:grid gap-3 items-center px-4 py-2 rounded-none text-sm transition-colors group",
                        clickable
                          ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-surface-400/60"
                          : "",
                      ].join(" ")}
                      style={{ gridTemplateColumns: colTemplate }}
                    >
                      {columns.map((c) => (
                        <div
                          key={c.key}
                          className={[alignClass(c.align), c.className ?? ""].join(" ")}
                        >
                          {c.render(row)}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }

              // Standard Table view
              return (
                <div
                  key={key}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  className={[
                    "grid gap-3 items-center px-4 py-2 rounded-none text-sm transition-colors group",
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
                  <div className="h-5 w-5 rounded-full border-2 border-slate-200 dark:border-surface-400 border-t-sky-600 animate-spin" />
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
          <div className="min-w-150 flex flex-col min-h-0 h-full">{inner}</div>
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
        <div className="min-w-150 flex flex-col min-h-0 h-full">{inner}</div>
      </div>
    </div>
  );
}
