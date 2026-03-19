// src/components/documents/documentFlow/flowConfig.ts

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
    statusValue: "For QA Final Check",
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
    statusValue: "For President Approval",
    phase: "approval",
  },
  {
    id: "qa_prefinalize_check",
    label: "QA double-check",
    statusValue: "For QA Pre-Finalize Check",
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
    statusValue: "For Office Final Check",
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
    statusValue: "For President Approval",
    phase: "approval",
  },
  {
    id: "office_prefinalize_check",
    label: "Office double-check",
    statusValue: "For Office Pre-Finalize Check",
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
  QA_SEND_TO_OFFICE_REVIEW: "Send for review",
  QA_OFFICE_FORWARD_TO_VP: "Forward to VP",
  QA_OFFICE_RETURN_TO_QA: "Return to QA",
  QA_VP_SEND_BACK_TO_QA: "Send back to QA",
  QA_START_OFFICE_APPROVAL: "Start approval",
  QA_OFFICE_FORWARD_TO_VP_APPROVAL: "Forward to VP for approval",
  QA_VP_FORWARD_TO_PRESIDENT: "Forward to President",
  QA_PRESIDENT_SEND_BACK_TO_QA: "Send back to QA",
  QA_REGISTER: "Register document",
  QA_DISTRIBUTE: "Distribute document",
  OFFICE_SEND_TO_HEAD: "Send to Office Head",
  OFFICE_HEAD_FORWARD_TO_VP: "Forward to VP",
  OFFICE_HEAD_RETURN_TO_STAFF: "Return to staff",
  OFFICE_VP_SEND_BACK_TO_STAFF: "Send back to staff",
  OFFICE_SEND_TO_QA_APPROVAL: "Send to QA for approval",
  OFFICE_QA_RETURN_TO_STAFF: "Return to staff",
  OFFICE_QA_APPROVE: "Approve",
  OFFICE_REGISTER: "Register document",
  OFFICE_DISTRIBUTE: "Distribute document",
  CUSTOM_FORWARD: "Forward",
  CUSTOM_START_APPROVAL: "Start approval phase",
  CUSTOM_START_FINALIZATION: "Start finalization",
  CUSTOM_REGISTER: "Register document",
  CUSTOM_DISTRIBUTE: "Distribute document",
  REJECT: "Reject",
};

/** Sort order for workflow actions — lower = higher priority in the UI. */
export const ACTION_PRIORITY: Record<string, number> = {
  QA_SEND_TO_OFFICE_REVIEW: 10,
  QA_OFFICE_FORWARD_TO_VP: 20,
  QA_OFFICE_RETURN_TO_QA: 25,
  QA_VP_SEND_BACK_TO_QA: 30,
  QA_START_OFFICE_APPROVAL: 40,
  QA_OFFICE_FORWARD_TO_VP_APPROVAL: 50,
  QA_VP_FORWARD_TO_PRESIDENT: 60,
  QA_PRESIDENT_SEND_BACK_TO_QA: 70,
  QA_REGISTER: 80,
  QA_DISTRIBUTE: 90,
  OFFICE_SEND_TO_HEAD: 10,
  OFFICE_HEAD_FORWARD_TO_VP: 20,
  OFFICE_HEAD_RETURN_TO_STAFF: 25,
  OFFICE_VP_SEND_BACK_TO_STAFF: 30,
  OFFICE_SEND_TO_QA_APPROVAL: 40,
  OFFICE_QA_APPROVE: 50,
  OFFICE_QA_RETURN_TO_STAFF: 55,
  OFFICE_REGISTER: 60,
  OFFICE_DISTRIBUTE: 70,
  CUSTOM_FORWARD: 10,
  CUSTOM_START_APPROVAL: 20,
  CUSTOM_START_FINALIZATION: 25,
  CUSTOM_REGISTER: 30,
  CUSTOM_DISTRIBUTE: 40,
  CANCEL_DOCUMENT: 998,
  REJECT: 999,
};
