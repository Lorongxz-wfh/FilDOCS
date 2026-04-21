import { useState, useCallback, useRef, useEffect } from "react";
import { useToastSafe } from "../components/ui/toast/ToastContext";
import { normalizeError } from "../lib/normalizeError";
import { useRefresh } from "../lib/RefreshContext";

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

  // 1. Decouple logic from ALL identities: use refs for logic-agnostic access
  // This is the "Nuclear Option" to guarantee refresh() is a static constant.
  const fnRef = useRef(reloadFn);
  const toastRef = useRef(toast);
  const isBusyRef = useRef(false);

  useEffect(() => {
    fnRef.current = reloadFn;
    toastRef.current = toast;
  }, [reloadFn, toast]);

  const refresh = useCallback(async () => {
    // 2. Guard with Ref to prevent concurrent calls without identity shuffling
    if (isBusyRef.current) return;
    
    isBusyRef.current = true;
    setIsRefreshing(true);
    
    try {
      const result = await fnRef.current();
      const t = toastRef.current;
      
      if (!result) {
        t?.push({
          type: "success",
          message: "Data synchronized.",
          durationMs: 2000,
        });
      } else if (result.message) {
        t?.push({
          type: result.changed ? "success" : "info",
          message: result.message,
          durationMs: 2500,
        });
      } else if (result.changed) {
        const deltaMsg = result.delta != null && result.delta > 0 
          ? ` — ${result.delta} new update${result.delta === 1 ? "" : "s"} found.` 
          : ".";
        t?.push({
          type: "success",
          message: `Data synchronized${deltaMsg}`,
          durationMs: 2500,
        });
      } else {
        t?.push({
          type: "info",
          message: "Data is up to date.",
          durationMs: 2000,
        });
      }
    } catch (err) {
      toastRef.current?.push({
        type: "error",
        title: "Sync Failed",
        message: normalizeError(err),
      });
    } finally {
      // 3. Cleanup
      isBusyRef.current = false;
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }, []); // ABSOLUTELY STABLE: Never changes identity.

  const { refreshKey } = useRefresh();
  const initialMountRef = useRef(true);

  // 4. Trigger on global refreshKey change
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    refresh();
  }, [refreshKey, refresh]);



  return { refresh, isRefreshing };
}
