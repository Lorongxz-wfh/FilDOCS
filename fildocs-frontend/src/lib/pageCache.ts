interface CacheEntry {
  filterKey: string;
  rows: unknown[];
  hasMore: boolean;
  cachedAt: number;
}

const _store = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 3 * 60 * 1000;

export const pageCache = {
  get<T>(id: string, filterKey: string, ttlMs = DEFAULT_TTL_MS): { rows: T[]; hasMore: boolean } | null {
    const entry = _store.get(id);
    if (!entry || entry.filterKey !== filterKey) return null;
    if (Date.now() - entry.cachedAt > ttlMs) { _store.delete(id); return null; }
    return { rows: entry.rows as T[], hasMore: entry.hasMore };
  },

  set<T>(id: string, filterKey: string, rows: T[], hasMore: boolean): void {
    _store.set(id, { filterKey, rows: rows as unknown[], hasMore, cachedAt: Date.now() });
  },

  invalidate(id: string): void {
    _store.delete(id);
  },
};
