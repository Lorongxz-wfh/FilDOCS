import { getAuthUser, clearAuthAndRedirect } from "../lib/auth";

// NOTE: api is dynamically imported to keep it out of the login/initial bundle.
let apiPromise: Promise<typeof import("./api")> | null = null;

type ApiClient = (typeof import("./api"))["default"];

async function getApi(): Promise<ApiClient> {
  if (!apiPromise) apiPromise = import("./api");
  const mod = await apiPromise;
  return mod.default;
}

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";

export interface CreateDocumentPayload {
  title: string;

  // Which starter flow
  workflow_type?: "qa" | "office";

  // Existing QA default reviewer office (still supported)
  review_office_id?: number | null;

  // NEW: routing selector
  routing_mode?: "default" | "custom";

  // NEW: ordered recipient offices for custom routing (review phase for now)
  custom_review_office_ids?: number[];

  doctype: "internal" | "external" | "forms";
  description?: string;
  effective_date?: string | null; // YYYY-MM-DD, QA-only on create
  visibility_scope?: "office" | "global";
  school_year?: string;
  semester?: string;
  file?: File | null;
}

export interface Document {
  id: number;
  title: string;
  owner_office_id: number | null;
  review_office_id: number | null;

  ownerOffice: {
    id: number;
    name: string;
    code: string;
  } | null;

  reviewOffice: {
    id: number;
    name: string;
    code: string;
  } | null;

  parent_document_id?: number | null;
  doctype: "internal" | "external" | "forms";
  code: string | null;
  status: string;
  version_number: number;
  file_path: string | null;
  preview_path: string | null;
  original_filename: string | null;
  current_step_notes?: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;

  tags?: string[];
}

export type Paginated<T> = {
  data: T[];
  meta?: any;
  links?: any;
};

function normalizePaginated<T>(payload: any): Paginated<T> {
  if (payload && Array.isArray(payload.data)) {
    // Laravel ResourceCollection has { data, links, meta }
    // Laravel default paginator has current_page, last_page etc. at root
    const meta = payload.meta ?? {
      current_page: payload.current_page,
      last_page: payload.last_page,
      per_page: payload.per_page,
      total: payload.total,
      from: payload.from,
      to: payload.to,
    };
    return {
      data: payload.data as T[],
      meta,
      links: payload.links,
    };
  }

  if (Array.isArray(payload)) {
    return { data: payload as T[] };
  }

  throw new Error("Invalid response format");
}

type NotifCacheEntry = {
  etag: string | null;
  payload: Paginated<NotificationItem>;
};

const notifCache = new Map<string, NotifCacheEntry>();

function clearNotifCache() {
  notifCache.clear();
}

function notifCacheKey(page: number, perPage: number) {
  return `notifications:p${page}:pp${perPage}`;
}

