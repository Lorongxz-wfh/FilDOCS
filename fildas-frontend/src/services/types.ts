// Canonical shared types for all FilDAS service modules.

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
  acting_as_office_id?: number;
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
  effective_date?: string | null;
  distributed_at?: string | null;
  archived_at?: string | null;
  archive_reason?: string | null;
}

export type Paginated<T> = {
  data: T[];
  meta?: any;
  links?: any;
};

/** 
 * Resolves a profile photo path/url to a full URL.
 * Handles both absolute URLs and relative storage paths.
 */
export function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  
  // Prepend backend storage URL if it's a relative path
  const base = (import.meta.env.VITE_API_BASE_URL as string)?.replace("/api", "") 
    ?? (import.meta.env.PROD ? "https://fildas-v2.onrender.com" : "http://127.0.0.1:8001");
    
  return `${base}/storage/${path.replace(/^storage\//, "")}`;
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

export interface DocumentVersion {
  id: number;
  document_id: number;
  version_number: number;
  status: string;
  file_path: string | null;
  preview_path: string | null;
  original_filename: string | null;
  signed_file_path?: string | null;
  pre_sign_file_path?: string | null;
  needs_file_replacement?: boolean;
  description?: string | null;
  revision_reason?: string | null;
  workflow_type?: string | null;
  routing_mode?: string | null;

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

export type PendingAction =
  | {
      type: "document";
      id: number;
      title: string;
      code?: string | null;
      status: string;
      item: WorkQueueItem;
    }
  | {
      type: "request";
      id: number;
      title: string;
      code?: string | null;
      status: string;
      item: any; // DocumentRequestRow from inbox (has recipient_id/status)
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
  category?: "workflow" | "request" | "document" | "user" | "template" | "profile";

  date_field?: "created" | "completed";

  bucket?: "daily" | "weekly" | "monthly" | "yearly" | "total";
  scope?: "clusters" | "offices";
  parent?: "ALL" | "PO" | "VAd" | "VA" | "VF" | "VR";
  office_id?: number; // filter by a single office (used when scope="offices")
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
  stage: string;
  avg_hours: number;
  median_hours?: number; // median task hold time (phase-based data)
  count: number; // unique distributed versions that hit this stage
  task_count: number;
};

export type ComplianceReportResponse = {
  clusters: ComplianceClusterDatum[];
  offices: ComplianceOfficeDatum[];
  series: ComplianceSeriesDatum[];

  volume_series: ComplianceVolumeSeriesDatum[];
  kpis: ComplianceKpis;
  stage_delays: ComplianceStageDelayDatum[];

  // Extended fields (wired from backend)
  phase_distribution?: { phase: string; count: number }[];
  waiting_on_qa?: number;
  revision_stats?: { docs_on_v2_plus: number; avg_versions: number };
  routing_split?: { default_flow: number; custom_flow: number };
  in_review_count?: number;
  in_approval_count?: number;
  stage_delays_default?: ComplianceStageDelayDatum[];
  stage_delays_custom?: ComplianceStageDelayDatum[];
  stage_delays_by_phase?: ComplianceStageDelayDatum[];
  doctype_distribution?: { doctype: string; count: number }[];
  creation_by_office?: { office_code: string; office_name: string; internal: number; external: number; forms: number; total: number }[];
  lifecycle_funnel?: { stage: string; count: number }[];
};

export type FlowHealthReport = {
  return_by_stage: { stage: string; returns: number; total: number }[];
  return_trend: { label: string; Office: number; VP: number; President: number; QA: number }[];
  bottleneck: { office: string; avg_hours: number; task_count: number }[];
};

export type RequestsReportKpis = {
  total: number;
  open: number;
  closed: number;
  cancelled: number;
  acceptance_rate: number;
  avg_resubmissions: number;
  overdue: number;
};

export type RequestsReport = {
  kpis: RequestsReportKpis;
  status_distribution: { phase: string; count: number }[];
  funnel: { stage: string; count: number; color: string }[];
  attempt_distribution: { attempt: string; count: number }[];
  mode_split: { multi_office: number; multi_doc: number };
  volume_series: { label: string; created: number; approved_final: number }[];
  office_acceptance: { office: string; sent: number; accepted: number; rejected: number; rate: number }[];
};

export type ActivityTrendDatum = {
  date: string;
  Workflows: number;
  Access: number;
  System: number;
  Others: number;
  total: number;
};

export type ActivityDistributionDatum = {
  label: string;
  count: number;
};

export type TopActor = {
  user_id: number;
  full_name: string;
  office: string;
  count: number;
};

export type ActivityReportResponse = {
  daily_trend: ActivityTrendDatum[];
  distribution: ActivityDistributionDatum[];
  total_actions: number;
  top_actors: TopActor[];
};

export interface DocumentMessageSender {
  id: number;
  full_name: string;
  profile_photo_path?: string | null;
  profile_photo_url?: string | null;
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
  | "QA_PRESIDENT_APPROVE"
  | "QA_START_FINALIZATION"
  | "QA_REGISTER"
  | "QA_DISTRIBUTE"
  // Office flow
  | "OFFICE_SEND_TO_HEAD"
  | "OFFICE_HEAD_FORWARD_TO_VP"
  | "OFFICE_HEAD_RETURN_TO_STAFF"
  | "OFFICE_VP_SEND_BACK_TO_STAFF"
  | "OFFICE_START_APPROVAL"
  | "OFFICE_HEAD_FORWARD_TO_VP_APPROVAL"
  | "OFFICE_VP_FORWARD_TO_PRESIDENT"
  | "OFFICE_PRESIDENT_APPROVE"
  | "OFFICE_START_FINALIZATION"
  | "OFFICE_REGISTER"
  | "OFFICE_DISTRIBUTE"
  // Custom flow
  | "CUSTOM_FORWARD"
  | "CUSTOM_START_APPROVAL"
  | "CUSTOM_START_FINALIZATION"
  | "CUSTOM_REGISTER"
  | "CUSTOM_DISTRIBUTE";

export type WorkflowActionResult = {
  version: DocumentVersion;
  task?: WorkflowTask;
  message?: string;
};

export type AvailableActionsResponse = {
  document_version_id: number;
  actions: WorkflowActionCode[];
};

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

  actor_user?: {
    id: number;
    first_name: string;
    last_name: string;
    name?: string;
    full_name?: string;
  } | null;

  actor_office?: {
    id: number;
    code: string;
    name: string;
  } | null;

  document?: {
    id: number;
    title: string;
    code: string | null;
  } | null;
}

export type DocumentStats = {
  total: number;
  pending: number;
  distributed: number;
  by_phase?: Record<string, number>;
};

export type AdminDashboardStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
    online?: number;
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
  documents: {
    total: number;
    distributed: number;
    in_progress: number;
    by_phase?: Record<string, number>;
  };
  activity: ActivityReportResponse;
};

export type FinishedDocumentRow = {
  id: number;
  title: string;
  code: string | null;
  doctype: string;
  owner_office_id: number | null;
  owner_office_name: string | null;
  owner_office_code: string | null;
  created_by: number | null;
  created_at: string;
  version_id: number;
  version_number: number;
  status: string;
  distributed_at: string | null;
  effective_date: string | null;
  original_filename: string | null;
  file_path: string | null;
  preview_path: string | null;
};

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
