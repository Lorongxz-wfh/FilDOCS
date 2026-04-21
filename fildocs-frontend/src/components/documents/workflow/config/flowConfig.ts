// src/components/documents/workflow/config/flowConfig.ts

export type PhaseId =
  | "draft"
  | "review"
  | "approval"
  | "finalization"
  | "completed";

export type Phase = {
  id: PhaseId;
  label: string;
};

export const phases: Phase[] = [
  { id: "draft", label: "Draft" },
  { id: "review", label: "Review" },
  { id: "approval", label: "Approval" },
  { id: "finalization", label: "Finalization" },
  { id: "completed", label: "Completed" },
];

export type FlowStep = {
  id: string;
  label: string;
  statusValue: string;
  phase: PhaseId;
};

export const flowStepsQa: FlowStep[] = [
  { id: "draft", label: "Drafted by QA", statusValue: "Draft", phase: "draft" },
  {
    id: "office_review",
    label: "Office review",
    statusValue: "For Office Review",
    phase: "review",
  },
  {
    id: "vp_review",
    label: "VP review",
    statusValue: "For VP Review",
    phase: "review",
  },
  {
    id: "qafinalcheck",
    label: "QA double-check",
    statusValue: "For QA Review Check",
    phase: "review",
  },
  {
    id: "office_approval",
    label: "Office approval",
    statusValue: "For Office Approval",
    phase: "approval",
  },
  {
    id: "vp_approval",
    label: "VP approval",
    statusValue: "For VP Approval",
    phase: "approval",
  },
  {
    id: "pres_approval",
    label: "President approval",
    statusValue: "For President's Approval",
    phase: "approval",
  },
  {
    id: "qa_prefinalize_check",
    label: "QA double-check",
    statusValue: "For QA Approval Check",
    phase: "approval",
  },
  {
    id: "qa_registration",
    label: "Register document",
    statusValue: "For Registration",
    phase: "finalization",
  },
  {
    id: "qa_distribution",
    label: "Distribute document",
    statusValue: "For Distribution",
    phase: "finalization",
  },
  {
    id: "distributed",
    label: "Completed",
    statusValue: "Distributed",
    phase: "completed",
  },
];

export const flowStepsOffice: FlowStep[] = [
  {
    id: "office_draft",
    label: "Office draft",
    statusValue: "Office Draft",
    phase: "draft",
  },
  {
    id: "office_head_review",
    label: "Office Head review",
    statusValue: "For Office Head Review",
    phase: "review",
  },
  {
    id: "office_vp_review",
    label: "VP review",
    statusValue: "For VP Review",
    phase: "review",
  },
  {
    id: "office_final_check",
    label: "Office double-check",
    statusValue: "For Staff Review Check",
    phase: "review",
  },
  {
    id: "office_head_approval",
    label: "Office Head approval",
    statusValue: "For Office Head Approval",
    phase: "approval",
  },
  {
    id: "office_vp_approval",
    label: "VP approval",
    statusValue: "For VP Approval",
    phase: "approval",
  },
  {
    id: "office_pres_approval",
    label: "President approval",
    statusValue: "For President's Approval",
    phase: "approval",
  },
  {
    id: "office_prefinalize_check",
    label: "Office double-check",
    statusValue: "For Staff Approval Check",
    phase: "approval",
  },
  {
    id: "office_registration",
    label: "Register document",
    statusValue: "For Registration",
    phase: "finalization",
  },
  {
    id: "office_distribution",
    label: "Distribute document",
    statusValue: "For Distribution",
    phase: "finalization",
  },
  {
    id: "distributed",
    label: "Completed",
    statusValue: "Distributed",
    phase: "completed",
  },
];

// Removed: transitionsQa, transitionsOffice, transitionsCustom, TransitionAction
// Actions are now driven by backend /available-actions endpoint.
// flowStepsQa and flowStepsOffice are kept for the progress bar UI only.

/** Human-readable label for each workflow action code. */
export const ACTION_LABELS: Record<string, string> = {
  CANCEL_DOCUMENT: "Cancel document",
  // QA flow
  QA_SEND_TO_OFFICE_REVIEW: "Submit for review",
  QA_OFFICE_FORWARD_TO_VP: "Forward",
  QA_VP_SEND_BACK_TO_QA: "Forward to QA",
  QA_START_OFFICE_APPROVAL: "Start approval",
  QA_OFFICE_FORWARD_TO_VP_APPROVAL: "Approve",
  QA_VP_FORWARD_TO_PRESIDENT: "Approve",
  QA_PRESIDENT_APPROVE: "Approve",
  QA_START_FINALIZATION: "Start finalization",
  QA_REGISTER: "Register",
  QA_DISTRIBUTE: "Distribute",
  // Office flow
  OFFICE_SEND_TO_HEAD: "Submit for review",
  OFFICE_HEAD_FORWARD_TO_VP: "Forward",
  OFFICE_VP_SEND_BACK_TO_STAFF: "Forward to creator",
  OFFICE_START_APPROVAL: "Start approval",
  OFFICE_HEAD_FORWARD_TO_VP_APPROVAL: "Approve",
  OFFICE_VP_FORWARD_TO_PRESIDENT: "Approve",
  OFFICE_PRESIDENT_APPROVE: "Approve",
  OFFICE_START_FINALIZATION: "Start finalization",
  OFFICE_REGISTER: "Register",
  OFFICE_DISTRIBUTE: "Distribute",
  // Custom flow
  CUSTOM_FORWARD: "Forward",
  CUSTOM_START_APPROVAL: "Start approval",
  CUSTOM_START_FINALIZATION: "Start finalization",
  CUSTOM_REGISTER: "Register",
  CUSTOM_DISTRIBUTE: "Distribute",
  REJECT: "Reject",
};