export interface NotificationItem {
  id: number;
  user_id: number;
  document_id: number | null;
  document_version_id: number | null;
  event: string;
  title: string;
  body: string | null;
  meta: any | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export type UnreadCountResponse = { unread: number };

export async function createDocumentWithProgress(
  payload: CreateDocumentPayload,
  onProgress?: (pct: number) => void,
): Promise<Document> {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("doctype", payload.doctype);

  if (payload.workflow_type) {
    formData.append("workflow_type", payload.workflow_type);
  }

  if (payload.review_office_id != null) {
    formData.append("review_office_id", String(payload.review_office_id));
  }

  if (payload.routing_mode) {
    formData.append("routing_mode", payload.routing_mode);
  }

  if (payload.custom_review_office_ids?.length) {
    for (const id of payload.custom_review_office_ids) {
      formData.append("custom_review_office_ids[]", String(id));
    }
  }

  if (payload.visibility_scope)
    formData.append("visibility_scope", payload.visibility_scope);
  if (payload.school_year) formData.append("school_year", payload.school_year);
  if (payload.semester) formData.append("semester", payload.semester);
  if (payload.description) formData.append("description", payload.description);

  if (payload.effective_date) {
    formData.append("effective_date", payload.effective_date);
  }

  if (payload.file) formData.append("file", payload.file);

  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Not authenticated");

  const url = `${API_BASE}/documents`;

  return await new Promise<Document>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        clearAuthAndRedirect();
        return;
      }

      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          const err: ApiError = new Error(
            data.message || `Request failed (${xhr.status})`,
          );
          err.status = xhr.status;
          if (data?.errors && typeof data.errors === "object")
            err.details = data.errors;
          reject(err);
        } catch {
          reject(new Error(`Request failed (${xhr.status})`));
        }
        return;
      }

      try {
        const json = JSON.parse(xhr.responseText || "{}");
        const doc = (json?.data ?? json) as Document;
        resolve(doc);
      } catch {
        reject(new Error("Invalid server response"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

export interface DocumentVersion {
  id: number;
  document_id: number;
  version_number: number;
  status: string;
  file_path: string | null;
  preview_path: string | null;
  original_filename: string | null;
  description?: string | null;
  revision_reason?: string | null;

  effective_date?: string | null; // YYYY-MM-DD

  distributed_at: string | null;
  superseded_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiError extends Error {
  status?: number;
  details?: Record<string, string[]>;
}

export interface WorkflowTask {
  id: number;
  document_version_id: number;
  phase: "review" | "approval" | "registration";
  step: string;
  status: "open" | "completed" | "returned" | "rejected" | "cancelled";
  opened_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  assigned_office_id?: number | null;
  assigned_role_id?: number | null;
  assigned_user_id?: number | null;
}

export type DocumentRouteStep = {
  phase: "review" | "approval" | "registration" | string;
  step_order: number;
  office_id: number;
};

export type DocumentRouteStepsResponse = {
  document_version_id: number;
  steps: DocumentRouteStep[];
};

export async function getDocumentRouteSteps(
  versionId: number,
): Promise<DocumentRouteStepsResponse> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/route-steps`);

    return res.data as DocumentRouteStepsResponse;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load route steps (${status})`
        : "Failed to load route steps");
    throw new Error(msg);
  }
}

export type WorkQueueItem = {
  task: WorkflowTask | null;
  version: DocumentVersion;
  document: Document;
  can_act: boolean;
};

export type WorkQueueResponse = {
  assigned: WorkQueueItem[];
  monitoring: WorkQueueItem[];
};

export type ComplianceClusterDatum = {
  cluster: string;
  in_review: number;
  sent_to_qa: number;
  approved: number;
  returned: number;
};

export type ComplianceReportParams = {
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD

  date_field?: "created" | "completed";

  bucket?: "daily" | "weekly" | "monthly" | "yearly" | "total";
  scope?: "clusters" | "offices";
  parent?: "ALL" | "PO" | "VAd" | "VA" | "VF" | "VR";
};

export type ComplianceSeriesDatum = {
  label: string; // e.g. "2026-02-01" (daily) or "2026-02" (monthly) or "Total"
  in_review: number;
  sent_to_qa: number;
  approved: number;
  returned: number;
};

export type ComplianceOfficeDatum = {
  office_id: number;
  office_code: string | null;
  cluster: string | null; // e.g. VAd/VA/VF/VR/PO
  in_review: number;
  sent_to_qa: number;
  approved: number;
  returned: number;
};

export type ComplianceVolumeSeriesDatum = {
  label: string;
  created: number;
  approved_final: number;
};

export type ComplianceKpis = {
  total_created: number;
  total_approved_final: number;
  first_pass_yield_pct: number;
  pingpong_ratio: number;
  cycle_time_avg_days: number;
};

export type ComplianceStageDelayDatum = {
  stage: string; // Office | VP | QA | Registration
  avg_hours: number; // average time per task in that stage
  count: number; // unique distributed versions that hit this stage
  task_count: number; // number of tasks included in avg
};

export type ComplianceReportResponse = {
  clusters: ComplianceClusterDatum[];
  offices: ComplianceOfficeDatum[];
  series: ComplianceSeriesDatum[];

  volume_series: ComplianceVolumeSeriesDatum[];
  kpis: ComplianceKpis;

  stage_delays: ComplianceStageDelayDatum[];
};

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

export async function getWorkQueue(): Promise<WorkQueueResponse> {
  try {
    const api = await getApi();
    const res = await api.get("/work-queue");
    return res.data as WorkQueueResponse;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load work queue (${status})`
        : "Failed to load work queue");
    throw new Error(msg);
  }
}

export interface DocumentMessageSender {
  id: number;
  full_name: string;
  profile_photo_path?: string | null;
  role?: { id: number; name: string } | null;
}

export interface DocumentMessage {
  id: number;
  document_version_id: number;
  sender_user_id: number;
  type: "comment" | "return_note" | "approval_note" | "system";
  message: string;
  created_at: string;
  updated_at: string;
  sender?: DocumentMessageSender | null;
}

export async function listDocumentMessages(
  versionId: number,
): Promise<DocumentMessage[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/messages`);
    return res.data as DocumentMessage[];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load messages (${status})`
        : "Failed to load messages");
    throw new Error(msg);
  }
}

export async function postDocumentMessage(
  versionId: number,
  payload: { message: string; type?: DocumentMessage["type"] },
): Promise<DocumentMessage> {
  try {
    const api = await getApi();
    const res = await api.post(
      `/document-versions/${versionId}/messages`,
      payload,
    );
    return res.data as DocumentMessage;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to send message (${status})`
        : "Failed to send message");
    throw new Error(msg);
  }
}

