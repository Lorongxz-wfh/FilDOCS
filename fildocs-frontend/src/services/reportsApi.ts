import { getApi, dedupeFetch } from "./_base";
import type {
  ComplianceReportParams,
  ComplianceReportResponse,
  ComplianceClusterDatum,
  ComplianceOfficeDatum,
  ComplianceSeriesDatum,
  ComplianceVolumeSeriesDatum,
  ComplianceKpis,
  ComplianceStageDelayDatum,
  FlowHealthReport,
  RequestsReport,
  DocumentStats,
  AdminDashboardStats,
  FinishedDocumentRow,
  ActivityReportResponse,
} from "./types";

export async function getComplianceReport(
  params?: ComplianceReportParams,
): Promise<ComplianceReportResponse> {
  try {
    const api = await getApi();
    const res = await api.get("/reports/approval", {
      params: { ...(params ?? {}) },
    });

    return {
      clusters: (res.data?.clusters ?? []) as ComplianceClusterDatum[],
      offices: (res.data?.offices ?? []) as ComplianceOfficeDatum[],
      series: (res.data?.series ?? []) as ComplianceSeriesDatum[],
      volume_series: (res.data?.volume_series ?? []) as ComplianceVolumeSeriesDatum[],
      kpis: (res.data?.kpis ?? {
        total_created: 0,
        total_approved_final: 0,
        first_pass_yield_pct: 0,
        pingpong_ratio: 0,
        cycle_time_avg_days: 0,
      }) as ComplianceKpis,
      stage_delays: (res.data?.stage_delays ?? []) as ComplianceStageDelayDatum[],
      phase_distribution: res.data?.phase_distribution ?? [],
      waiting_on_qa: res.data?.waiting_on_qa ?? 0,
      revision_stats: res.data?.revision_stats ?? { docs_on_v2_plus: 0, avg_versions: 0 },
      routing_split: res.data?.routing_split ?? { default_flow: 0, custom_flow: 0 },
      in_review_count: res.data?.in_review_count ?? 0,
      in_approval_count: res.data?.in_approval_count ?? 0,
      stage_delays_default: (res.data?.stage_delays_default ?? []) as ComplianceStageDelayDatum[],
      stage_delays_custom: (res.data?.stage_delays_custom ?? []) as ComplianceStageDelayDatum[],
      stage_delays_by_phase: (res.data?.stage_delays_by_phase ?? []) as ComplianceStageDelayDatum[],
      doctype_distribution: res.data?.doctype_distribution ?? [],
      creation_by_office: res.data?.creation_by_office ?? [],
      lifecycle_funnel: res.data?.lifecycle_funnel ?? [],
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load compliance report (${status})`
        : "Failed to load compliance report");
    throw new Error(msg);
  }
}

export async function getFlowHealthReport(params?: {
  date_from?: string;
  date_to?: string;
  date_field?: "created" | "completed";
  parent?: string;
  bucket?: string;
  office_id?: number;
}): Promise<FlowHealthReport> {
  try {
    const api = await getApi();
    const res = await api.get("/reports/flow-health", { params: { ...(params ?? {}) } });
    return {
      return_by_stage: res.data?.return_by_stage ?? [],
      return_trend: res.data?.return_trend ?? [],
      bottleneck: res.data?.bottleneck ?? [],
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Failed to load flow health report (${status})` : "Failed to load flow health report");
    throw new Error(msg);
  }
}

export async function getRequestsReport(params?: {
  date_from?: string;
  date_to?: string;
  bucket?: "daily" | "weekly" | "monthly" | "yearly" | "total";
}): Promise<RequestsReport> {
  try {
    const api = await getApi();
    const res = await api.get("/reports/requests", { params: { ...(params ?? {}) } });
    return {
      kpis: res.data?.kpis ?? {
        total: 0, open: 0, closed: 0, cancelled: 0,
        acceptance_rate: 0, avg_resubmissions: 0, overdue: 0,
      },
      status_distribution: res.data?.status_distribution ?? [],
      funnel: res.data?.funnel ?? [],
      attempt_distribution: res.data?.attempt_distribution ?? [],
      mode_split: res.data?.mode_split ?? { multi_office: 0, multi_doc: 0 },
      volume_series: res.data?.volume_series ?? [],
      office_acceptance: res.data?.office_acceptance ?? [],
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Failed to load requests report (${status})` : "Failed to load requests report");
    throw new Error(msg);
  }
}

export async function getDocumentStats(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<DocumentStats> {
  const key = `doc-stats:${params?.date_from || "all"}:${params?.date_to || "all"}`;
  return dedupeFetch(key, async () => {
    try {
      const api = await getApi();
      const res = await api.get("/documents/stats", { params });
      return res.data as DocumentStats;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        (status ? `Failed to load stats (${status})` : "Failed to load stats");
      throw new Error(msg);
    }
  });
}

export async function getAdminDashboardStats(params?: {
  date_from?: string;
  date_to?: string;
}): Promise<AdminDashboardStats> {
  const key = `admin-dash-stats:${params?.date_from || "all"}:${params?.date_to || "all"}`;
  return dedupeFetch(key, async () => {
    try {
      const api = await getApi();
      const res = await api.get("/admin/dashboard-stats", { params });
      return res.data as AdminDashboardStats;
    } catch (e: any) {
      const status = e?.response?.status;
      const msg =
        e?.response?.data?.message ||
        (status
          ? `Failed to load admin stats (${status})`
          : "Failed to load admin stats");
      throw new Error(msg);
    }
  });
}

export async function listFinishedDocuments(params?: {
  page?: number;
  per_page?: number;
  q?: string;
}): Promise<{ data: FinishedDocumentRow[]; meta: any }> {
  const api = await getApi();
  const res = await api.get("/documents/finished", { params });
  return res.data;
}

export async function getActivityReport(params?: {
  days?: number;
  date_from?: string;
  date_to?: string;
  office_id?: number | null;
  parent?: string;
}): Promise<ActivityReportResponse> {
  const api = await getApi();
  const res = await api.get("/reports/activity", { params });
  return res.data;
}

export async function downloadMasterReportZip(params?: {
  date_from?: string;
  date_to?: string;
  office_id?: number | null;
  parent?: string;
}): Promise<void> {
  const api = await getApi();
  const res = await api.get("/reports/export-all", {
    params,
    responseType: "blob",
  });

  const blob = new Blob([res.data], { type: "application/zip" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  const filename = `FilDOCS_Report_Bundle_${new Date().toISOString().split("T")[0]}.zip`;

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    link.remove();
    window.URL.revokeObjectURL(url);
  }, 100);
}
export async function getOffices(): Promise<{ id: number; name: string; code: string }[]> {
  try {
    const api = await getApi();
    const res = await api.get("/offices");
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Failed to load offices (${status})` : "Failed to load offices");
    throw new Error(msg);
  }
}
