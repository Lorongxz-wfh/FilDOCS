// Internal shared infrastructure — not exported publicly from the barrel.
// Each domain file imports directly from "./_base".

import type { NotificationItem } from "./types";
import type { Paginated } from "./types";

// NOTE: api is dynamically imported to keep it out of the login/initial bundle.
let apiPromise: Promise<typeof import("./api")> | null = null;

type ApiClient = (typeof import("./api"))["default"];

export async function getApi(): Promise<ApiClient> {
  if (!apiPromise) apiPromise = import("./api");
  const mod = await apiPromise;
  return mod.default;
}

import { API_BASE } from "./config";
export { API_BASE };

export function normalizePaginated<T>(payload: any): Paginated<T> {
  const emptyMeta = { current_page: 1, last_page: 1, per_page: 25, total: 0 };
  const emptyLinks = { first: null, last: null, prev: null, next: null };

  if (!payload) return { data: [], meta: emptyMeta, links: emptyLinks };

  const data = payload.data || payload.items || payload.results || payload.messages || (Array.isArray(payload) ? payload : null);

  if (Array.isArray(data)) {
    const meta = payload.meta ?? {
      current_page: payload.current_page ?? 1,
      last_page: payload.last_page ?? 1,
      per_page: payload.per_page ?? 25,
      total: payload.total ?? 0,
      from: payload.from,
      to: payload.to,
    };
    return {
      data: data as T[],
      meta: meta,
      links: payload.links ?? emptyLinks,
    };
  }

  if (typeof payload === "object" && (payload.id || payload.event || payload.message)) {
    return { data: [payload] as T[], meta: emptyMeta, links: emptyLinks };
  }

  return { data: [], meta: emptyMeta, links: emptyLinks };
}

export type NotifCacheEntry = {
  etag: string | null;
  payload: Paginated<NotificationItem>;
};

export const notifCache = new Map<string, NotifCacheEntry>();

export function clearNotifCache() {
  notifCache.clear();
}

export const notifCacheKey = (page: number, perPage: number) => `notifications:p${page}:pp${perPage}`;

/**
 * Simple in-flight request de-duplicator. 
 * Prevents "waterfall floods" when multiple components (Sidebar, Dashboard, Mobile nav) 
 * all fire the same stats/queue request within the same 500ms window.
 */
const inFlight = new Map<string, Promise<any>>();

export async function dedupeFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing;

  const promise = fetcher().finally(() => {
    // Keep the dedupe window open for a tiny bit to catch rapid re-renders
    setTimeout(() => inFlight.delete(key), 500);
  });
  
  inFlight.set(key, promise);
  return promise;
}