export async function listDocumentsPage(params?: {
  page?: number;
  perPage?: number;

  // server-side search/filters
  q?: string;
  status?: string;
  doctype?: string;
  owner_office_id?: number;

  // NEW: document library scope
  scope?: "all" | "owned" | "shared" | "assigned";
}): Promise<Paginated<Document>> {
  try {
    const api = await getApi();
    const res = await api.get("/documents", {
      params: {
        page: params?.page ?? 1,
        per_page: params?.perPage ?? 25,

        q: params?.q,
        status: params?.status,
        doctype: params?.doctype,
        owner_office_id: params?.owner_office_id,

        scope: params?.scope,
      },
    });

    return normalizePaginated<Document>(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load documents (${status})`
        : "Failed to load documents");
    throw new Error(msg);
  }
}

// Backwards compatible: existing pages still get Document[]
export async function listDocuments(): Promise<Document[]> {
  const { data } = await listDocumentsPage({ page: 1, perPage: 25 });
  return data;
}

export async function getDocument(id: number): Promise<Document> {
  try {
    const api = await getApi();
    const res = await api.get(`/documents/${id}`);
    const doc = res.data?.data ?? res.data;

    if (!doc || typeof doc !== "object") {
      throw new Error("Invalid document response format");
    }

    return doc as Document;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load document (${status})`
        : "Failed to load document");
    throw new Error(msg);
  }
}

export async function getDocumentVersions(
  documentId: number,
): Promise<DocumentVersion[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/documents/${documentId}/versions`);
    const data = res.data;
    const versions = Array.isArray(data) ? data : data?.data;

    if (!Array.isArray(versions)) {
      throw new Error("Invalid versions response format");
    }

    const cleaned = (versions as DocumentVersion[]).filter(
      (v) => v.status !== "Cancelled",
    );

    // Keep newest first (safety) if backend ever changes ordering
    cleaned.sort((a, b) => Number(b.version_number) - Number(a.version_number));

    return cleaned;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load document versions (${status})`
        : "Failed to load document versions");
    throw new Error(msg);
  }
}

