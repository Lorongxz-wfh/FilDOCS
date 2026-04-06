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
  const lastFetchRef = useRef(0);


  const fetchStats = useCallback(async () => {
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
      
      // Get last read counts from storage
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
      lastFetchRef.current = Date.now();
    } catch (err) {
      console.error("Failed to fetch global nav stats:", err);
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
    // Aggressive polling: 30 seconds
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  // Real-time updates
  useRealtimeUpdates({
    onNotification: () => fetchStats(),
    onWorkflowUpdate: () => fetchStats(),
    onWorkspaceChange: () => fetchStats(),
  });

  // Also listen for a custom refresh event that notification bell might trigger
  useEffect(() => {
    const handleRefresh = () => fetchStats();
    window.addEventListener("notifications:refresh", handleRefresh);
    window.addEventListener("page:remote-refresh", handleRefresh);
    return () => {
      window.removeEventListener("notifications:refresh", handleRefresh);
      window.removeEventListener("page:remote-refresh", handleRefresh);
    };
  }, [fetchStats]);

  return stats;
}
