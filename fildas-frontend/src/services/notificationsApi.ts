import { getApi, normalizePaginated, notifCache, clearNotifCache, notifCacheKey, dedupeFetch } from "./_base";
import type { Paginated, NotificationItem, UnreadCountResponse } from "./types";

export async function listNotifications(params?: {
  page?: number;
  perPage?: number;
}): Promise<Paginated<NotificationItem>> {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 25;

  const key = notifCacheKey(page, perPage);
  const cached = notifCache.get(key);

  try {
    const api = await getApi();
    const res = await api.get("/notifications", {
      params: {
        page,
        per_page: perPage,
        // IMPORTANT: no `t: Date.now()` here; it defeats conditional caching
      },
      headers: cached?.etag ? { "If-None-Match": cached.etag } : undefined,
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 304,
    });

    // 304: not modified, return cached payload (must exist)
    if (res.status === 304) {
      if (cached) return cached.payload;
      // Fallback: if no cache exists, treat as empty (should be rare)
      return { data: [], meta: undefined, links: undefined };
    }

    const normalized = normalizePaginated<NotificationItem>(res.data);
    const etag =
      (res.headers?.etag as string | undefined) ??
      (res.headers?.ETag as string | undefined) ??
      null;

    notifCache.set(key, { etag, payload: normalized });
    return normalized;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load notifications (${status})`
        : "Failed to load notifications");
    throw new Error(msg);
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  return dedupeFetch("unread-count", async () => {
    try {
      const api = await getApi();
      const res = await api.get("/notifications/unread-count");
      const data = res.data as UnreadCountResponse;
      return Number(data?.unread ?? 0);
    } catch {
      return 0; // don't break UX
    }
  });
}

export async function markNotificationRead(
  notificationId: number,
): Promise<void> {
  const api = await getApi();
  await api.post(`/notifications/${notificationId}/read`);
  clearNotifCache();
}

export async function markAllNotificationsRead(): Promise<void> {
  const api = await getApi();
  await api.post("/notifications/read-all");
  clearNotifCache();
}

export async function deleteNotification(
  notificationId: number,
): Promise<void> {
  const api = await getApi();
  await api.delete(`/notifications/${notificationId}`);
  clearNotifCache();
}

export async function deleteAllNotifications(): Promise<void> {
  const api = await getApi();
  await api.delete("/notifications");
  clearNotifCache();
}
