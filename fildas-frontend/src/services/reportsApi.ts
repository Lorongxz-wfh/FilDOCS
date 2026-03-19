import { getApi } from "./_base";
import type {
  ComplianceReportParams,
  ComplianceReportResponse,
  ComplianceClusterDatum,
  ComplianceOfficeDatum,
  ComplianceSeriesDatum,
  ComplianceVolumeSeriesDatum,
  ComplianceKpis,
  ComplianceStageDelayDatum,
  DocumentStats,
  AdminDashboardStats,
  FinishedDocumentRow,
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

      volume_series: (res.data?.volume_series ??
        []) as ComplianceVolumeSeriesDatum[],
      kpis: (res.data?.kpis ?? {
        total_created: 0,
        total_approved_final: 0,
        first_pass_yield_pct: 0,
        pingpong_ratio: 0,
        cycle_time_avg_days: 0,
      }) as ComplianceKpis,
      stage_delays: (res.data?.stage_delays ??
        []) as ComplianceStageDelayDatum[],
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

export async function getDocumentStats(): Promise<DocumentStats> {
  try {
    const api = await getApi();
    const res = await api.get("/documents/stats");
    return res.data as DocumentStats;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Failed to load stats (${status})` : "Failed to load stats");
    throw new Error(msg);
  }
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  try {
    const api = await getApi();
    const res = await api.get("/admin/dashboard-stats");
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
