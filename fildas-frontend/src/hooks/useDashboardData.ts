import { useState, useEffect, useCallback, useRef } from "react";
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
import {
  listDocumentRequests,
  listDocumentRequestInbox,
} from "../services/documentRequests";
import { isQA, isAuditor, type UserRole } from "../lib/roleFilters";
import type { PendingAction } from "../services/types";
import { useRealtimeUpdates } from "./useRealtimeUpdates";

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

export type ReloadResult = { changed: boolean; delta: number };

export type DashboardPeriod = "today" | "this_week" | "all";

export type DashboardData = {
  stats: DocumentStats | null;
  pending: WorkQueueItem[];
  monitoring: WorkQueueItem[];
  recentActivity: ActivityLogItem[];
  report: ComplianceReport;
  adminStats: AdminDashboardStats | null;
  pendingRequestsCount: number;
  pendingRequestsInboxCount: number;
  pendingActions: PendingAction[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<ReloadResult>;
  period: DashboardPeriod;
  setPeriod: (p: DashboardPeriod) => void;
};

export function useDashboardData(role: UserRole): DashboardData {
  const [stats, setStats] = useState<DocumentStats | null>(null);
  const [pending, setPending] = useState<WorkQueueItem[]>([]);
  const [monitoring, setMonitoring] = useState<WorkQueueItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<ActivityLogItem[]>([]);
  const [report, setReport] = useState<ComplianceReport>(emptyReport);
  const [adminStats, setAdminStats] = useState<AdminDashboardStats | null>(null);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<DashboardPeriod>("this_week");

  // Tracks latest fetched pending count so reload() can detect changes
  const lastPendingCountRef = useRef(-1);

  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const [pendingRequestsInboxCount, setPendingRequestsInboxCount] = useState(0);

  const loadRef = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);

      let dateFrom: string | undefined;
      let dateTo: string | undefined;
      const now = new Date();

      if (period === "today") {
        dateFrom = now.toISOString().split("T")[0];
        dateTo = dateFrom;
      } else if (period === "this_week") {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
        const monday = new Date(d.setDate(diff));
        dateFrom = monday.toISOString().split("T")[0];
        dateTo = now.toISOString().split("T")[0];
      }

      try {
        if (isAdmin) {
          // Priority 1: Fast stats
          const adminProm = getAdminDashboardStats({ date_from: dateFrom, date_to: dateTo });
          const adminResult = await Promise.allSettled([adminProm]);
          const adminRes = adminResult[0] as PromiseSettledResult<AdminDashboardStats>;
          if (adminRes.status === "fulfilled") setAdminStats(adminRes.value);

          // Priority 2: Heavy logs (staggered)
          if (!silent) {
            setTimeout(async () => {
              const activityRes = await listActivityLogs({ 
                scope: "all", 
                per_page: 5,
                date_from: dateFrom,
                date_to: dateTo
              });
              setRecentActivity(activityRes.data ?? []);
            }, 3000);
          }
        } else if (isQA(role)) {
          // Priority 1: Instant feedback
          const p1 = [
            getDocumentStats({ date_from: dateFrom, date_to: dateTo }),
            getWorkQueue(),
          ];
          const r1 = await Promise.allSettled(p1);
          const statsRes = r1[0] as PromiseSettledResult<DocumentStats>;
          const queueRes = r1[1] as PromiseSettledResult<any>;

          if (statsRes.status === "fulfilled") setStats(statsRes.value);
          if (queueRes.status === "fulfilled") {
            const assigned = queueRes.value.assigned ?? [];
            setPending(assigned);
            setMonitoring(queueRes.value.monitoring ?? []);
            lastPendingCountRef.current = assigned.length;
          }

          // Priority 2: Reports & Requests (slightly delayed)
          setTimeout(async () => {
             const [reportRes, reqRes] = await Promise.all([
                getComplianceReport({ 
                  date_from: dateFrom, 
                  date_to: dateTo,
                  bucket: period === "this_week" ? "daily" : period === "today" ? "daily" : "monthly"
                }),
                listDocumentRequests({ 
                  per_page: 8,
                  status: "open",
                  date_from: dateFrom,
                  date_to: dateTo
                })
             ]);
             
             setReport(reportRes);
             setPendingRequestsCount(reqRes?.meta?.total ?? 0);

             const docs = (queueRes.status === "fulfilled" ? queueRes.value.assigned : []).map(
               (x: any) => ({
                 type: "document",
                 id: x.version.id,
                 title: x.document.title,
                 code: x.document.code || (x.document as any).reserved_code,
                 status: x.version.status,
                 item: x,
               } as PendingAction)
             );

             const reqs = (reqRes?.data ?? [])
               .filter((r: any) => r.status === "open")
               .map((r: any) => ({
                 type: "request",
                 id: r.id,
                 title: r.title,
                 code: `Request #${r.id}`,
                 status: "Open",
                 item: r,
               } as PendingAction));

             setPendingActions([...docs, ...reqs]);
          }, 400);

          // Priority 3: Monster payload (heavily staggered)
          if (!silent) {
            setTimeout(async () => {
              const res = await listActivityLogs({ 
                scope: "all", 
                per_page: 3, 
                category: "workflow",
                date_from: dateFrom,
                date_to: dateTo
              });
              setRecentActivity(res.data ?? []);
            }, 3000);
          }

        } else if (isAuditor(role)) {
          const statsRes = await getDocumentStats({ date_from: dateFrom, date_to: dateTo });
          setStats(statsRes);
          
          if (!silent) {
            setTimeout(async () => {
              const res = await listActivityLogs({ scope: "all", per_page: 5, date_from: dateFrom, date_to: dateTo });
              setRecentActivity(res.data ?? []);
            }, 3000);
          }
        } else {
          // Priority 1: Core queue
          const p1 = [
            getDocumentStats({ date_from: dateFrom, date_to: dateTo }),
            getWorkQueue(),
          ];
          const r1 = await Promise.allSettled(p1);
          const statsRes = r1[0] as PromiseSettledResult<DocumentStats>;
          const queueRes = r1[1] as PromiseSettledResult<any>;

          if (statsRes.status === "fulfilled") setStats(statsRes.value);
          if (queueRes.status === "fulfilled") {
            const assigned = queueRes.value.assigned ?? [];
            setPending(assigned);
            setMonitoring(queueRes.value.monitoring ?? []);
            lastPendingCountRef.current = assigned.length;
          }

          // Priority 2: Inbox & Actions
          setTimeout(async () => {
            const inboxRes = await listDocumentRequestInbox({ 
              per_page: 8,
              status: "open",
              date_from: dateFrom,
              date_to: dateTo
            });
            setPendingRequestsInboxCount(inboxRes?.meta?.total ?? 0);

            const docs = (queueRes.status === "fulfilled" ? queueRes.value.assigned : []).map(
              (x: any) => ({
                type: "document",
                id: x.version.id,
                title: x.document.title,
                code: x.document.code || (x.document as any).reserved_code,
                status: x.version.status,
                item: x,
              } as PendingAction)
            );

            const reqs = (inboxRes?.data ?? [])
              .filter((r: any) => r.recipient_status === "pending" || r.recipient_status === "rejected")
              .map((r: any) => ({
                type: "request",
                id: r.id,
                title: r.title,
                code: `Request #${r.id}`,
                status: r.recipient_status === "pending" ? "Pending" : "Rejected",
                item: r,
              } as PendingAction));

            setPendingActions([...docs, ...reqs]);
          }, 400);

          // Priority 3: Heavy logs
          if (!silent) {
            setTimeout(async () => {
              const res = await listActivityLogs({ 
                scope: "connected", 
                per_page: 10,
                date_from: dateFrom,
                date_to: dateTo
              });
              setRecentActivity(res.data ?? []);
            }, 3000);
          }
        }
      } catch (e: unknown) {
        if (!silent) {
          setError(e instanceof Error ? e.message : "Failed to load stats");
        }
      } finally {
        setLoading(false);
      }
    },
    [role, isAdmin, period],
  );

  useEffect(() => {
    loadRef();
    // Aggressive polling deprecated. WebSockets (useRealtimeUpdates) now handle all refreshes.
  }, [loadRef]);

  // ── Real-time Integration ──────────────────────────────────────────────
  useRealtimeUpdates({
    onWorkspaceChange: () => {
      // Trigger a silent reload when any global document/request change occurs
      loadRef(true).catch(() => {});
    },
    onWorkflowUpdate: () => {
      // Trigger a silent reload when a workflow task is assigned to/updated for this user
      loadRef(true).catch(() => {});
    },
  });

  const reload = useCallback(async (): Promise<ReloadResult> => {
    const prev = lastPendingCountRef.current;
    await loadRef(true);
    const next = lastPendingCountRef.current;
    const delta = next - prev;
    return { changed: prev !== -1 && next !== prev, delta };
  }, [loadRef]);

  return {
    stats,
    pending,
    monitoring,
    recentActivity,
    report,
    adminStats,
    pendingRequestsCount,
    pendingRequestsInboxCount,
    pendingActions,
    loading,
    error,
    reload,
    period,
    setPeriod,
  };
}
