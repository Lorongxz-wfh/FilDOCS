import { useState, useCallback, useRef, useEffect } from "react";
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

  // Use a ref to store the latest reloadFn to avoid dependency loops if the parent
  // passes a non-memoized function.
  const fnRef = useRef(reloadFn);
  useEffect(() => {
    fnRef.current = reloadFn;
  }, [reloadFn]);

  const refresh = useCallback(async () => {
    // Avoid multiple concurrent refreshes
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    try {
      const result = await fnRef.current();
      
      // If result is void, show success but stay silent
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
      // Small timeout for better visual feedback of the "status" change
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [isRefreshing, toast]); // reloadFn removed from deps to prevent loops

  return { refresh, isRefreshing };
}
