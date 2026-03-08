import { useState, useEffect } from "react";
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
  loading: boolean;
  error: string | null;
};

export function useDashboardData(role: UserRole): DashboardData {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [pending, setPending] = useState<WorkQueueItem[]>([]);
  const [monitoring, setMonitoring] = useState<WorkQueueItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogItem[]>([]);
  const [report, setReport] = useState<ComplianceReport>(emptyReport);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = role === "ADMIN" || role === "SYSADMIN";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        if (isAdmin) {
          // Admin: only needs admin stats + activity
          const [adminData, activityData] = await Promise.all([
            getAdminDashboardStats(),
            listActivityLogs({ scope: "all", per_page: 8 }),
          ]);
          if (cancelled) return;
          setAdminStats(adminData);
          setRecentActivity(activityData.data ?? []);
        } else {
          // QA + Office: document-focused data
          const scope = isQA(role) ? "all" : "office";
          const promises: Promise<unknown>[] = [
            getDocumentStats(),
            getWorkQueue(),
            listActivityLogs({ scope, per_page: 8 }),
          ];
          if (isQA(role)) promises.push(getComplianceReport());

          const results = await Promise.all(promises);
          if (cancelled) return;

          const [statsData, queueData, activityData, reportData] = results as [
            DocumentStats,
            { assigned: WorkQueueItem[]; monitoring: WorkQueueItem[] },
            { data: ActivityLogItem[] },
            ComplianceReport | undefined,
          ];

          setStats(statsData);
          setPending(queueData.assigned ?? []);
          setMonitoring(queueData.monitoring ?? []);
          setRecentActivity(activityData.data ?? []);
          if (reportData) setReport(reportData);
        }
      } catch (e: unknown) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Failed to load dashboard.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [role]);

  return {
    stats,
    pending,
    monitoring,
    recentActivity,
    report,
    adminStats,
    loading,
    error,
  };
}
