import React, { useMemo } from "react";
import EmptyState from "./EmptyState";
import Skeleton from "./loader/Skeleton";

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
   * circle  — small circle (activity indicator)
   */
  skeletonShape?: "badge" | "double" | "narrow" | "text" | "circle";
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
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T, index: number) => string | number;
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

  // Row selection
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onToggleRow?: (id: string | number) => void;
  onToggleAll?: () => void;
};

const alignClass = (align: Align | undefined) => {
  if (align === "center") return "text-center";
  if (align === "right") return "text-right";
  return "text-left";
};

const alignHeaderClass = (align: Align | undefined) => {
  if (align === "center") return "justify-center text-center";
  if (align === "right") return "justify-end text-right";
  return "justify-start text-left";
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
          ? "text-neutral-700 dark:text-surface-100"
          : "text-neutral-300 dark:text-surface-300"
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
          ? "text-neutral-700 dark:text-surface-100"
          : "text-neutral-300 dark:text-surface-300"
      }
    >
      <path d="M3 4L0 0H6L3 4Z" fill="currentColor" />
    </svg>
  </span>
);

const Checkbox = ({
  checked,
  onChange,
  indeterminate,
}: {
  checked: boolean;
  onChange: () => void;
  indeterminate?: boolean;
}) => {
  const ref = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = !!indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer dark:bg-surface-400 dark:border-surface-300 transition-all duration-200"
    />
  );
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
  onSortChange,
  sortBy = "",
  sortDir = "desc" as SortDir,
  mobileRender,
  emptyState,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
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
  
  const finalTemplate = selectable ? `44px ${colTemplate}` : colTemplate;

  const isAllSelected = useMemo(() => {
    if (!selectable || rows.length === 0) return false;
    return rows.every(r => selectedIds?.has(rowKey(r, 0)));
  }, [selectable, rows, selectedIds, rowKey]);

  const isSomeSelected = useMemo(() => {
    if (!selectable || rows.length === 0) return false;
    return !isAllSelected && rows.some(r => selectedIds?.has(rowKey(r, 0)));
  }, [selectable, rows, selectedIds, rowKey, isAllSelected]);

  const inner = (
    <>
      {/* Scrollable body */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto">
        {/* Sticky header — hidden if mobileRender is active on small screen */}
        <div
          className={`sticky top-0 z-20 shrink-0 grid gap-3 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 border-b border-neutral-200 dark:border-surface-400 bg-neutral-50 dark:bg-surface-500 ${mobileRender ? "hidden sm:grid" : "grid"}`}
          style={{ gridTemplateColumns: finalTemplate }}
        >
          {selectable && (
            <div className="flex items-center justify-center">
              <Checkbox 
                checked={isAllSelected}
                indeterminate={isSomeSelected}
                onChange={() => onToggleAll?.()}
              />
            </div>
          )}
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
                    "flex w-full items-center gap-1 transition-colors select-none",
                    alignHeaderClass(c.align),
                    c.headerClassName ?? "",
                    isActive
                      ? "text-neutral-900 dark:text-surface-50"
                      : "hover:text-neutral-900 dark:hover:text-surface-50",
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
                className={[
                  "flex w-full items-center min-w-0 overflow-hidden",
                  alignHeaderClass(c.align),
                  c.headerClassName ?? "",
                ].join(" ")}
              >
                {c.header}
              </div>
            );
          })}
        </div>

        {initialLoading ? (
          <div className="divide-y divide-neutral-200 dark:divide-surface-400">
            {Array.from({ length: 15 }).map((_, r) => (
              <div
                key={r}
                className={`grid gap-3 items-center px-4 py-3 sm:py-2 ${mobileRender ? "flex flex-col items-start sm:grid" : "grid"}`}
                style={{ gridTemplateColumns: finalTemplate }}
              >
                {selectable && <div className="hidden sm:block" />}
                {columns.map((col, c) => {
                  const shape = col.skeletonShape ?? "text";
                  
                  // Alignment logic for skeleton container
                  const cellAlign = col.align === "center" ? "justify-center" : col.align === "right" ? "justify-end" : "justify-start";
                  
                  let skeletonElement: React.ReactNode;

                  if (shape === "badge") {
                    skeletonElement = (
                      <Skeleton
                        className="rounded h-5"
                        style={{ width: `${60 + (r % 3) * 10}%`, maxWidth: '80px' }}
                      />
                    );
                  } else if (shape === "double") {
                    skeletonElement = (
                      <div className="flex flex-col gap-1.5 w-full">
                        <Skeleton
                          className="h-3.5"
                          style={{ width: `${85 + (r % 2) * 5}%` }}
                        />
                        <Skeleton
                          className="h-2.5 opacity-60"
                          style={{ width: `${60 + (r % 4) * 8}%` }}
                        />
                      </div>
                    );
                  } else if (shape === "circle") {
                    skeletonElement = (
                      <Skeleton
                        className="rounded-full h-2 w-2"
                      />
                    );
                  } else if (shape === "narrow") {
                    skeletonElement = (
                      <Skeleton
                        className="h-3"
                        style={{ width: `${70 + (r % 2) * 10}%`, maxWidth: '90px' }}
                      />
                    );
                  } else {
                    skeletonElement = (
                      <Skeleton
                        className="h-3.5"
                        style={{ width: `${80 + ((c + r) % 3) * 8}%` }}
                      />
                    );
                  }

                  return (
                    <div 
                      key={c} 
                      className={[
                        "flex w-full min-w-0 items-center px-1",
                        cellAlign,
                        // hide extra columns on mobile if using card view
                        mobileRender && c >= (columns.length > 3 ? 3 : columns.length) ? "hidden sm:flex" : "flex"
                      ].join(" ")}
                    >
                      {skeletonElement}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-4">
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          </div>
        ) : rows.length === 0 ? (
          emptyState ?? (
            <EmptyState
              label={emptyMessage}
              isSearch={
                !!emptyMessage &&
                (emptyMessage.toLowerCase().includes("search") ||
                  emptyMessage.toLowerCase().includes("filter"))
              }
            />
          )
        ) : (
          <div className="divide-y divide-neutral-200/60 dark:divide-surface-400/50">
            {rows.map((row, idx) => {
              const clickable = !!onRowClick;
              const key = rowKey(row, idx);
              
              // Mobile Card view
              if (mobileRender) {
                return (
                  <div key={key}>
                    <div 
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => onRowClick?.(row) : undefined}
                      onKeyDown={clickable ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick?.(row);
                        }
                      } : undefined}
                      className={[
                        "block sm:hidden transition-colors border-b border-neutral-100 dark:border-surface-400/50 bg-white dark:bg-surface-500",
                        clickable ? "cursor-pointer active:bg-neutral-50 dark:active:bg-surface-400/60" : ""
                      ].join(" ")}
                    >
                      {mobileRender(row)}
                    </div>
                    <div
                      role={clickable ? "button" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? () => onRowClick?.(row) : undefined}
                      onKeyDown={clickable ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onRowClick?.(row);
                        }
                      } : undefined}
                      className={[
                        "hidden sm:grid gap-3 items-center px-4 py-2.5 rounded-none text-sm transition-colors group",
                        clickable
                          ? "cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-surface-400/40"
                          : "",
                        selectedIds?.has(key) ? "bg-brand-50/40 dark:bg-brand-900/10" : ""
                      ].join(" ")}
                      style={{ gridTemplateColumns: finalTemplate }}
                    >
                      {selectable && (
                        <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                          <Checkbox 
                            checked={selectedIds?.has(key) ?? false}
                            onChange={() => onToggleRow?.(key)}
                          />
                        </div>
                      )}
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

              const isSelected = selectedIds?.has(key) ?? false;

              // Standard Table view
              return (
                <div
                  key={key}
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  onClick={clickable ? () => onRowClick?.(row) : undefined}
                  onKeyDown={clickable ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onRowClick?.(row);
                    }
                  } : undefined}
                  className={[
                    "grid gap-3 items-center px-4 py-2.5 rounded-none text-sm transition-colors group",
                    clickable
                      ? "cursor-pointer hover:bg-neutral-50/80 dark:hover:bg-surface-400/40"
                      : "",
                    isSelected ? "bg-brand-50/40 dark:bg-brand-900/10" : ""
                  ].join(" ")}
                  style={{ gridTemplateColumns: finalTemplate }}
                >
                  {selectable && (
                    <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox 
                        checked={isSelected}
                        onChange={() => onToggleRow?.(key)}
                      />
                    </div>
                  )}
                  {columns.map((c) => (
                    <div
                      key={c.key}
                      className={[
                        "min-w-0 overflow-hidden",
                        alignClass(c.align), 
                        c.className ?? ""
                      ].join(" ")}
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
                  <div className="h-5 w-5 rounded-full border-2 border-neutral-200 dark:border-surface-400 border-t-brand-600 animate-spin" />
                )}
                {!loading && !hasMore && rows.length > 0 && (
                  <span className="text-xs text-neutral-400 dark:text-neutral-400/60 font-medium">
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
        <div className="flex-1 overflow-x-auto">
          <div className="w-full flex flex-col min-h-0 h-full">{inner}</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "flex flex-col min-h-0 overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-surface-400 dark:bg-surface-500",
        className ?? "",
      ].join(" ")}
    >
      <div className="flex-1 overflow-x-auto">
        <div className="w-full flex flex-col min-h-0 h-full">{inner}</div>
      </div>
    </div>
  );
}
