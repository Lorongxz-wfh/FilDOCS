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
