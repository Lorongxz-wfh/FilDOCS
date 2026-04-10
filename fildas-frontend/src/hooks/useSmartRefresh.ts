import { useState } from "react";
import { useToastSafe } from "../components/ui/toast/ToastContext";
import { normalizeError } from "../lib/normalizeError";

export type SmartRefreshResult = {
  changed: boolean;
  message?: string;
  delta?: number;
};

/**
 * A hook to perform a background data refresh with toast feedback.
 * 
 * @param reloadFn - The async function that performs the data load.
 *                   Should return a SmartRefreshResult to indicate if data changed.
 * @returns [refresh, isRefreshing]
 */
export function useSmartRefresh(
  reloadFn: () => Promise<SmartRefreshResult | void>,
) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToastSafe();

  const refresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    try {
      const result = await reloadFn();
      
      // If result is void, show success but stay silent if not changed
      if (!result) {
        toast?.push({
          type: "success",
          message: "Page data synchronized.",
          durationMs: 2000,
        });
        return;
      }

      if (result.message) {
        toast?.push({
          type: result.changed ? "success" : "info",
          message: result.message,
          durationMs: 2500,
        });
      } else if (result.changed) {
        const deltaMsg = result.delta != null && result.delta > 0 
          ? ` (${result.delta} new updates)` 
          : "";
        toast?.push({
          type: "success",
          message: `Data synchronized${deltaMsg}.`,
          durationMs: 2500,
        });
      } else {
        toast?.push({
          type: "info",
          message: "Data is up to date.",
          durationMs: 2000,
        });
      }
    } catch (err) {
      toast?.push({
        type: "error",
        title: "Sync Failed",
        message: normalizeError(err),
      });
    } finally {
      // Ensure the spinner stays visible for a minimum natural duration
      setTimeout(() => setIsRefreshing(false), 400);
    }
    return false;
  };

  return { refresh, isRefreshing };
}
