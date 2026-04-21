// src/components/documents/workflow/config/flowUtils.ts
import type { Office } from "../../../../services/documents";
import type { DocumentRouteStep } from "../../../../services/documents";
import type { FlowStep, PhaseId } from "./flowConfig";

// Removed: toWorkflowAction() — actions are now driven by backend /available-actions endpoint

export function officeIdByCode(
  offices: Office[] | null | undefined,
  code: string,
): number | null {
  if (!offices?.length) return null;
  const target = String(code || "").toUpperCase();
  return (
    offices.find((o) => String(o.code || "").toUpperCase() === target)?.id ??
    null
  );
}

import { formatDateTime } from "../../../../utils/formatters";

export function formatWhen(iso: string): string {
  return formatDateTime(iso);
}

export function findCurrentStep(status: string, steps: FlowStep[]): FlowStep {
  const found = steps.find((s) => s.statusValue === status);
  return found ?? steps[0];
}

export function phaseOrder(
  phases: { id: PhaseId }[],
  phaseId: PhaseId,
): number {
  return phases.findIndex((p) => p.id === phaseId);
}

export function officeLabelById(
  offices: Office[] | null | undefined,
  id: number,
): string {
  const o = offices?.find((x) => Number(x.id) === Number(id));
  if (!o) return `Office #${id}`;
  return `${o.name} (${o.code})`;
}

export function resolveVpCodeForOfficeCode(
  ownerCode: string | null | undefined,
): string | null {
  if (!ownerCode) return null;

  const presidentCodes = new Set(["PO", "HR", "SA", "CH", "AA"]);
  if (presidentCodes.has(ownerCode)) return "PO";

  const vpadCodes = new Set([
    "VAd",
    "PC",
    "MD",
    "SO",
    "SP",
    "SC",
    "SH",
    "BG",
    "M",
    "WP",
    "IT",
  ]);
  if (vpadCodes.has(ownerCode)) return "VAd";

  const vpfCodes = new Set(["VF", "AO", "BO", "BM", "CO", "PR", "UE"]);
  if (vpfCodes.has(ownerCode)) return "VF";

  const vprCodes = new Set(["VR", "RC", "CX", "QA", "IP"]);
  if (vprCodes.has(ownerCode)) return "VR";

  const vpCodes = new Set([
    "VA",
    "CN",
    "CB",
    "CT",
    "HS",
    "ES",
    "PS",
    "GS",
    "AS",
    "TM",
    "CS",
    "JE",
    "CE",
    "AR",
    "GC",
    "UL",
    "NS",
  ]);
  if (vpCodes.has(ownerCode)) return "VA";

  return "VA";
}

export function expectedActorOfficeId(opts: {
  fromStatus: string;
  ownerOfficeId: number | null | undefined;
  reviewOfficeId: number | null | undefined;
  ownerOfficeCode: string | null | undefined;
  offices: Office[] | null | undefined;
}): number | null {
  const {
    fromStatus,
    ownerOfficeId,
    reviewOfficeId,
    ownerOfficeCode,
    offices,
  } = opts;

  switch (fromStatus) {
    case "Draft":
    case "For QA Final Check":
    case "For QA Registration":
    case "For QA Distribution":
      return officeIdByCode(offices, "QA");

    case "For Office Review":
    case "For Office Approval":
      return reviewOfficeId ?? ownerOfficeId ?? null;

    case "For VP Review":
    case "For VP Approval": {
      const vpCode = resolveVpCodeForOfficeCode(ownerOfficeCode);
      return vpCode ? officeIdByCode(offices, vpCode) : null;
    }

    case "For President Approval":
      return officeIdByCode(offices, "PO");

    default:
      return null;
  }
}

export function buildCustomFlowSteps(opts: {
  offices: Office[] | null | undefined;
  ownerOfficeId: number | null | undefined;
  routeSteps: DocumentRouteStep[];
}): FlowStep[] | null {
  const { offices, ownerOfficeId, routeSteps } = opts;

  const ordered = [...(routeSteps ?? [])]
    .sort((a, b) => Number(a.step_order) - Number(b.step_order))
    .filter(
      (s, idx, arr) =>
        arr.findIndex((x) => Number(x.office_id) === Number(s.office_id)) ===
        idx,
    );

  if (!ordered.length) return null;

  const ownerOffice = ownerOfficeId
    ? (offices?.find((o) => Number(o.id) === Number(ownerOfficeId)) ?? null)
    : null;
  const ownerLabel = ownerOffice?.code ?? ownerOffice?.name ?? "Owner";

  const out: FlowStep[] = [];
  out.push({
    id: "draft",
    label: "Drafted",
    statusValue: "Draft",
    phase: "draft",
  });

  out.push(
    ...ordered.map((s) => ({
      id: `custom_review_office:${Number(s.office_id)}`,
      label: `${officeLabelById(offices, s.office_id)} Review`,
      statusValue: `For ${officeLabelById(offices, s.office_id)} Review`,
      phase: "review" as const,
    })),
  );

  out.push({
    id: "custom_review_back_to_originator",
    label: `Owner review check (${ownerLabel})`,
    statusValue: "For Owner Review Check",
    phase: "review",
  });

  out.push(
    ...ordered.map((s) => ({
      id: `custom_approval_office:${Number(s.office_id)}`,
      label: `${officeLabelById(offices, s.office_id)} Approval`,
      statusValue: `For ${officeLabelById(offices, s.office_id)} Approval`,
      phase: "approval" as const,
    })),
  );

  out.push({
    id: "custom_approval_back_to_originator",
    label: `Owner approval check (${ownerLabel})`,
    statusValue: "For Owner Approval Check",
    phase: "approval",
  });

  out.push(
    {
      id: "custom_registration",
      label: `Register document (${ownerLabel})`,
      statusValue: "For Registration",
      phase: "finalization",
    },
    {
      id: "custom_distribution",
      label: `Distribute document (${ownerLabel})`,
      statusValue: "For Distribution",
      phase: "finalization",
    },
    {
      id: "distributed",
      label: "Completed",
      statusValue: "Distributed",
      phase: "completed",
    },
  );

  return out;
}
