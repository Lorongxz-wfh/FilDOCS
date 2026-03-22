import React from "react";
import { XCircle, AlertTriangle, Upload, CheckCircle2 } from "lucide-react";
import WorkflowProgressCard from "./documentFlow/WorkflowProgressCard";
import DocumentRightPanel from "./documentFlow/DocumentRightPanel";
import DocumentPreviewWrapper from "./documentFlow/DocumentPreviewWrapper";
import DeleteDraftConfirmModal from "./documentFlow/DeleteDraftConfirmModal";

import {
  type Document,
  type DocumentVersion,
  type WorkflowTask,
  type Office,
  getCurrentUserOfficeId,
  listOffices,
  getDocumentPreviewLink,
  getDocumentRouteSteps,
  type DocumentRouteStep,
  deleteDraftVersion,
  downloadDocument,
  postDocumentMessage,
} from "../../services/documents";

import { useToast } from "../ui/toast/ToastContext";
import { getAuthUser } from "../../lib/auth";
import { useDocumentWorkflow } from "../../hooks/useDocumentWorkflow";
import { useDocumentAutoSave } from "../../hooks/useDocumentAutoSave";
import { useDocumentFileUpload } from "../../hooks/useDocumentFileUpload";

import {
  phases,
  flowStepsOffice,
  flowStepsQa,
  ACTION_LABELS,
  ACTION_PRIORITY,
} from "./documentFlow/flowConfig";
import {
  buildCustomFlowSteps,
  findCurrentStep,
  formatWhen,
  officeIdByCode,
  phaseOrder,
} from "./documentFlow/flowUtils";

export type HeaderActionButton = {
  key: string;
  label: string;
  variant: "primary" | "danger" | "outline";
  disabled?: boolean;
  skipConfirm?: boolean;
  onClick: () => Promise<void> | void;
};

export type DocumentFlowHeaderState = {
  title: string;
  code: string;
  status: string;
  versionNumber: number;
  canAct: boolean;
  isTasksReady: boolean;
  headerActions: HeaderActionButton[];
  versionActions: HeaderActionButton[];
};

interface DocumentFlowProps {
  isPageLoading?: boolean;
  isExternalUploading?: boolean;
  document: Document | null;
  version: DocumentVersion | null;
  allVersions?: DocumentVersion[];
  selectedVersion?: DocumentVersion | null;
  isLoadingSelectedVersion?: boolean;
  onSelectVersion?: (v: DocumentVersion) => void;
  onChanged?: () => Promise<void> | void;
  onHeaderStateChange?: (s: DocumentFlowHeaderState) => void;
  onAfterActionClose?: () => void;
  onRightPanelContent?: (content: React.ReactNode) => void;
  adminDebugMode?: boolean;
}

