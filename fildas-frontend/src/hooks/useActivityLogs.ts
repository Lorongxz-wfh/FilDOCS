import React from "react";
import { pageCache } from "../lib/pageCache";
import { listActivityLogs } from "../services/documents";
import type { ActivityLogItem } from "../services/types";

export type Scope = "all" | "office" | "mine";
export type Category =
  | ""
  | "workflow"
  | "request"
  | "document"
  | "user"
  | "template"
  | "profile";

export interface ActivityLogsParams {
  scope: Scope;
  category: Category;
  q: string;
  dateFrom: string;
  dateTo: string;
  sortBy: "created_at" | "event" | "label";
  sortDir: "asc" | "desc";
}

export function useActivityLogs(initialParams: Partial<ActivityLogsParams> = {}) {
  const [params, setParams] = React.useState<ActivityLogsParams>({
    scope: "all",
    category: "",
    q: "",
    dateFrom: "",
    dateTo: "",
    sortBy: "created_at",
    sortDir: "desc",
    ...initialParams,
  });

  const [qDebounced, setQDebounced] = React.useState(params.q);
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<ActivityLogItem[]>([]);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const hasMoreRef = React.useRef(true);
  const manualRefreshInProgress = React.useRef(false);
  const firstIdRef = React.useRef<number | null>(null);

  // Debounce search
  React.useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(params.q), 400);
    return () => window.clearTimeout(t);
  }, [params.q]);

  // Reset pagination on filter change
  React.useEffect(() => {
    setRows([]);
    setPage(1);
    hasMoreRef.current = true;
    setHasMore(true);
    setInitialLoading(true);
  }, [params.scope, qDebounced, params.category, params.dateFrom, params.dateTo, params.sortBy, params.sortDir]);

  // Load data
  React.useEffect(() => {
    if (manualRefreshInProgress.current) return;
    let alive = true;

    const load = async () => {
      if (!hasMoreRef.current && page > 1) return;
      
      setLoading(true);
      setError(null);
      
      try {
        const res = await listActivityLogs({
          scope: params.scope,
          q: qDebounced.trim() || undefined,
          page,
          per_page: 15, // slightly more for table density
          category: params.category || undefined,
          date_from: params.dateFrom || undefined,
          date_to: params.dateTo || undefined,
          sort_by: params.sortBy,
          sort_dir: params.sortDir,
        });

        if (!alive) return;

        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        
        const meta = res.meta ?? null;
        const more = !!(meta?.current_page && meta?.last_page && meta.current_page < meta.last_page);
        
        hasMoreRef.current = more;
        setHasMore(more);

        if (page === 1) {
          firstIdRef.current = incoming[0]?.id ?? null;
          // Cache only the first page
          const filterKey = JSON.stringify({ ...params, q: qDebounced.trim() });
          pageCache.set("activity-logs", filterKey, incoming, more);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load activity logs.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setInitialLoading(false);
      }
    };

    load();
    return () => { alive = false; };
  }, [page, params, qDebounced]);

  const refresh = React.useCallback(async (): Promise<{ changed: boolean; data: ActivityLogItem[] } | undefined> => {
    const prevFirstId = firstIdRef.current;
    manualRefreshInProgress.current = true;
    try {
      const res = await listActivityLogs({
        scope: params.scope,
        q: qDebounced.trim() || undefined,
        page: 1,
        per_page: 15,
        category: params.category || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      });
      
      const incoming = res.data ?? [];
      const newFirstId = incoming[0]?.id ?? null;
      firstIdRef.current = newFirstId;
      setRows(incoming);
      setPage(1);
      
      const meta = res.meta ?? null;
      const more = !!(meta?.current_page && meta?.last_page && meta.current_page < meta.last_page);
      hasMoreRef.current = more;
      setHasMore(more);
      
      const changed = newFirstId !== prevFirstId;
      return { changed, data: incoming };
    } catch (e: any) {
      setError(e?.message ?? "Failed to load activity logs.");
      throw e;
    } finally {
      manualRefreshInProgress.current = false;
    }
  }, [params, qDebounced]);

  const reload = () => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    setError(null);
  };

  const updateParams = (updates: Partial<ActivityLogsParams>) => {
    setParams(prev => ({ ...prev, ...updates }));
  };

  return {
    params,
    updateParams,
    rows,
    page,
    setPage,
    hasMore,
    loading,
    initialLoading,
    error,
    refresh,
    reload,
  };
}
