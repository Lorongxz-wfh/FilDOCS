import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getUnreadNotificationCount, getWorkQueue } from "../services/documents";
import { listDocumentRequests, listDocumentRequestInbox } from "../services/documentRequests";
import { getUserRole, isQA } from "../lib/roleFilters";
import { useRealtimeUpdates } from "./useRealtimeUpdates";

export type NavStats = {
  notifications: number;
  workflows: number; // Absolute count
  requests: number;    // Absolute count
  total: number;       // Sum of all absolute
  workflowBadge: number; // Badge count (new since last visit)
  requestBadge: number;  // Badge count (new since last visit)
};

export function useGlobalNavStats() {
  const [stats, setStats] = useState<NavStats>({
    notifications: 0,
    workflows: 0,
    requests: 0,
    total: 0,
    workflowBadge: 0,
    requestBadge: 0,
  });

  const role = getUserRole();
  const location = useLocation();
  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);

  const fetchStats = useCallback(async () => {
    // Prevent overlapping fetches or extreme bursts (min 2s between fetches)
    if (isFetchingRef.current) return;
    const now = Date.now();
    if (now - lastFetchTimeRef.current < 2000) return;

    isFetchingRef.current = true;
    try {
      const [notifCount, queueRes, reqRes] = await Promise.all([
        getUnreadNotificationCount(),
        getWorkQueue(),
        isQA(role) 
          ? listDocumentRequests({ per_page: 1, request_status: "open" }) 
          : listDocumentRequestInbox({ per_page: 1 }),
      ]);

      const workflows = queueRes?.assigned?.length ?? 0;
      const requests = reqRes?.meta?.total ?? 0;
      
      const readWorkflows = Number(localStorage.getItem("nav_read_workflows") || 0);
      const readRequests = Number(localStorage.getItem("nav_read_requests") || 0);

      const workflowBadge = Math.max(0, workflows - readWorkflows);
      const requestBadge = Math.max(0, requests - readRequests);

      const newStats = {
        notifications: notifCount,
        workflows,
        requests,
        workflowBadge,
        requestBadge,
        total: notifCount + workflows + requests,
      };

      setStats(newStats);
      lastFetchTimeRef.current = Date.now();
    } catch (err) {
      console.error("Failed to fetch global nav stats:", err);
    } finally {
      isFetchingRef.current = false;
    }
  }, [role]);

  // Auto-clear logic: When on the relevant page, sync the readCount to currentCount
  useEffect(() => {
    const path = location.pathname;
    if (path === "/work-queue" || path === "/documents/all") {
      localStorage.setItem("nav_read_workflows", String(stats.workflows));
      setStats(prev => ({ ...prev, workflowBadge: 0 }));
    }
    if (path === "/document-requests") {
      localStorage.setItem("nav_read_requests", String(stats.requests));
      setStats(prev => ({ ...prev, requestBadge: 0 }));
    }
  }, [location.pathname, stats.workflows, stats.requests]);

  useEffect(() => {
    fetchStats();
    // Aggressive polling deprecated. WebSockets handle all pushes.
  }, [fetchStats]);

  // Real-time updates — Memoized to prevent re-join loops
  const handleNotify = useCallback(() => fetchStats(), [fetchStats]);

  useRealtimeUpdates({
    onNotification: handleNotify,
    onWorkflowUpdate: handleNotify,
    onWorkspaceChange: handleNotify,
  });

  // Also listen for a custom refresh event that notification bell might trigger
  useEffect(() => {
    window.addEventListener("notifications:refresh", handleNotify);
    window.addEventListener("page:remote-refresh", handleNotify);
    return () => {
      window.removeEventListener("notifications:refresh", handleNotify);
      window.removeEventListener("page:remote-refresh", handleNotify);
    };
  }, [handleNotify]);

  return stats;
}