/** Contextual confirmation message for each workflow action code. */
export const ACTION_CONFIRM_MESSAGES: Record<string, string> = {
  // QA flow
  QA_SEND_TO_OFFICE_REVIEW:
    "This document will be submitted for review and assigned to the recipient office.",
  QA_OFFICE_FORWARD_TO_VP:
    "You are confirming your review. This document will be forwarded to the VP for further review.",
  QA_VP_SEND_BACK_TO_QA:
    "Review is complete. This will forward the document to QA for a final check before the approval phase begins.",
  QA_START_OFFICE_APPROVAL:
    "This will move the document into the approval phase and notify the approving office.",
  QA_OFFICE_FORWARD_TO_VP_APPROVAL:
    "You are confirming your approval. This document will be forwarded to the VP for approval.",
  QA_VP_FORWARD_TO_PRESIDENT:
    "You are confirming your approval. This document will be forwarded to the President for final sign-off.",
  QA_PRESIDENT_APPROVE:
    "You are giving final approval for this document. It will be sent back to QA for a final check before finalization.",
  QA_START_FINALIZATION:
    "Approval is complete. This will move the document into the finalization phase. Note: Once you enter this phase, you can no longer cancel or revert the document. This action is final.",
  QA_REGISTER:
    "This will officially register the document and assign it a document number.",
  QA_DISTRIBUTE:
    "This will distribute the document to all recipients. This action cannot be undone.",
  // Office flow
  OFFICE_SEND_TO_HEAD:
    "This document will be submitted to the Office Head for review.",
  OFFICE_HEAD_FORWARD_TO_VP:
    "You are confirming your review. This document will be forwarded to the VP for further review.",
  OFFICE_VP_SEND_BACK_TO_STAFF:
    "Review is complete. This will forward the document to the creator for a final check before the approval phase begins.",
  OFFICE_START_APPROVAL: "This will move the document into the approval phase.",
  OFFICE_HEAD_FORWARD_TO_VP_APPROVAL:
    "You are confirming your approval. This document will be forwarded to the VP for approval.",
  OFFICE_VP_FORWARD_TO_PRESIDENT:
    "You are confirming your approval. This document will be forwarded to the President for final sign-off.",
  OFFICE_PRESIDENT_APPROVE:
    "You are giving final approval for this document. It will be sent back to the creator for a final check before finalization.",
  OFFICE_START_FINALIZATION:
    "Approval is complete. This will move the document into the finalization phase. Note: Once you enter this phase, you can no longer cancel or revert the document. This action is final.",
  OFFICE_REGISTER:
    "This will officially register the document and assign it a document number.",
  OFFICE_DISTRIBUTE:
    "This will distribute the document to all recipients. This action cannot be undone.",
  // Custom flow
  CUSTOM_FORWARD:
    "Your review is confirmed. The document will be forwarded to the next recipient.",
  CUSTOM_START_APPROVAL:
    "Review is complete. This will move the document into the approval phase.",
  CUSTOM_START_FINALIZATION:
    "Approval is complete. This will move the document into the finalization phase. Note: Once you enter this phase, you can no longer cancel or revert the document. This action is final.",
  CUSTOM_REGISTER:
    "This will officially register the document and assign it a document number.",
  CUSTOM_DISTRIBUTE:
    "This will distribute the document to all recipients. This action cannot be undone.",
};

/** Sort order for workflow actions — lower = higher priority in the UI. */
export const ACTION_PRIORITY: Record<string, number> = {
  // QA flow
  QA_SEND_TO_OFFICE_REVIEW: 10,
  QA_OFFICE_FORWARD_TO_VP: 20,
  QA_VP_SEND_BACK_TO_QA: 30,
  QA_START_OFFICE_APPROVAL: 40,
  QA_OFFICE_FORWARD_TO_VP_APPROVAL: 50,
  QA_VP_FORWARD_TO_PRESIDENT: 60,
  QA_PRESIDENT_APPROVE: 70,
  QA_START_FINALIZATION: 75,
  QA_REGISTER: 80,
  QA_DISTRIBUTE: 90,
  // Office flow
  OFFICE_SEND_TO_HEAD: 10,
  OFFICE_HEAD_FORWARD_TO_VP: 20,
  OFFICE_VP_SEND_BACK_TO_STAFF: 30,
  OFFICE_START_APPROVAL: 40,
  OFFICE_HEAD_FORWARD_TO_VP_APPROVAL: 50,
  OFFICE_VP_FORWARD_TO_PRESIDENT: 60,
  OFFICE_PRESIDENT_APPROVE: 70,
  OFFICE_START_FINALIZATION: 75,
  OFFICE_REGISTER: 80,
  OFFICE_DISTRIBUTE: 90,
  // Custom flow
  CUSTOM_FORWARD: 10,
  CUSTOM_START_APPROVAL: 20,
  CUSTOM_START_FINALIZATION: 25,
  CUSTOM_REGISTER: 30,
  CUSTOM_DISTRIBUTE: 40,
  CANCEL_DOCUMENT: 998,
  REJECT: 999,
};