export async function createRevision(
  documentId: number,
  payload?: { revision_reason?: string | null },
): Promise<DocumentVersion> {
  try {
    const api = await getApi();
    const res = await api.post(
      `/documents/${documentId}/revision`,
      payload ?? {},
    );
    return res.data as DocumentVersion;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function cancelRevision(versionId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.post(`/document-versions/${versionId}/cancel`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function deleteDraftVersion(versionId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.delete(`/document-versions/${versionId}`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function getDocumentVersion(
  versionId: number,
): Promise<{ version: DocumentVersion; document: Document }> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}`);
    const json = res.data;
    if (!json?.version || !json?.document) {
      throw new Error("Invalid document version response format");
    }

    return {
      version: json.version as DocumentVersion,
      document: (json.document.data ?? json.document) as Document,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load document version (${status})`
        : "Failed to load document version");
    throw new Error(msg);
  }
}

export async function getDocumentPreviewUrl(
  versionId: number,
): Promise<string> {
  const { url } = await getDocumentPreviewLink(versionId);
  return url;
}

export async function replaceDocumentVersionFileWithProgress(
  versionId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE}/document-versions/${versionId}/replace-file`;

  return await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (ok) return resolve();
      if (xhr.status === 401) {
        clearAuthAndRedirect();
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText || "{}");
        reject(new Error(data.message || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed (network error)"));
    xhr.send(formData);
  });
}

export async function updateDocumentTitle(
  documentId: number,
  title: string,
): Promise<void> {
  try {
    const api = await getApi();
    await api.patch(`/documents/${documentId}`, { title });
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function updateDocumentVersionDescription(
  versionId: number,
  description: string,
): Promise<DocumentVersion> {
  try {
    const api = await getApi();
    const res = await api.patch(`/document-versions/${versionId}`, {
      description,
    });
    const v = res.data?.version ?? res.data;
    return v as DocumentVersion;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function updateDocumentVersionEffectiveDate(
  versionId: number,
  effective_date: string | null,
): Promise<DocumentVersion> {
  try {
    const api = await getApi();
    const res = await api.patch(`/document-versions/${versionId}`, {
      effective_date,
    });
    const v = res.data?.version ?? res.data;
    return v as DocumentVersion;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function downloadDocument(
  version: DocumentVersion,
): Promise<void> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${version.id}/download`, {
      responseType: "blob",
      headers: {
        Accept: "application/octet-stream",
      },
    });

    const blob = res.data as Blob;
    const objectUrl = window.URL.createObjectURL(blob);

    const a = window.document.createElement("a");
    a.href = objectUrl;
    a.download = version.original_filename || `document-version-${version.id}`;
    window.document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(objectUrl);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Download failed (${status})` : "Download failed");
    throw new Error(msg);
  }
}

export interface Office {
  id: number;
  name: string;
  code: string;
  type: "office" | "academic";
  is_academic: boolean;
}

export type DocumentShares = {
  document_id: number;
  office_ids: number[];
};

let officesCache: Office[] | null = null;

export async function listOffices(): Promise<Office[]> {
  if (officesCache) return officesCache;

  try {
    const api = await getApi();
    const res = await api.get("/offices");
    officesCache = res.data as Office[];
    return officesCache;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load offices (${status})`
        : "Failed to load offices");
    throw new Error(msg);
  }
}

export const getCurrentUserOfficeId = (): number => {
  return getAuthUser()?.office?.id ?? 0;
};

// Must match backend WorkflowSteps action constants exactly
export type WorkflowActionCode =
  // Universal
  | "REJECT"
  | "CANCEL_DOCUMENT"
  // QA flow
  | "QA_SEND_TO_OFFICE_REVIEW"
  | "QA_OFFICE_FORWARD_TO_VP"
  | "QA_OFFICE_RETURN_TO_QA"
  | "QA_VP_SEND_BACK_TO_QA"
  | "QA_START_OFFICE_APPROVAL"
  | "QA_OFFICE_FORWARD_TO_VP_APPROVAL"
  | "QA_VP_FORWARD_TO_PRESIDENT"
  | "QA_PRESIDENT_SEND_BACK_TO_QA"
  | "QA_REGISTER"
  | "QA_DISTRIBUTE"
  // Office flow
  | "OFFICE_SEND_TO_HEAD"
  | "OFFICE_HEAD_FORWARD_TO_VP"
  | "OFFICE_HEAD_RETURN_TO_STAFF"
  | "OFFICE_VP_SEND_BACK_TO_STAFF"
  | "OFFICE_SEND_TO_QA_APPROVAL"
  | "OFFICE_QA_RETURN_TO_STAFF"
  | "OFFICE_QA_APPROVE"
  | "OFFICE_REGISTER"
  | "OFFICE_DISTRIBUTE"
  // Custom flow
  | "CUSTOM_FORWARD"
  | "CUSTOM_START_APPROVAL"
  | "CUSTOM_REGISTER"
  | "CUSTOM_DISTRIBUTE";

