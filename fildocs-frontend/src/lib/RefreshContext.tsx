import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { useToastSafe } from "../components/ui/toast/ToastContext";

interface RefreshContextType {
  refreshKey: number;
  triggerRefresh: () => void;
  isRefreshing: boolean;
}

const RefreshContext = createContext<RefreshContextType | undefined>(undefined);

export const RefreshProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const toast = useToastSafe();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerRefresh = useCallback(() => {
    // Spam protection: ignore if already refreshing
    if (isRefreshing) return;

    // Increment refresh key to trigger listeners (useSmartRefresh/useEffect)
    setRefreshKey((prev) => prev + 1);
    setIsRefreshing(true);
    
    // Immediate visual feedback
    const syncDuration = 1500;
    toast?.push({
      type: "info",
      message: "Syncing workspace data...",
      durationMs: syncDuration
    });
    
    // Clear any existing timer just in case
    if (timerRef.current) clearTimeout(timerRef.current);

    // Reset refreshing state after a short duration
    // This drives the spinning icon in the NavBar.
    // Real data loads are handled by components via refreshKey.
    timerRef.current = setTimeout(() => {
      setIsRefreshing(false);
      timerRef.current = null;
    }, syncDuration);
  }, [isRefreshing, toast]);

  return (
    <RefreshContext.Provider value={{ refreshKey, triggerRefresh, isRefreshing }}>
      {children}
    </RefreshContext.Provider>
  );
};

export const useRefresh = () => {
  const context = useContext(RefreshContext);
  if (context === undefined) {
    throw new Error("useRefresh must be used within a RefreshProvider");
  }
  return context;
};
