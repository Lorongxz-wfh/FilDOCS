import { getApi, normalizePaginated } from "./_base";
import type { Paginated, ActivityLogItem } from "./types";

export async function listActivityLogs(params: {
  scope?: "office" | "mine" | "document" | "all";
  document_id?: number;
  document_version_id?: number;
  per_page?: number;
  page?: number;

  // filters
  q?: string;
  event?: string;
  office_id?: number;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  category?: "workflow" | "request" | "document" | "user" | "template" | "profile";
}): Promise<Paginated<ActivityLogItem>> {
  try {
    const api = await getApi();
    const res = await api.get("/activity", {
      params: {
        scope: params.scope ?? "office",
        document_id: params.document_id,
        document_version_id: params.document_version_id,
        per_page: params.per_page ?? 25,
        page: params.page ?? 1,

        q: params.q,
        event: params.event,
        office_id: params.office_id,
        date_from: params.date_from,
        date_to: params.date_to,
        category: params.category,
      },
    });

    return normalizePaginated<ActivityLogItem>(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load activity logs (${status})`
        : "Failed to load activity logs");
    throw new Error(msg);
  }
}
