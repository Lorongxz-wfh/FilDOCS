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
