import { useState, useEffect, useCallback } from "react";
import {
  getDocumentStats,
  getWorkQueue,
  listActivityLogs,
  getComplianceReport,
  getAdminDashboardStats,
  type DocumentStats,
  type WorkQueueItem,
  type ActivityLogItem,
  type ComplianceReportResponse as ComplianceReport,
  type AdminDashboardStats,
} from "../services/documents";
import { listDocumentRequests } from "../services/documentRequests";
import { isQA, type UserRole } from "../lib/roleFilters";

const emptyReport: ComplianceReport = {
  clusters: [],
  offices: [],
  series: [],
  volume_series: [],
  kpis: {
    total_created: 0,
    total_approved_final: 0,
    first_pass_yield_pct: 0,
    pingpong_ratio: 0,
    cycle_time_avg_days: 0,
  },
  stage_delays: [],
};

export type DashboardData = {
  stats: DocumentStats | null;
  pending: WorkQueueItem[];
  monitoring: WorkQueueItem[];
  recentActivity: ActivityLogItem[];
  report: ComplianceReport;
  adminStats: AdminDashboardStats | null;
  pendingRequestsCount: number;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function useDashboardData(role: UserRole): DashboardData {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [pending, setPending] = useState<WorkQueueItem[]>([]);
  const [monitoring, setMonitoring] = useState<WorkQueueItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogItem[]>([]);
  const [report, setReport] = useState<ComplianceReport>(emptyReport);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "ADMIN" || role === "SYSADMIN";

  const loadRef = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        if (isAdmin) {
          const [adminData, activityData] = await Promise.all([
            getAdminDashboardStats(),
            listActivityLogs({ scope: "all", per_page: 8 }),
          ]);
          setAdminStats(adminData);
          setRecentActivity(activityData.data ?? []);
        } else if (isQA(role)) {
          const [statsData, queueData, activityData, reportData, reqData] =
            await Promise.all([
              getDocumentStats(),
              getWorkQueue(),
              listActivityLogs({ scope: "all", per_page: 8 }),
              getComplianceReport(),
              listDocumentRequests({ per_page: 1 }),
            ]);
          setStats(statsData);
          setPending(queueData.assigned ?? []);
          setMonitoring(queueData.monitoring ?? []);
          setRecentActivity(activityData.data ?? []);
          setReport(reportData);
          setPendingRequestsCount(reqData?.meta?.total ?? 0);
        } else {
          const [statsData, queueData, activityData] = await Promise.all([
            getDocumentStats(),
            getWorkQueue(),
            listActivityLogs({ scope: "office", per_page: 8 }),
          ]);
          setStats(statsData);
          setPending(queueData.assigned ?? []);
          setMonitoring(queueData.monitoring ?? []);
          setRecentActivity(activityData.data ?? []);
        }
      } catch (e: unknown) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Failed to load stats");
        }
      } finally {
        setLoading(false);
      }
    },
    [role, isAdmin],
  );

  useEffect(() => {
    loadRef();
    const interval = window.setInterval(() => loadRef(true), 60_000);
    return () => window.clearInterval(interval);
  }, [loadRef]);

  const reload = useCallback(async () => {
    await loadRef(true);
  }, [loadRef]);

  return {
    stats,
    pending,
    monitoring,
    recentActivity,
    report,
    adminStats,
    pendingRequestsCount,
    loading,
    error,
    reload,
  };
}