export type WorkflowActionResult = {
  version: DocumentVersion;
  task?: WorkflowTask;
  message?: string;
};

export async function submitWorkflowAction(
  versionId: number,
  action: WorkflowActionCode,
  note?: string,
): Promise<WorkflowActionResult> {
  try {
    const api = await getApi();
    const res = await api.post(`/document-versions/${versionId}/actions`, {
      action,
      note,
    });
    return res.data as WorkflowActionResult;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Request failed (${status})` : "Request failed");
    throw new Error(msg);
  }
}

export type AvailableActionsResponse = {
  document_version_id: number;
  actions: WorkflowActionCode[];
};

export async function getAvailableActions(
  versionId: number,
): Promise<WorkflowActionCode[]> {
  try {
    const api = await getApi();
    const res = await api.get(
      `/document-versions/${versionId}/available-actions`,
    );
    const data = res.data as AvailableActionsResponse;
    return data.actions ?? [];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load actions (${status})`
        : "Failed to load actions");
    throw new Error(msg);
  }
}

export async function logOpenedVersion(
  versionId: number,
  source?: string,
): Promise<void> {
  try {
    const api = await getApi();
    await api.post("/activity/opened-version", {
      document_version_id: versionId,
      source: source ?? "versions_panel",
    });
  } catch {
    // Never break UX for logging
  }
}

export interface ActivityLogItem {
  id: number;
  document_id: number | null;
  document_version_id: number | null;
  actor_user_id: number | null;
  actor_office_id: number | null;
  target_office_id: number | null;
  event: string;
  label: string | null;
  meta: any | null;
  created_at: string;
  updated_at: string;
}

export async function listActivityLogs(params: {
  scope?: "office" | "mine" | "document" | "all";
  document_id?: number;
  document_version_id?: number;
  per_page?: number;
  page?: number;

  // filters
  q?: string;
  event?: string;
  office_id?: number;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
}): Promise<Paginated<ActivityLogItem>> {
  try {
    const api = await getApi();
    const res = await api.get("/activity", {
      params: {
        scope: params.scope ?? "office",
        document_id: params.document_id,
        document_version_id: params.document_version_id,
        per_page: params.per_page ?? 25,
        page: params.page ?? 1,

        q: params.q,
        event: params.event,
        office_id: params.office_id,
        date_from: params.date_from,
        date_to: params.date_to,
      },
    });

    return normalizePaginated<ActivityLogItem>(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load activity logs (${status})`
        : "Failed to load activity logs");
    throw new Error(msg);
  }
}

export async function listWorkflowTasks(
  versionId: number,
): Promise<WorkflowTask[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/tasks`);
    return res.data as WorkflowTask[];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load workflow tasks (${status})`
        : "Failed to load workflow tasks");
    throw new Error(msg);
  }
}

export async function getDocumentPreviewLink(
  versionId: number,
): Promise<{ url: string; expires_in_minutes: number }> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/preview-link`);
    return res.data as { url: string; expires_in_minutes: number };
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to get preview link (${status})`
        : "Failed to get preview link");
    throw new Error(msg);
  }
}

export type DocumentStats = {
  total: number;
  pending: number;
  distributed: number;
};

export type AdminDashboardStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
    by_role: { role: string; count: number }[];
    recent: {
      id: number;
      name: string;
      email: string;
      role: string;
      office_name: string | null;
      is_active: boolean;
      created_at: string;
    }[];
  };
  offices: { total: number; active: number };
  documents: { total: number; distributed: number; in_progress: number };
  activity_series: { label: string; count: number }[];
};

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

export async function getDocumentShares(
  documentId: number,
): Promise<DocumentShares> {
  try {
    const api = await getApi();
    const res = await api.get(`/documents/${documentId}/shares`, {
      params: { t: Date.now() },
    });
    return res.data as DocumentShares;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Failed to load shares (${status})` : "Failed to load shares");
    throw new Error(msg);
  }
}

