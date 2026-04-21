import { useCallback, useEffect, useRef, useState } from "react";
import { useRefresh } from "../lib/RefreshContext";

/**
 * Listens for `notifications:refresh` events and fires a burst of
 * 3 refreshes at 5-second intervals (15s total). Also exposes a
 * manual `refresh()` for the refresh button.
 */
export function usePageBurstRefresh(onRefresh: () => Promise<void> | void) {
  const [refreshing, setRefreshing] = useState(false);
  const burstRef = useRef<number | null>(null);
  const onRefreshRef = useRef(onRefresh);

  // Keep ref up to date without re-subscribing the event listener
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const stopBurst = useCallback(() => {
    if (burstRef.current) {
      window.clearInterval(burstRef.current);
      burstRef.current = null;
    }
  }, []);

  const startBurst = useCallback(() => {
    stopBurst();
    let count = 0;
    burstRef.current = window.setInterval(async () => {
      count++;
      try {
        await onRefreshRef.current();
      } catch {
        // silent
      }
      if (count >= 3) stopBurst();
    }, 5_000);
  }, [stopBurst]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefreshRef.current();
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      onRefreshRef.current();
      startBurst();
    };
    window.addEventListener("notifications:refresh", handler);
    window.addEventListener("page:remote-refresh", handler);
    return () => {
      window.removeEventListener("notifications:refresh", handler);
      window.removeEventListener("page:remote-refresh", handler);
      stopBurst();
    };
  }, [startBurst, stopBurst]);

  const { refreshKey } = useRefresh();
  const initialMountRef = useRef(true);

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    refresh();
  }, [refreshKey, refresh]);

  return { refresh, refreshing };
}
