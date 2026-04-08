import { getApi, dedupeFetch } from "./_base";
import type { WorkQueueResponse } from "./types";

export async function getWorkQueue(): Promise<WorkQueueResponse> {
  return dedupeFetch("work-queue", async () => {
    try {
      const api = await getApi();
      const res = await api.get("/work-queue");
      return res.data as WorkQueueResponse;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        (status
          ? `Failed to load work queue (${status})`
          : "Failed to load work queue");
      throw new Error(msg);
    }
  });
}