export async function setDocumentShares(
  documentId: number,
  officeIds: number[],
): Promise<DocumentShares> {
  try {
    const api = await getApi();
    const res = await api.post(`/documents/${documentId}/shares`, {
      office_ids: officeIds,
    });
    return res.data as DocumentShares;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to update shares (${status})`
        : "Failed to update shares");
    throw new Error(msg);
  }
}

export async function getDocumentTags(documentId: number): Promise<string[]> {
  const api = await getApi();
  const res = await api.get(`/documents/${documentId}/tags`);
  const tags = res.data?.tags;
  return Array.isArray(tags) ? (tags as string[]) : [];
}

export async function setDocumentTags(
  documentId: number,
  tags: string[],
): Promise<string[]> {
  const api = await getApi();
  const res = await api.put(`/documents/${documentId}/tags`, { tags });
  const out = res.data?.tags;
  return Array.isArray(out) ? (out as string[]) : [];
}

export async function listNotifications(params?: {
  page?: number;
  perPage?: number;
}): Promise<Paginated<NotificationItem>> {
  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 25;

  const key = notifCacheKey(page, perPage);
  const cached = notifCache.get(key);

  try {
    const api = await getApi();
    const res = await api.get("/notifications", {
      params: {
        page,
        per_page: perPage,
        // IMPORTANT: no `t: Date.now()` here; it defeats conditional caching
      },
      headers: cached?.etag ? { "If-None-Match": cached.etag } : undefined,
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 304,
    });

    // 304: not modified, return cached payload (must exist)
    if (res.status === 304) {
      if (cached) return cached.payload;
      // Fallback: if no cache exists, treat as empty (should be rare)
      return { data: [], meta: undefined, links: undefined };
    }

    const normalized = normalizePaginated<NotificationItem>(res.data);
    const etag =
      (res.headers?.etag as string | undefined) ??
      (res.headers?.ETag as string | undefined) ??
      null;

    notifCache.set(key, { etag, payload: normalized });
    return normalized;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load notifications (${status})`
        : "Failed to load notifications");
    throw new Error(msg);
  }
}

export async function getUnreadNotificationCount(): Promise<number> {
  try {
    const api = await getApi();
    const res = await api.get("/notifications/unread-count");
    const data = res.data as UnreadCountResponse;
    return Number(data?.unread ?? 0);
  } catch {
    return 0; // don’t break UX
  }
}

export async function markNotificationRead(
  notificationId: number,
): Promise<void> {
  const api = await getApi();
  await api.post(`/notifications/${notificationId}/read`);
  clearNotifCache();
}

export async function markAllNotificationsRead(): Promise<void> {
  const api = await getApi();
  await api.post("/notifications/read-all");
  clearNotifCache();
}

export async function deleteNotification(
  notificationId: number,
): Promise<void> {
  const api = await getApi();
  await api.delete(`/notifications/${notificationId}`);
  clearNotifCache();
}

export async function deleteAllNotifications(): Promise<void> {
  const api = await getApi();
  await api.delete("/notifications");
  clearNotifCache();
}

export type OfficeUser = {
  id: number;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  profile_photo_path: string | null;
  role_id: number | null;
  office_id: number | null;
  full_name: string;
  role?: { id: number; name: string; label?: string };
};

export async function getOfficeUsers(officeId: number): Promise<OfficeUser[]> {
  try {
    const api = await getApi();
    const res = await api.get<OfficeUser[]>(`/offices/${officeId}/users`);
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load office users (${status})`
        : "Failed to load office users");
    throw new Error(msg);
  }
}
