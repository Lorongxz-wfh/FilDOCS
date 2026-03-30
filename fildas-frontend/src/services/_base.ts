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

export const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8001/api";

export function normalizePaginated<T>(payload: any): Paginated<T> {
  if (payload && Array.isArray(payload.data)) {
    // Laravel ResourceCollection has { data, links, meta }
    // Laravel default paginator has current_page, last_page etc. at root
    const meta = payload.meta ?? {
      current_page: payload.current_page,
      last_page: payload.last_page,
      per_page: payload.per_page,
      total: payload.total,
      from: payload.from,
      to: payload.to,
    };
    return {
      data: payload.data as T[],
      meta,
      links: payload.links,
    };
  }

  if (Array.isArray(payload)) {
    return { data: payload as T[] };
  }

  throw new Error("Invalid response format");
}

export type NotifCacheEntry = {
  etag: string | null;
  payload: Paginated<NotificationItem>;
};

export const notifCache = new Map<string, NotifCacheEntry>();

export function clearNotifCache() {
  notifCache.clear();
}

export function notifCacheKey(page: number, perPage: number) {
  return `notifications:p${page}:pp${perPage}`;
}
