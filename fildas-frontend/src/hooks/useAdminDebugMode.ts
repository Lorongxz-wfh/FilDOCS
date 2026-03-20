import { useState, useEffect } from "react";
import { getAuthUser } from "../lib/auth";
import { getUserRole, isSysAdmin } from "../lib/roleFilters";

/**
 * Returns true if the current user is admin/sysadmin AND has developer/debug mode
 * enabled in their preferences. Reacts to the "admin_debug_mode_changed" custom event
 * so all components stay in sync when the toggle changes in Settings.
 */
export function useAdminDebugMode(): boolean {
  const role = getUserRole();
  const isAdminUser = role === "ADMIN" || isSysAdmin(role);
  const userId = getAuthUser()?.id;
  const debugKey = `pref_debug_mode_${userId}`;

  const [debugMode, setDebugMode] = useState<boolean>(() =>
    isAdminUser ? localStorage.getItem(debugKey) === "1" : false,
  );

  useEffect(() => {
    if (!isAdminUser) return;
    const sync = () =>
      setDebugMode(localStorage.getItem(debugKey) === "1");
    window.addEventListener("admin_debug_mode_changed", sync);
    return () => window.removeEventListener("admin_debug_mode_changed", sync);
  }, [isAdminUser, debugKey]);

  return isAdminUser ? debugMode : false;
}
