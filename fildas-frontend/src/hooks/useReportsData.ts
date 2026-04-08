import React from "react";
import { getComplianceReport } from "../services/documents";
import type { 
  ComplianceKpis, 
  ComplianceVolumeSeriesDatum, 
  ComplianceStageDelayDatum 
} from "../services/documents";
import { 
  getRequestsReport, 
  getActivityReport, 
  getAdminDashboardStats 
} from "../services/reportsApi";
import type { 
  RequestsReport, 
  ActivityReportResponse, 
  AdminDashboardStats,
  ComplianceOfficeDatum,
  ComplianceClusterDatum
} from "../services/types";
import type { Bucket, Parent, DateField, Scope } from "../components/reports/ReportFilters";

interface UseReportsDataProps {
  me: any;
  role: string | null;
  qaMode: boolean;
  isOfficeHead: boolean;
  activeTab: string;
  refreshKey: number;
  filters: {
    dateFrom: string;
    dateTo: string;
    bucket: Bucket;
    parent: Parent;
    officeId: number | null;
    dateField: DateField;
    scope: Scope;
  };
}

export const useReportsData = ({
  me,
  role,
  qaMode,
  isOfficeHead,
  activeTab,
  refreshKey,
  filters
}: UseReportsDataProps) => {
  const { dateFrom, dateTo, bucket, parent, officeId, dateField, scope } = filters;
  const filterSummary = JSON.stringify(filters) + activeTab;
  const prevFilterSummaryRef = React.useRef(filterSummary);

  const [kpis, setKpis] = React.useState<ComplianceKpis>({
    total_created: 0,
    total_approved_final: 0,
    first_pass_yield_pct: 0,
    pingpong_ratio: 0,
    cycle_time_avg_days: 0,
  });
  const [volumeSeries, setVolumeSeries] = React.useState<ComplianceVolumeSeriesDatum[]>([]);
  const [phaseDist, setPhaseDist] = React.useState<{ phase: string; count: number }[]>([]);
  const [offices, setOffices] = React.useState<ComplianceOfficeDatum[]>([]);
  const [clusters, setClusters] = React.useState<ComplianceClusterDatum[]>([]);
  const [stageDelaysByPhase, setStageDelaysByPhase] = React.useState<ComplianceStageDelayDatum[]>([]);
  const [doctypeDist, setDoctypeDist] = React.useState<{ doctype: string; count: number }[]>([]);
  const [creationByOffice, setCreationByOffice] = React.useState<{ 
    office_code: string; 
    office_name: string; 
    internal: number; 
    external: number; 
    forms: number; 
    total: number 
  }[]>([]);
  const [lifecycleFunnel, setLifecycleFunnel] = React.useState<{ stage: string; count: number }[]>([]);
  const [routingSplit, setRoutingSplit] = React.useState({ default_flow: 0, custom_flow: 0 });
  const [revisionStats, setRevisionStats] = React.useState({ docs_on_v2_plus: 0, avg_versions: 0 });
  
  const [requestsReport, setRequestsReport] = React.useState<RequestsReport | null>(null);
  const [requestsLoading, setRequestsLoading] = React.useState(false);
  
  const [activityReport, setActivityReport] = React.useState<ActivityReportResponse | null>(null);
  const [activityLoading, setActivityLoading] = React.useState(false);
  
  const [adminUserStats, setAdminUserStats] = React.useState<AdminDashboardStats["users"] | null>(null);
  const [adminUserLoading, setAdminUserLoading] = React.useState(false);
  
  const [loading, setLoading] = React.useState(true);

  // ── Compliance Report ────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!me) return;
    let alive = true;
    (async () => {
      const filtersChanged = prevFilterSummaryRef.current !== filterSummary;
      const isInitial = (!volumeSeries.length && !phaseDist.length) || filtersChanged;
      
      if (isInitial) setLoading(true);
      if (filtersChanged) prevFilterSummaryRef.current = filterSummary;

      try {
        const effectiveScope = isOfficeHead ? "offices" : scope;
        const effectiveOfficeId = isOfficeHead
          ? (me?.office_id ?? undefined)
          : scope === "offices" && officeId ? officeId : undefined;

        const report = await getComplianceReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          date_field: dateField,
          bucket,
          scope: effectiveScope,
          parent: effectiveScope === "clusters" ? parent : "ALL",
          office_id: effectiveOfficeId,
        });
        if (!alive) return;
        setKpis(report.kpis ?? kpis);
        setVolumeSeries(report.volume_series ?? []);
        setPhaseDist(report.phase_distribution ?? []);
        setOffices(report.offices ?? []);
        setClusters(report.clusters ?? []);
        setStageDelaysByPhase(report.stage_delays_by_phase ?? []);
        setDoctypeDist(report.doctype_distribution ?? []);
        setCreationByOffice(report.creation_by_office ?? []);
        setLifecycleFunnel(report.lifecycle_funnel ?? []);
        setRoutingSplit(report.routing_split ?? { default_flow: 0, custom_flow: 0 });
        setRevisionStats(report.revision_stats ?? { docs_on_v2_plus: 0, avg_versions: 0 });
      } catch {
        // silent
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [me, dateFrom, dateTo, bucket, parent, officeId, dateField, scope, refreshKey, isOfficeHead]);

  // ── Requests report ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!me || activeTab !== "requests") return;
    let alive = true;
    (async () => {
      const filtersChanged = prevFilterSummaryRef.current !== filterSummary;
      if (!requestsReport || filtersChanged) setRequestsLoading(true);
      try {
        const data = await getRequestsReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          bucket,
        });
        if (!alive) return;
        setRequestsReport(data);
      } catch {
        // silent
      } finally {
        if (alive) setRequestsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [me, activeTab, dateFrom, dateTo, bucket, refreshKey]);

  // ── Activity report ──────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!me) return;
    const needsActivity = activeTab === "activity" || activeTab === "overview" || activeTab === "health";
    if (!needsActivity || (!qaMode && role !== "ADMIN" && role !== "SYSADMIN")) return;

    let alive = true;
    (async () => {
      const filtersChanged = prevFilterSummaryRef.current !== filterSummary;
      if (!activityReport || filtersChanged) setActivityLoading(true);
      try {
        const effectiveOfficeId = isOfficeHead
          ? (me?.office_id ?? undefined)
          : scope === "offices" && officeId ? officeId : undefined;

        const data = await getActivityReport({
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          office_id: effectiveOfficeId,
          parent: scope === "clusters" ? parent : "ALL",
        });
        if (!alive) return;
        setActivityReport(data);
      } catch {
        // silent
      } finally {
        if (alive) setActivityLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [me, activeTab, dateFrom, dateTo, bucket, parent, officeId, scope, refreshKey, qaMode, role, isOfficeHead]);

  // ── Admin users report ───────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!me || activeTab !== "users") return;
    if (role !== "ADMIN" && role !== "SYSADMIN") return;
    let alive = true;
    (async () => {
      const filtersChanged = prevFilterSummaryRef.current !== filterSummary;
      if (!adminUserStats || filtersChanged) setAdminUserLoading(true);
      try {
        const data = await getAdminDashboardStats();
        if (!alive) return;
        setAdminUserStats(data.users);
      } catch {
        // silent
      } finally {
        if (alive) setAdminUserLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [me, activeTab, refreshKey, role]);

  const ongoingCount = phaseDist
    .filter((p) => !["Completed", "Distributed"].includes(p.phase))
    .reduce((acc, p) => acc + p.count, 0);

  return {
    loading,
    requestsLoading,
    activityLoading,
    adminUserLoading,
    stats: {
      kpis,
      volumeSeries,
      phaseDist,
      offices,
      clusters,
      stageDelaysByPhase,
      doctypeDist,
      creationByOffice,
      lifecycleFunnel,
      routingSplit,
      revisionStats,
    },
    requestsReport,
    activityReport,
    adminUserStats,
    ongoingCount,
  };
};
