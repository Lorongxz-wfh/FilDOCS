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

  // 1. Decouple logic from identity: use refs for identity-agnostic access
  const fnRef = useRef(reloadFn);
  const isBusyRef = useRef(false);

  useEffect(() => {
    fnRef.current = reloadFn;
  }, [reloadFn]);

  const refresh = useCallback(async () => {
    // 2. Guard with Ref to prevent concurrent calls without identity shuffling
    if (isBusyRef.current) return;
    
    isBusyRef.current = true;
    setIsRefreshing(true);
    
    try {
      const result = await fnRef.current();
      
      if (!result) {
        toast?.push({
          type: "success",
          message: "Page data synchronized.",
          durationMs: 2000,
        });
      } else if (result.message) {
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
      // 3. Cleanup
      isBusyRef.current = false;
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, [toast]); // Identity is now stable!


  return { refresh, isRefreshing };
}