const DocumentFlow: React.FC<DocumentFlowProps> = ({
  // isPageLoading = false,
  isExternalUploading = false,
  document,
  version,
  allVersions = [],
  selectedVersion,
  isLoadingSelectedVersion = false,
  onSelectVersion,
  onChanged,
  onHeaderStateChange,
  onAfterActionClose,
  onRightPanelContent,
  adminDebugMode = false,
}) => {
  const { push } = useToast();
  const myOfficeId = getCurrentUserOfficeId();
  const myUserId = Number(getAuthUser()?.id ?? 0);

  // ── Delete/cancel confirmation state ─────────────────────────
  const [pendingDelete, setPendingDelete] = React.useState<
    "draft" | "revision" | null
  >(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  // ── Local version + field state ──────────────────────────────
  const [localVersion, setLocalVersion] = React.useState(version ?? null);
  const [localTitle, setLocalTitle] = React.useState(document?.title ?? "");
  const [initialTitle, setInitialTitle] = React.useState(document?.title ?? "");
  const [localDesc, setLocalDesc] = React.useState(version?.description ?? "");
  const [initialDesc, setInitialDesc] = React.useState(
    version?.description ?? "",
  );
  const [localEffectiveDate, setLocalEffectiveDate] = React.useState(
    String((version as any)?.effective_date ?? "").slice(0, 10),
  );
  const [initialEffectiveDate, setInitialEffectiveDate] = React.useState(
    String((version as any)?.effective_date ?? "").slice(0, 10),
  );

  // ── Offices + route steps ────────────────────────────────────
  const [offices, setOffices] = React.useState<Office[]>([]);
  const [routeSteps, setRouteSteps] = React.useState<DocumentRouteStep[]>([]);

  React.useEffect(() => {
    let alive = true;
    listOffices()
      .then((d) => {
        if (alive) setOffices(d);
      })
      .catch(() => {
        if (alive) setOffices([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  React.useEffect(() => {
    if (!localVersion) return;
    let alive = true;
    getDocumentRouteSteps(localVersion.id)
      .then((r) => {
        if (alive) setRouteSteps(Array.isArray(r.steps) ? r.steps : []);
      })
      .catch(() => {
        if (alive) setRouteSteps([]);
      });
    return () => {
      alive = false;
    };
  }, [localVersion?.id]);

  // ── Sync when version prop changes ───────────────────────────
  React.useEffect(() => {
    if (!version || !document) return;
    setLocalVersion(version);
    setLocalTitle(document.title);
    setInitialTitle(document.title);
    setLocalDesc(version.description ?? "");
    setInitialDesc(version.description ?? "");
    const ed = String((version as any)?.effective_date ?? "").slice(0, 10);
    setLocalEffectiveDate(ed);
    setInitialEffectiveDate(ed);
  }, [
    document?.id,
    version?.id,
    version?.status,
    version?.preview_path,
    version?.file_path,
    (version as any)?.signed_file_path,
    (version as any)?.needs_file_replacement,
  ]);

  // ── Preview ──────────────────────────────────────────────────
  const [signedPreviewUrl, setSignedPreviewUrl] = React.useState("");
  const [isPreviewLoading, setIsPreviewLoading] = React.useState(false);
  const [previewNonce, setPreviewNonce] = React.useState(0);
  const previewUrlCacheRef = React.useRef<Record<string, string>>({});

  // Track previous preview_path to detect changes from polling
  const prevPreviewPathRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (!localVersion) return;
    let alive = true;

    if (!localVersion.preview_path) {
      setSignedPreviewUrl("");
      setIsPreviewLoading(false);
      setPreviewNonce((n) => n + 1);
      prevPreviewPathRef.current = null;
      return;
    }

    const pathChanged =
      localVersion.preview_path !== prevPreviewPathRef.current;
    prevPreviewPathRef.current = localVersion.preview_path;

    // If path changed (new file uploaded by anyone), nuke cache and force re-fetch
    if (pathChanged) {
      delete previewUrlCacheRef.current[localVersion.preview_path];
    }

    // Reuse cached URL if preview_path hasn't changed and cache is warm
    const cached = previewUrlCacheRef.current[localVersion.preview_path];
    if (cached && !pathChanged) {
      setSignedPreviewUrl(cached);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    if (pathChanged) setPreviewNonce((n) => n + 1);

    getDocumentPreviewLink(localVersion.id)
      .then((r) => {
        if (alive) {
          previewUrlCacheRef.current[localVersion.preview_path!] = r.url;
          setSignedPreviewUrl(r.url);
          setIsPreviewLoading(false);
          // Bump nonce again after URL is ready to force iframe reload
          setPreviewNonce((n) => n + 1);
        }
      })
      .catch(() => {
        if (alive) {
          setSignedPreviewUrl("");
          setIsPreviewLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [localVersion?.id, localVersion?.preview_path]);

  // ── Derived ──────────────────────────────────────────────────
  const qaOfficeId = offices?.length ? officeIdByCode(offices, "QA") : null;
  const isQAOfficeUser = !!qaOfficeId && myOfficeId === qaOfficeId;
  const isQAStep = [
    "Draft",
    "For QA Final Check",
    "For QA Registration",
    "For QA Distribution",
    "QA_EDIT",
  ].includes(localVersion?.status ?? "");
  const canEditEffectiveDate = isQAOfficeUser && isQAStep;

  // ── Tabs ─────────────────────────────────────────────────────
  const [activeSideTab, setActiveSideTab] = React.useState<"comments" | "logs">(
    "comments",
  );

  // Stop polling for terminal statuses — no workflow changes possible
  const terminalStatuses = new Set(["Distributed", "Cancelled", "Superseded"]);
  // Check version prop too — localVersion may be null on first render
  const effectiveStatus = localVersion?.status ?? version?.status ?? "";
  const isTerminal = terminalStatuses.has(effectiveStatus);

  // ── Workflow hook ────────────────────────────────────────────────────
  // For terminal statuses: pass versionId for data loading (messages/logs)
  // but polling is suppressed inside the hook via isTerminal flag
  const workflow = useDocumentWorkflow({
    versionId: localVersion?.id && localVersion.id > 0 ? localVersion.id : 0,
    isTerminal,
    activeSideTab,
    onChanged,
    onAfterActionClose,
    myOfficeId,
    qaOfficeId,
    adminDebugMode,
  });

  // ── Auto-save hook ───────────────────────────────────────────
  useDocumentAutoSave({
    documentId: document?.id ?? 0,
    version: (localVersion ?? version) as DocumentVersion,
    localTitle,
    initialTitle,
    setInitialTitle,
    localDesc,
    initialDesc,
    setInitialDesc,
    localEffectiveDate,
    initialEffectiveDate,
    setInitialEffectiveDate,
    canEditEffectiveDate,
    onVersionUpdated: (v) =>
      setLocalVersion((prev) =>
        prev ? { ...prev, ...v } : (v as DocumentVersion),
      ),
    onChanged,
  });

  // ── File upload hook ─────────────────────────────────────────
  const fileUpload = useDocumentFileUpload({
    versionId: localVersion?.id ?? 0,
    onUploadComplete: async () => {
      if (isActiveApprover) setApproverHasUploaded(true);
      // Nuke entire preview cache — force fresh signed URL fetch
      previewUrlCacheRef.current = {};
      setSignedPreviewUrl("");
      setIsPreviewLoading(true);
      setPreviewNonce((n) => n + 1);
      // Refresh version data so file_path + preview_path are updated
      if (onChanged) await onChanged();
      // After version refreshed, the preview useEffect will re-run
      // because localVersion.preview_path will have changed.
      // Bump nonce again to force iframe key change even if path is same.
      setPreviewNonce((n) => n + 1);
    },
  });

  // ── When polling detects a stage change, refresh version data ────────────
  // taskChanged fires when assigned_office_id or availableActions change,
  // meaning the workflow moved to a new step. We must re-fetch localVersion
  // so isInApprovalPhase / needsSignedFile / canAct recompute correctly.
  React.useEffect(() => {
    if (!workflow.taskChanged) return;
    workflow.clearTaskChanged();
    if (onChanged) void Promise.resolve(onChanged()).catch(() => {});
  }, [workflow.taskChanged]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Workflow update indicator (handled in WorkflowTaskPanel) ──────────
  const workflowUpdatedTimerRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    return () => {
      if (workflowUpdatedTimerRef.current)
        window.clearTimeout(workflowUpdatedTimerRef.current);
    };
  }, []);

  // ── Current task + step ──────────────────────────────────────
  const [currentTask, setCurrentTask] = React.useState<WorkflowTask | null>(
    null,
  );

  React.useEffect(() => {
    if (!currentTask) return;
    console.log("[currentTask]", JSON.stringify(currentTask, null, 2));
  }, [currentTask]);

  React.useEffect(() => {
    if (!workflow.tasks.length) {
      setCurrentTask(null);
      return;
    }
    setCurrentTask(
      workflow.tasks.find((t) => t.status === "open") ??
        workflow.tasks[0] ??
        null,
    );
  }, [workflow.tasks]);

  const isCustomRouting = routeSteps.length > 0;
  const workflowType = String(
    (localVersion as any)?.workflow_type ?? "",
  ).toLowerCase();
  const officeStatuses = new Set([
    "Office Draft",
    "For Office Head Review",
    "For VP Review (Office)",
    "For QA Approval (Office)",
  ]);
  const isOfficeFlow =
    workflowType === "office" || officeStatuses.has(localVersion?.status ?? "");
  const ownerOfficeIdForFlow =
    (document as any)?.owner_office_id ??
    (document as any)?.office_id ??
    document?.ownerOffice?.id ??
    (document as any)?.office?.id ??
    null;

  // ── Debug ─────────────────────────────────────────────────
  // React.useEffect(() => {
  //   console.log("[flow debug]", {
  //     owner_office_id: (document as any)?.owner_office_id,
  //     ownerOffice: document?.ownerOffice,
  //     ownerOfficeIdForFlow,
  //     officesCount: offices.length,
  //     matchedOffice: offices.find(
  //       (o) => Number(o.id) === Number(ownerOfficeIdForFlow),
  //     ),
  //   });
  // }, [document, offices, ownerOfficeIdForFlow]);

  // React.useEffect(() => {
  //   if (!document) return;
  //   console.log("[document raw]", JSON.stringify(document, null, 2));
  // }, [document?.id]);

  const customFlowSteps = React.useMemo(
    () =>
      routeSteps.length > 0 && offices.length > 0
        ? buildCustomFlowSteps({
            offices,
            ownerOfficeId: ownerOfficeIdForFlow,
            routeSteps,
          })
        : null,
    [routeSteps, offices, ownerOfficeIdForFlow],
  );

  const isCustomRoutingPending = isCustomRouting && customFlowSteps === null;
  const activeFlowSteps =
    customFlowSteps ?? (isOfficeFlow ? flowStepsOffice : flowStepsQa);

  const currentStep = (() => {
    if (isCustomRoutingPending && !currentTask?.step) return activeFlowSteps[0];
    if (isCustomRouting && currentTask?.step) {
      const assignedId = currentTask?.assigned_office_id ?? null;
      if (
        (currentTask.step === "custom_office_review" ||
          currentTask.step === "custom_review_office") &&
        assignedId
      ) {
        const hit = activeFlowSteps.find(
          (s) => s.id === `custom_review_office:${Number(assignedId)}`,
        );
        if (hit) return hit;
      }
      if (
        (currentTask.step === "custom_office_approval" ||
          currentTask.step === "custom_approval_office") &&
        assignedId
      ) {
        const hit = activeFlowSteps.find(
          (s) => s.id === `custom_approval_office:${Number(assignedId)}`,
        );
        if (hit) return hit;
      }
      // Map backend step names → flowUtils step ids
      const stepIdMap: Record<string, string> = {
        custom_back_to_owner: "custom_review_back_to_originator",
        custom_review_back_to_owner: "custom_review_back_to_originator",
        custom_back_to_owner_approval: "custom_approval_back_to_originator",
        custom_approval_back_to_owner: "custom_approval_back_to_originator",
        custom_registration: "custom_registration",
        custom_distribution: "custom_distribution",
        distributed: "distributed",
        draft: "draft",
      };
      const mappedId = stepIdMap[currentTask.step] ?? currentTask.step;
      const exact = activeFlowSteps.find((s) => s.id === mappedId);
      if (exact) return exact;
    }
    return findCurrentStep(localVersion?.status ?? "Draft", activeFlowSteps);
  })();

  const currentPhase =
    phases.find((p) => p.id === currentStep.phase) ?? phases[0];
  const currentPhaseIndex = phaseOrder(phases, currentPhase.id);
  const currentGlobalIndex = activeFlowSteps.findIndex(
    (s) => s.id === currentStep.id,
  );
  const nextStep =
    currentGlobalIndex >= 0
      ? (activeFlowSteps[currentGlobalIndex + 1] ?? null)
      : null;

  const assignedOfficeId = currentTask?.assigned_office_id ?? null;
  const canAct =
    adminDebugMode ||
    (!!assignedOfficeId && Number(myOfficeId) === Number(assignedOfficeId));
  const fullCode = document?.code ?? "CODE-NOT-AVAILABLE";

  // ── Signing state ─────────────────────────────────────────────────────
  // Match approval statuses across all flows — use pattern for custom flow
  const isInApprovalPhase = (() => {
    const s = localVersion?.status ?? "";
    // QA flow exact statuses
    if (s === "For Office Approval") return true;
    if (s === "For VP Approval") return true;
    if (s === "For President's Approval") return true;
    if (s === "For QA Approval Check") return true;
    // Office flow exact statuses
    if (s === "For Office Head Approval") return true;
    if (s === "For Staff Approval Check") return true;
    // Custom flow: "For {OfficCode} Approval"
    if (/^For .+ Approval$/.test(s)) return true;
    return false;
  })();
  // Pre-finalize check = creator confirms before registration (approval phase but no signing needed)
  const FINALIZATION_ACTION_CODES = [
    "QA_START_FINALIZATION",
    "OFFICE_START_FINALIZATION",
    "CUSTOM_START_FINALIZATION",
  ];
  const isPreFinalizeCheck =
    isInApprovalPhase &&
    workflow.availableActions.some((a) =>
      FINALIZATION_ACTION_CODES.includes(a),
    );
  // Active approver = has non-cancel actions, is in approval phase, not at pre-finalize check
  const isActiveApprover = isInApprovalPhase && canAct && !isPreFinalizeCheck;

  // Pre-approval creator check = creator must upload signed file before starting approval
  const PRE_APPROVAL_START_ACTIONS = [
    "QA_START_OFFICE_APPROVAL",
    "OFFICE_START_APPROVAL",
    "CUSTOM_START_APPROVAL",
  ];
  const isPreApprovalCreatorCheck =
    canAct &&
    workflow.availableActions.some((a) =>
      PRE_APPROVAL_START_ACTIONS.includes(a),
    );
  const hasSignedFile = !!(localVersion as any)?.signed_file_path;

  const [approverHasDownloaded, setApproverHasDownloaded] =
    React.useState(false);
  const [approverHasUploaded, setApproverHasUploaded] = React.useState(false);
  // Approver must download then upload signed copy before forwarding
  const approverNeedsSignedUpload =
    isActiveApprover && (!approverHasDownloaded || !approverHasUploaded);

  // ── Rejection replacement state ───────────────────────────────────────────
  // After rejection, owner must upload a revised file before forwarding again
  const isDraftStatus =
    localVersion?.status === "Draft" || localVersion?.status === "Office Draft";
  const needsFileReplacement =
    isDraftStatus && canAct && !!(localVersion as any)?.needs_file_replacement;

  // Shared post-action handler — refreshes preview if file changed
  const handleActionResult = React.useCallback(
    (res: Awaited<ReturnType<typeof workflow.submitAction>>) => {
      if (!res) return;
      const newPreviewPath = res.version.preview_path ?? null;
      const oldPreviewPath = localVersion?.preview_path ?? null;
      if (!localVersion) return;
      if (newPreviewPath !== oldPreviewPath) {
        // Clear cache for old path and force re-fetch
        if (oldPreviewPath) delete previewUrlCacheRef.current[oldPreviewPath];
        if (newPreviewPath) delete previewUrlCacheRef.current[newPreviewPath];
        setPreviewNonce((n) => n + 1);
      }
      setLocalVersion((prev) =>
        prev ? { ...prev, ...res.version } : (res.version as DocumentVersion),
      );
    },
    [localVersion?.preview_path],
  );

  const canReplace =
    localVersion?.status === "Draft" || localVersion?.status === "Office Draft";

  const headerActions: HeaderActionButton[] = React.useMemo(() => {
    const cancelBlockedStatuses = new Set([
      "For Registration",
      "For Distribution",
      "Distributed",
      "Superseded",
      "Cancelled",
    ]);
    const showCancel = !cancelBlockedStatuses.has(localVersion?.status ?? "");

    // Show "Replace file" prominently when the doc was returned/rejected
    const wasReturnedOrRejected = workflow.tasks.some(
      (t) => t.status === "returned" || t.status === "rejected",
    );
    const showReplaceAction =
      canReplace && wasReturnedOrRejected && canAct && !isActiveApprover;

    const replaceAction: HeaderActionButton | null = showReplaceAction
      ? {
          key: "REPLACE_FILE",
          label: "Replace file",
          variant: "outline",
          disabled: workflow.isChangingStatus,
          onClick: async () => fileUpload.triggerFilePicker(),
        }
      : null;

    // Cancel button config (always built separately so it shows even during approval sequence)
    const cancelBtn =
      workflow.availableActions.includes("CANCEL_DOCUMENT") && showCancel
        ? [
            {
              key: "CANCEL_DOCUMENT",
              label: ACTION_LABELS["CANCEL_DOCUMENT"] ?? "Cancel document",
              variant: "danger" as const,
              disabled: workflow.isChangingStatus,
              onClick: async () => {
                try {
                  const res = await workflow.submitAction("CANCEL_DOCUMENT");
                  if (res) {
                    handleActionResult(res);
                    push({
                      type: "success",
                      title: "Workflow updated",
                      message: res.message || "Action completed.",
                    });
                  }
                } catch (e: any) {
                  push({
                    type: "error",
                    title: "Action failed",
                    message: e?.message ?? "Action failed.",
                  });
                }
              },
            },
          ]
        : [];

    let workflowButtons: HeaderActionButton[];

    const makeWorkflowBtn = (code: string): HeaderActionButton => ({
      key: code,
      label: ACTION_LABELS[code] ?? code,
      variant:
        code === "REJECT" || code === "CANCEL_DOCUMENT"
          ? ("danger" as const)
          : ("primary" as const),
      disabled:
        workflow.isChangingStatus ||
        fileUpload.isUploading ||
        (code !== "CANCEL_DOCUMENT" && !canAct) ||
        (needsFileReplacement &&
          !["REJECT", "CANCEL_DOCUMENT"].includes(code)) ||
        (isPreApprovalCreatorCheck &&
          PRE_APPROVAL_START_ACTIONS.includes(code) &&
          !hasSignedFile) ||
        (approverNeedsSignedUpload &&
          !["REJECT", "CANCEL_DOCUMENT"].includes(code)),
      onClick: async () => {
        try {
          const res = await workflow.submitAction(code as any);
          if (res) {
            handleActionResult(res);
            push({
              type: "success",
              title: "Workflow updated",
              message: res.message || "Action completed.",
            });
            if (code === "REJECT") setActiveSideTab("comments");
          }
        } catch (e: any) {
          push({
            type: "error",
            title: "Action failed",
            message: e?.message ?? "Action failed.",
          });
        }
      },
    });

    const normalButtons = [...workflow.availableActions]
      .filter((code) => code !== "CANCEL_DOCUMENT" || showCancel)
      .sort((a, b) => (ACTION_PRIORITY[a] ?? 500) - (ACTION_PRIORITY[b] ?? 500))
      .map(makeWorkflowBtn);

    if (isActiveApprover) {
      const forwardButtons = normalButtons
        .filter((b) => b.key !== "CANCEL_DOCUMENT")
        .map((b) => ({
          ...b,
          disabled:
            b.disabled || !approverHasDownloaded || !approverHasUploaded,
        }));
      workflowButtons = [...forwardButtons, ...cancelBtn];
    } else {
      workflowButtons = normalButtons;
    }

    return replaceAction
      ? [replaceAction, ...workflowButtons]
      : workflowButtons;
  }, [
    workflow.availableActions,
    workflow.isChangingStatus,
    workflow.tasks,
    canAct,
    canReplace,
    needsFileReplacement,
    isActiveApprover,
    approverHasDownloaded,
    approverHasUploaded,
    localVersion,
    workflow.submitAction,
    handleActionResult,
  ]);

  // Override REJECT + CANCEL_DOCUMENT to pass note from modal
  const headerActionsWithReject: HeaderActionButton[] = React.useMemo(() => {
    return headerActions.map((a) => {
      if (a.key !== "REJECT" && a.key !== "CANCEL_DOCUMENT") return a;
      return {
        ...a,
        onClick: async (note?: string) => {
          try {
            const res = await workflow.submitAction(
              a.key as "REJECT" | "CANCEL_DOCUMENT",
              note,
            );
            if (res) {
              handleActionResult(res);
              push({
                type: "success",
                title: "Workflow updated",
                message: res.message || "Action completed.",
              });
              if (a.key === "REJECT") setActiveSideTab("comments");
            }
          } catch (e: any) {
            push({
              type: "error",
              title: "Action failed",
              message: e?.message ?? "Action failed.",
            });
          }
        },
      };
    });
  }, [headerActions, handleActionResult]);

  // ── Version actions ──────────────────────────────────────────
  const versionActions: HeaderActionButton[] = React.useMemo(() => {
    const actions: HeaderActionButton[] = [];

    if (localVersion?.status === "Distributed" && localVersion?.file_path) {
      actions.push({
        key: "download",
        label: "Download",
        variant: "outline",
        onClick: async () => {
          try {
            await downloadDocument(localVersion);
          } catch (e: any) {
            push({
              type: "error",
              title: "Download failed",
              message: e?.message ?? "Download failed.",
            });
          }
        },
      });
    }

    // Only the document's owner office can delete/cancel the draft.
    // QA office should NOT get owner access to office-start documents.
    const isOwner =
      !!myOfficeId && myOfficeId === (document as any)?.owner_office_id;

    if (
      isOwner &&
      localVersion?.status === "Draft" &&
      Number(localVersion?.version_number) === 0
    ) {
      actions.push({
        key: "delete_draft",
        label: "Delete draft",
        variant: "danger",
        onClick: async () => {
          setPendingDelete("draft");
        },
      });
    }

    if (
      isOwner &&
      localVersion?.status === "Draft" &&
      Number(localVersion?.version_number) > 0
    ) {
      actions.push({
        key: "cancel_revision",
        label: "Cancel revision",
        variant: "danger",
        onClick: async () => {
          setPendingDelete("revision");
        },
      });
    }

    return actions;
  }, [
    localVersion?.status,
    localVersion?.file_path,
    localVersion?.id,
    localVersion?.version_number,
    push,
    onChanged,
    onAfterActionClose,
  ]);

  // ── Header state signal ──────────────────────────────────────
  const onHeaderStateChangeRef = React.useRef(onHeaderStateChange);
  React.useEffect(() => {
    onHeaderStateChangeRef.current = onHeaderStateChange;
  }, [onHeaderStateChange]);

  const headerSig =
    `${localVersion?.status}|${localVersion?.version_number}|${canAct}|${workflow.isTasksReady}|${needsFileReplacement ? 1 : 0}|${fileUpload.isUploading ? 1 : 0}|` +
    headerActionsWithReject
      .map((a) => `${a.key}:${a.disabled ? 1 : 0}`)
      .join(",") +
    "|" +
    versionActions.map((a) => `${a.key}:${a.disabled ? 1 : 0}`).join(",");

  const prevHeaderSig = React.useRef("");

  React.useEffect(() => {
    if (headerSig === prevHeaderSig.current) return;
    prevHeaderSig.current = headerSig;
    onHeaderStateChangeRef.current?.({
      title:
        localVersion?.status === "Draft" ? localTitle : (document?.title ?? ""),
      code: fullCode,
      status: localVersion?.status ?? "",
      versionNumber: Number(localVersion?.version_number ?? 0),
      canAct,
      isTasksReady: workflow.isTasksReady,
      headerActions: headerActionsWithReject,
      versionActions,
    });
  }, [headerSig]);

  // ── Message sending ──────────────────────────────────────────
  const [draftMessage, setDraftMessage] = React.useState("");
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);

  type OptMsg = {
    tempId: string;
    text: string;
    sending: boolean;
    failed: boolean;
  };
  const [optimisticMessages, setOptimisticMessages] = React.useState<OptMsg[]>(
    [],
  );

  const draftMessageRef = React.useRef(draftMessage);
  React.useEffect(() => {
    draftMessageRef.current = draftMessage;
  }, [draftMessage]);

  const handleSendMessage = React.useCallback(async () => {
    const text = draftMessageRef.current.trim();
    if (!text) return;
    if (!localVersion?.id) return;
    setIsSendingMessage(true);
    try {
      await postDocumentMessage(localVersion.id, {
        message: text,
        type: "comment",
      });
      await workflow.refreshMessages();
    } catch (e: any) {
      push({
        type: "error",
        title: "Send failed",
        message: e?.message ?? "Failed to send.",
      });
    } finally {
      setIsSendingMessage(false);
    }
  }, [localVersion?.id, workflow.refreshMessages, push]);

  // ── Sync right panel content to parent ───────────────────────
  const onRightPanelContentRef = React.useRef(onRightPanelContent);
  React.useEffect(() => {
    onRightPanelContentRef.current = onRightPanelContent;
  }, [onRightPanelContent]);

  React.useEffect(() => {
    if (!document || !localVersion) return;
    onRightPanelContentRef.current?.(
      <DocumentRightPanel
        document={document}
        version={localVersion}
        offices={offices}
        routeSteps={routeSteps}
        tasks={workflow.tasks}
        newMessageCount={workflow.newMessageCount}
        clearNewMessageCount={workflow.clearNewMessageCount}
        activeSideTab={activeSideTab}
        setActiveSideTab={setActiveSideTab}
        isLoadingActivityLogs={workflow.isLoadingActivityLogs}
        activityLogs={workflow.activityLogs}
        isLoadingMessages={workflow.isLoadingMessages}
        messages={workflow.messages}
        draftMessage={draftMessage}
        setDraftMessage={setDraftMessage}
        isSendingMessage={isSendingMessage}
        onSendMessage={handleSendMessage}
        optimisticMessages={optimisticMessages}
        setOptimisticMessages={setOptimisticMessages}
        formatWhen={formatWhen}
        isEditable={
          isQAOfficeUser ||
          myOfficeId === Number((document as any)?.owner_office_id ?? -1) ||
          myUserId === Number((document as any)?.created_by ?? -1)
        }
        onChanged={() => onChanged?.()}
        onTitleSaved={(newTitle) => {
          setLocalTitle(newTitle);
          setInitialTitle(newTitle);
          onChanged?.();
        }}
      />,
    );
  }, [
    document,
    localVersion,
    offices,
    workflow.newMessageCount,
    workflow.activityLogs,
    workflow.isLoadingActivityLogs,
    workflow.isLoadingMessages,
    workflow.messages,
    activeSideTab,
    draftMessage,
    isSendingMessage,
    handleSendMessage,
  ]);

  // ── Render ───────────────────────────────────────────────────
  // Don't early-return — always render the real layout shell.
  // Skeleton slots inside each panel handle the loading state.
  // const isShellLoading = !document || !version || !localVersion;

  return (
    <>
      <section className="flex flex-col gap-4">
        {/* Cancelled banner */}
        {effectiveStatus === "Cancelled" && (
          <div className="flex items-center gap-3 rounded-md border-l-4 border-rose-400 dark:border-rose-600 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5">
            <XCircle className="h-4 w-4 text-rose-500 dark:text-rose-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                Document cancelled
              </p>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
                No further workflow actions are available.
              </p>
            </div>
          </div>
        )}

        {/* File replacement required banner */}
        {needsFileReplacement && (
          <div className="flex items-center gap-3 rounded-md border-l-4 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                New file required before forwarding
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                Upload a revised version using the Replace button before
                forwarding.
              </p>
            </div>
          </div>
        )}

        {/* Approver step banner */}
        {isActiveApprover &&
          (!approverHasDownloaded || !approverHasUploaded) && (
            <div className="flex items-start gap-3 rounded-md border-l-4 border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 px-4 py-2.5">
              <Upload className="h-4 w-4 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  {!approverHasDownloaded
                    ? "Step 1: Download the document for signing"
                    : "Step 2: Upload your signed copy"}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  {!approverHasDownloaded
                    ? "Download the document, sign it, then upload your signed copy to enable forwarding."
                    : "Upload your signed copy to enable forwarding."}
                </p>
              </div>
              {!approverHasDownloaded ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await downloadDocument(localVersion!);
                      setApproverHasDownloaded(true);
                    } catch (e: any) {
                      push({
                        type: "error",
                        title: "Download failed",
                        message: e?.message ?? "Could not download the file.",
                      });
                    }
                  }}
                  disabled={workflow.isChangingStatus}
                  className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition"
                >
                  Download
                </button>
              ) : (
                <button
                  type="button"
                  onClick={fileUpload.triggerFilePicker}
                  disabled={fileUpload.isUploading || workflow.isChangingStatus}
                  className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50 transition"
                >
                  {fileUpload.isUploading ? "Uploading…" : "Upload signed"}
                </button>
              )}
            </div>
          )}

        {/* Pre-approval signed upload banner */}
        {isPreApprovalCreatorCheck && !hasSignedFile && (
          <div className="flex items-start gap-3 rounded-md border-l-4 border-sky-400 dark:border-sky-600 bg-sky-50 dark:bg-sky-950/30 px-4 py-2.5">
            <Upload className="h-4 w-4 text-sky-500 dark:text-sky-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sky-700 dark:text-sky-300">
                Upload signed document to start approval
              </p>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-0.5">
                Download the reviewed document, sign it, then upload the signed
                copy before starting the approval phase.
              </p>
            </div>
            <button
              type="button"
              onClick={fileUpload.triggerFilePicker}
              disabled={fileUpload.isUploading || workflow.isChangingStatus}
              className="shrink-0 rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-50 transition"
            >
              {fileUpload.isUploading ? "Uploading…" : "Upload signed"}
            </button>
          </div>
        )}
        {isPreApprovalCreatorCheck && hasSignedFile && (
          <div className="flex items-center gap-3 rounded-md border-l-4 border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              Signed document uploaded — you can now start the approval phase.
            </p>
          </div>
        )}

        {/* Progress card — full width */}
        <WorkflowProgressCard
          phases={phases}
          routeStepsCount={routeSteps.length}
          isTasksReady={workflow.isTasksReady && !isCustomRoutingPending}
          currentStep={currentStep}
          nextStep={nextStep}
          currentPhaseIndex={currentPhaseIndex}
          currentGlobalIndex={currentGlobalIndex}
          currentPhaseId={currentPhase.id}
          activeFlowSteps={activeFlowSteps}
          tasks={workflow.tasks}
        />

        {/* Main body — full width preview */}
        <div style={{ height: "calc(100vh - 220px)" }}>
          {!localVersion ? (
            <div className="flex flex-col h-full rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
              <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-2 gap-3">
                <div className="h-2.5 w-32 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                <div className="h-6 w-14 rounded-md bg-slate-200 dark:bg-surface-300 animate-pulse" />
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-surface-600 animate-pulse" />
            </div>
          ) : (
            <DocumentPreviewWrapper
              localVersion={localVersion}
              allVersions={allVersions}
              selectedVersionId={selectedVersion?.id ?? null}
              canReplace={canReplace}
              isActiveApprover={isActiveApprover}
              approverHasDownloaded={approverHasDownloaded}
              onApproverDownload={async () => {
                try {
                  await downloadDocument(localVersion!);
                  setApproverHasDownloaded(true);
                } catch (e: any) {
                  push({
                    type: "error",
                    title: "Download failed",
                    message: e?.message ?? "Could not download the file.",
                  });
                }
              }}
              onApproverUpload={() => fileUpload.triggerFilePicker()}
              signedPreviewUrl={signedPreviewUrl}
              previewNonce={previewNonce}
              isUploading={fileUpload.isUploading}
              uploadProgress={fileUpload.uploadProgress}
              isPreviewLoading={isPreviewLoading}
              setIsPreviewLoading={setIsPreviewLoading}
              fileInputRef={fileUpload.fileInputRef}
              onOpenPreview={async () => {
                const res = await getDocumentPreviewLink(localVersion.id);
                window.open(res.url, "_blank");
              }}
              onClickReplace={fileUpload.triggerFilePicker}
              onReloadPreview={async () => {
                previewUrlCacheRef.current = {};
                setSignedPreviewUrl("");
                setIsPreviewLoading(true);
                setPreviewNonce((n) => n + 1);
                try {
                  const r = await getDocumentPreviewLink(localVersion.id);
                  if (localVersion?.preview_path) {
                    previewUrlCacheRef.current[localVersion.preview_path] =
                      r.url;
                  }
                  setSignedPreviewUrl(r.url);
                  setPreviewNonce((n) => n + 1);
                } catch {
                  // Leave blank — no preview available
                } finally {
                  setIsPreviewLoading(false);
                }
              }}
              onDrop={fileUpload.handleDrop}
              onDragOver={fileUpload.handleDragOver}
              onDragLeave={fileUpload.handleDragLeave}
              onFileSelect={fileUpload.handleFileSelect}
              isExternalUploading={isExternalUploading}
              onSelectVersion={onSelectVersion}
              isLoadingSelectedVersion={isLoadingSelectedVersion}
            />
          )}
        </div>
      </section>

      {/* ── Delete / cancel-revision confirm modal ──────────────── */}
      {pendingDelete != null && (
        <DeleteDraftConfirmModal
          pendingDelete={pendingDelete}
          isDeleting={isDeleting}
          onCancel={() => setPendingDelete(null)}
          onConfirm={async () => {
            setIsDeleting(true);
            try {
              await deleteDraftVersion(localVersion!.id);
              if (pendingDelete === "revision" && onChanged) await onChanged();
              setPendingDelete(null);
              onAfterActionClose?.();
            } catch (e: any) {
              push({
                type: "error",
                title:
                  pendingDelete === "draft" ? "Delete failed" : "Cancel failed",
                message: e?.message ?? "Operation failed.",
              });
              setPendingDelete(null);
            } finally {
              setIsDeleting(false);
            }
          }}
        />
      )}
    </>
  );
};

export default DocumentFlow;
