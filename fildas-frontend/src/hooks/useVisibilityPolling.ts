import { useCallback, useEffect, useRef } from "react";

/**
 * Runs `callback` on a repeating interval, but only when the tab is visible.
 * When the tab becomes visible again, fires `callback` immediately (catch-up).
 *
 * @param callback  The function to call on each poll tick.
 * @param intervalMs  How often to poll while visible (default: 10_000).
 * @param enabled  Set to false to pause polling entirely (default: true).
 */
export function useVisibilityPolling(
  callback: () => void,
  intervalMs: number = 10_000,
  enabled: boolean = true,
) {
  const callbackRef = useRef(callback);
  const intervalRef = useRef<number | null>(null);

  // Always keep callbackRef current so intervals don't close over stale callbacks
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const stop = useCallback(() => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    intervalRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        callbackRef.current();
      }
    }, intervalMs);
  }, [intervalMs, stop]);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    start();

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Tab came back — fire immediately then restart interval
        callbackRef.current();
        start();
      } else {
        // Tab hidden — stop interval to avoid wasted requests
        stop();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, start, stop]);
}
