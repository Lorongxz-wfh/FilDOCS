import { useEffect, useRef, useState, useCallback } from "react";


const IDLE_EVENTS: (keyof WindowEventMap)[] = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "focus",
];

const LAST_ACTIVITY_KEY = "fildas_last_activity";

/**
 * Tracks user inactivity and logs them out after `timeoutMs`.
 * Shows a warning dialog `warningMs` before the timeout fires.
 */
export function useIdleTimeout(
  onTimeout: () => void,
  timeoutMs = 30 * 60 * 1000,   // 30 minutes
  warningMs = 5 * 60 * 1000,    // warn 5 min before
) {
  const [showWarning, setShowWarning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
  }, []);

  const checkIdleStatus = useCallback(() => {
    const lastActivity = parseInt(localStorage.getItem(LAST_ACTIVITY_KEY) || Date.now().toString());
    const now = Date.now();
    const diff = now - lastActivity;

    if (diff >= timeoutMs) {
      onTimeout();
      return true;
    }
    
    if (diff >= (timeoutMs - warningMs)) {
      setShowWarning(true);
    } else {
      setShowWarning(false);
    }
    return false;
  }, [timeoutMs, warningMs, onTimeout]);

  const resetTimers = useCallback(() => {
    localStorage.setItem(LAST_ACTIVITY_KEY, Date.now().toString());
    clearTimers();
    setShowWarning(false);

    warningRef.current = setTimeout(() => {
      setShowWarning(true);
    }, timeoutMs - warningMs);

    timeoutRef.current = setTimeout(() => {
      // Final double check before firing onTimeout
      if (!checkIdleStatus()) {
        resetTimers();
      }
    }, timeoutMs);
  }, [timeoutMs, warningMs, clearTimers, checkIdleStatus]);

  // Reset on any user interaction
  useEffect(() => {
    resetTimers();

    const handleInteraction = () => resetTimers();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkIdleStatus();
      }
    };

    IDLE_EVENTS.forEach((ev) => window.addEventListener(ev, handleInteraction, { passive: true }));
    window.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearTimers();
      IDLE_EVENTS.forEach((ev) => window.removeEventListener(ev, handleInteraction));
      window.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [resetTimers, clearTimers, checkIdleStatus]);

  /** Call this when user clicks "Stay logged in" */
  const stayLoggedIn = useCallback(() => {
    resetTimers();
  }, [resetTimers]);

  return { showWarning, stayLoggedIn };
}
