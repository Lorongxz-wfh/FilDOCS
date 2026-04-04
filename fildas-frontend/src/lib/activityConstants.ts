/**
 * Canonical mapping for Activity Log events, dot colors, and human-readable field labels.
 * Used across DocumentActivityPanel and RequestActivityPanel for consistency.
 */

export const EVENT_DOT: Record<string, string> = {
  // Document Flow
  "workflow.rejected":         "bg-rose-500",
  "workflow.cancelled":        "bg-rose-400",
  "version.deleted":           "bg-rose-400",
  "version.cancelled":         "bg-rose-400",
  "workflow.distributed":      "bg-emerald-500",
  "workflow.registered":       "bg-emerald-400",
  "workflow.sent_to_review":   "bg-sky-400",
  "workflow.sent_to_approval": "bg-violet-400",
  "workflow.forwarded_to_vp":  "bg-violet-400",
  "workflow.forwarded_to_president": "bg-violet-500",
  "workflow.returned_for_check":     "bg-amber-400",
  "workflow.returned_to_draft":      "bg-amber-400",
  "document.created":          "bg-slate-400",
  "document.field_changed":    "bg-slate-400",
  "version.revision_created":  "bg-slate-400",
  
  // Document Requests
  "document_request.created":              "bg-sky-500",
  "document_request.updated":              "bg-sky-400",
  "document_request_item.updated":         "bg-violet-400",
  "document_request_recipient.updated":    "bg-amber-400",
  "document_request.submission.submitted": "bg-sky-400",
  "document_request.submission.accepted":  "bg-emerald-500",
  "document_request.submission.rejected":  "bg-rose-500",
  "document_request.closed":               "bg-slate-500",
  "document_request.cancelled":            "bg-rose-400",

  // System Health
  "system.maintenance_updated":            "bg-sky-500",
  "system.maintenance_scheduled":          "bg-amber-500",
  "system.maintenance_cancelled":          "bg-rose-400",
  "system.diagnostics_run":                "bg-indigo-500",
  "system.test_mail_sent":                 "bg-emerald-500",
};

export const EVENT_LABEL: Record<string, string> = {
  // Document Flow
  "workflow.rejected":         "Rejected — returned to draft",
  "workflow.cancelled":        "Document cancelled",
  "version.deleted":           "Draft deleted",
  "version.cancelled":         "Draft cancelled",
  "workflow.distributed":      "Document distributed",
  "workflow.registered":       "Document registered",
  "workflow.sent_to_review":   "Forwarded for review",
  "workflow.sent_to_approval": "Forwarded for approval",
  "workflow.forwarded_to_vp":  "Forwarded to VP",
  "workflow.forwarded_to_president": "Forwarded to President",
  "workflow.returned_for_check":     "Returned for check",
  "workflow.returned_to_draft":      "Returned to draft",
  "document.created":          "Document created",
  "document.field_changed":    "Details updated",
  "version.revision_created":  "Revision started",
  "version.file_uploaded":     "File uploaded",
  "version.file_replaced":     "File replaced",
  "document.tags_updated":     "Tags updated",
  "document.updated":          "Document updated",
  "version.updated":           "Version updated",
  "version.downloaded":        "File downloaded",

  // Document Requests
  "document_request.created":              "Request batch created",
  "document_request.updated":              "Request details updated",
  "document_request_item.updated":         "Item details updated",
  "document_request_recipient.updated":    "Recipient due date updated",
  "document_request.submission.submitted": "Evidence submitted",
  "document_request.submission.accepted":  "Evidence accepted",
  "document_request.submission.rejected":  "Evidence rejected",
  "document_request.closed":               "Request closed",
  "document_request.cancelled":            "Request cancelled",

  // System Health
  "system.maintenance_updated":            "System maintenance updated",
  "system.maintenance_scheduled":          "System maintenance scheduled",
  "system.maintenance_cancelled":          "System maintenance cancelled",
  "system.diagnostics_run":                "System diagnostics performed",
  "system.test_mail_sent":                 "System test email sent",
};

export const FIELD_LABEL: Record<string, string> = {
  title:            "Title",
  description:      "Description",
  due_at:           "Due date",
  effective_date:   "Effective date",
  doctype:          "Document Type",
  visibility_scope: "Visibility",
  school_year:      "School Year",
  semester:         "Semester",
  owner_office_id:  "Owner Office",
};
