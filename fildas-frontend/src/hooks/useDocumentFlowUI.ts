import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import { useToast } from "../components/ui/toast/ToastContext";
import {
  getCurrentUserOfficeId,
  listOffices,
  getDocumentRouteSteps,
  getDocumentPreviewLink,
  getDocumentVersion,
  invalidatePreviewCache,
  downloadDocument,
  archiveDocument,
  restoreDocument,
} from "../services/documents";
import { useDocumentWorkflow } from "./useDocumentWorkflow";
import { useDocumentAutoSave } from "./useDocumentAutoSave";
import { useDocumentFileUpload } from "./useDocumentFileUpload";
import { officeIdByCode, buildCustomFlowSteps, findCurrentStep, phaseOrder } from "../components/documents/documentFlow/flowUtils";
import {
  phases,
  flowStepsOffice,
  flowStepsQa,
  ACTION_LABELS,
  ACTION_CONFIRM_MESSAGES,
  ACTION_PRIORITY,
} from "../components/documents/documentFlow/flowConfig";
import type {
  Document,
  DocumentVersion,
  Office,
  DocumentRouteStep,
  WorkflowTask,
} from "../services/documents";
import type { HeaderActionButton } from "../components/documents/documentFlow/types";

interface Options {
  document: Document | null;
  version: DocumentVersion | null;
  onChanged?: () => Promise<void> | void;
  onAfterActionClose?: () => void;
  onBrowseTemplates?: () => void;
  adminDebugMode: boolean;
}

export function useDocumentFlowUI({
  document,
  version,
  onChanged,
  onAfterActionClose,
  onBrowseTemplates,
  adminDebugMode,
}: Options) {
  const { push } = useToast();
  const myOfficeId = getCurrentUserOfficeId();

  const onChangedRef = useRef(onChanged);
  const onAfterActionCloseRef = useRef(onAfterActionClose);
  useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  useEffect(() => { onAfterActionCloseRef.current = onAfterActionClose; }, [onAfterActionClose]);

  // ── Sign modal ───────────────────────────────────────────────
  const [signingOpen, setSigningOpen] = useState(false);
  const [signingInBackground, setSigningInBackground] = useState(false);
  const [signingEditMode, setSigningEditMode] = useState(false);
  const [removingSignature, setRemovingSignature] = useState(false);

  // ── Delete/cancel confirmation state ─────────────────────────
  const [pendingDelete, setPendingDelete] = useState<"draft" | "revision" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [activeWorkflowCode, setActiveWorkflowCode] = useState<string | null>(null);

  // ── Local version + field state ──────────────────────────────
  const [localVersion, setLocalVersion] = useState<DocumentVersion | null>(version ?? null);
  const [localTitle, setLocalTitle] = useState(document?.title ?? "");
  const [initialTitle, setInitialTitle] = useState(document?.title ?? "");
  const [localDesc, setLocalDesc] = useState(version?.description ?? "");
  const [initialDesc, setInitialDesc] = useState(version?.description ?? "");
  const [localEffectiveDate, setLocalEffectiveDate] = useState(
    String((version as any)?.effective_date ?? "").slice(0, 10),
  );
  const [initialEffectiveDate, setInitialEffectiveDate] = useState(
    String((version as any)?.effective_date ?? "").slice(0, 10),
  );

  // ── Offices + route steps ────────────────────────────────────
  const [offices, setOffices] = useState<Office[]>([]);
  const [routeSteps, setRouteSteps] = useState<DocumentRouteStep[]>([]);

  useEffect(() => {
    let alive = true;
    listOffices()
      .then((d) => { if (alive) setOffices(d); })
      .catch(() => { if (alive) setOffices([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!localVersion) return;
    let alive = true;
    getDocumentRouteSteps(localVersion.id)
      .then((r) => { if (alive) setRouteSteps(Array.isArray(r.steps) ? r.steps : []); })
      .catch(() => { if (alive) setRouteSteps([]); });
    return () => { alive = false; };
  }, [localVersion?.id]);

  const hasSignedFile = !!(localVersion as any)?.signed_file_path;

  // ── Sync when version prop changes ───────────────────────────
  useEffect(() => {
    if (!version || !document) return;
    setLocalVersion(version);
    setLocalTitle(document.title);
    setInitialTitle(document.title);
    setLocalDesc(version.description ?? "");
    setInitialDesc(version.description ?? "");
    const ed = String((version as any)?.effective_date ?? "").slice(0, 10);
    setLocalEffectiveDate(ed);
    setInitialEffectiveDate(ed);
    if (hasSignedFile) {
      setApproverHasUploaded(true);
    }
  }, [
    document?.id,
    version?.id,
    version?.status,
    version?.preview_path,
    version?.file_path,
    (version as any)?.signed_file_path,
    (version as any)?.needs_file_replacement,
    hasSignedFile,
  ]);

  // ── Preview ──────────────────────────────────────────────────
  const [signedPreviewUrl, setSignedPreviewUrl] = useState("");
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const previewUrlCacheRef = useRef<Record<string, string>>({});

  const prevPreviewPathRef = useRef<string | null>(null);
  const prevUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!localVersion) return;
    let alive = true;

    if (!localVersion.preview_path) {
      setSignedPreviewUrl("");
      setIsPreviewLoading(false);
      prevPreviewPathRef.current = null;
      prevUpdatedAtRef.current = null;
      return;
    }

    const pathChanged = localVersion.preview_path !== prevPreviewPathRef.current;
    prevPreviewPathRef.current = localVersion.preview_path;

    const contentChanged = pathChanged;

    if (contentChanged) {
      delete previewUrlCacheRef.current[localVersion.preview_path];
      invalidatePreviewCache(localVersion.id);
    }

    const cached = previewUrlCacheRef.current[localVersion.preview_path];
    if (cached && !contentChanged) {
      setSignedPreviewUrl(cached);
      setIsPreviewLoading(false);
      return;
    }

    setIsPreviewLoading(true);
    if (contentChanged) setPreviewNonce((n) => n + n + 1);

    getDocumentPreviewLink(localVersion.id)
      .then((r) => {
        if (alive) {
          previewUrlCacheRef.current[localVersion.preview_path!] = r.url;
          setSignedPreviewUrl(r.url);
          setIsPreviewLoading(false);
          setPreviewNonce((n) => n + 1);
        }
      })
      .catch(() => {
        if (alive) {
          setSignedPreviewUrl("");
          setIsPreviewLoading(false);
        }
      });
    return () => { alive = false; };
  }, [localVersion?.id, localVersion?.preview_path]);

  const handleActionResult = useCallback(
    (res: { version: DocumentVersion; message?: string }) => {
      if (!res) return;
      setLocalVersion((prev) => {
        if (!prev) return res.version;
        // Check if preview path changed to invalidate local cache
        const newPreviewPath = res.version.preview_path ?? null;
        const oldPreviewPath = prev.preview_path ?? null;
        if (newPreviewPath !== oldPreviewPath) {
          if (oldPreviewPath) delete previewUrlCacheRef.current[oldPreviewPath];
          if (newPreviewPath) delete previewUrlCacheRef.current[newPreviewPath];
          setPreviewNonce((n) => n + 1);
        }
        return { ...prev, ...res.version };
      });
    },
    [setLocalVersion]
  );

  useEffect(() => {
    // Only poll if we have a file but are missing either checksum or preview_path
    if (!localVersion || !localVersion.file_path || (localVersion.checksum && localVersion.preview_path)) return;

    let pollCount = 0;
    const maxPolls = 30; // 90 seconds (30 * 3s)
    
    const interval = setInterval(async () => {
      pollCount++;
      if (pollCount > maxPolls) {
        clearInterval(interval);
        return;
      }

      try {
        const res = await getDocumentVersion(localVersion.id);
        // Only trigger update and stop polling if we got both checksum and preview_path
        if (res.version.checksum && res.version.preview_path) {
          clearInterval(interval);
          handleActionResult({ version: res.version });
        }
      } catch (e) {
        console.warn("Polling version failed", e);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [localVersion?.id, localVersion?.checksum, localVersion?.file_path, handleActionResult]);

  // ── Derived ──────────────────────────────────────────────────
  const qaOfficeId = useMemo(() => offices?.length ? officeIdByCode(offices, "QA") : null, [offices]);
  const isQAOfficeUser = useMemo(() => !!qaOfficeId && Number(myOfficeId) === Number(qaOfficeId), [qaOfficeId, myOfficeId]);
  
  const terminalStatuses = useMemo(() => new Set(["Distributed", "Cancelled", "Superseded"]), []);
  const effectiveStatus = localVersion?.status ?? version?.status ?? "";
  const isTerminal = useMemo(() => terminalStatuses.has(effectiveStatus), [terminalStatuses, effectiveStatus]);

  const isQAStep = useMemo(() => [
    "Draft",
    "For QA Final Check",
    "For QA Registration",
    "For QA Distribution",
    "QA_EDIT",
  ].includes(localVersion?.status ?? ""), [localVersion?.status]);

  const canEditEffectiveDate = useMemo(() => isQAOfficeUser && isQAStep, [isQAOfficeUser, isQAStep]);
  const [activeSideTab, setActiveSideTab] = useState<"details" | "comments" | "participants" | "logs">("details");

  // ── Sub-hooks ────────────────────────────────────────────────
  const workflow = useDocumentWorkflow({
    versionId: localVersion?.id && localVersion.id > 0 ? localVersion.id : 0,
    documentId: document?.id ?? 0,
    isTerminal,
    onChanged: (...args) => onChangedRef.current?.(...args),
    onAfterActionClose: (...args) => onAfterActionCloseRef.current?.(...args),
    myOfficeId,
    qaOfficeId,
    adminDebugMode,
  });

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
    onVersionUpdated: useCallback((v: Partial<DocumentVersion>) =>
      setLocalVersion((prev) => (prev ? { ...prev, ...v } : (v as DocumentVersion))), []),
    onChanged: (...args) => onChangedRef.current?.(...args),
  });

  const fileUpload = useDocumentFileUpload({
    versionId: localVersion?.id ?? 0,
    onUploadComplete: useCallback(async () => {
      previewUrlCacheRef.current = {};
      setSignedPreviewUrl("");
      // Do NOT set isPreviewLoading(true) here. 
      // isUploading will handle the progress bar, 
      // and the preview effect will handle the spinner only when actually fetching a link.
      setPreviewNonce((n) => n + 1);
      if (onChangedRef.current) await onChangedRef.current();
    }, [onChangedRef]),
  });

  useEffect(() => {
    if (workflow.taskChanged) {
      workflow.clearTaskChanged();
      if (onChangedRef.current) void Promise.resolve(onChangedRef.current()).catch(() => {});
    }
  }, [workflow.taskChanged, workflow.clearTaskChanged]);

  // ── Current task + step ──────────────────────────────────────
  const [currentTask, setCurrentTask] = useState<WorkflowTask | null>(null);

  useEffect(() => {
    if (!workflow.tasks.length) {
      setCurrentTask(null);
      return;
    }
    setCurrentTask(
      workflow.tasks.find((t: WorkflowTask) => t.status === "open") ?? workflow.tasks[0] ?? null
    );
  }, [workflow.tasks]);

  const isCustomRouting = routeSteps.length > 0;
  const workflowType = String((localVersion as any)?.workflow_type ?? "").toLowerCase();
  const officeStatuses = new Set([
    "Office Draft",
    "For Office Head Review",
    "For VP Review (Office)",
    "For QA Approval (Office)",
  ]);
  const isOfficeFlow = workflowType === "office" || officeStatuses.has(localVersion?.status ?? "");
  const ownerOfficeIdForFlow =
    (document as any)?.owner_office_id ??
    (document as any)?.office_id ??
    document?.ownerOffice?.id ??
    (document as any)?.office?.id ??
    null;

  const customFlowSteps = useMemo(
    () =>
      routeSteps.length > 0 && offices.length > 0
        ? buildCustomFlowSteps({ offices, ownerOfficeId: ownerOfficeIdForFlow, routeSteps })
        : null,
    [routeSteps, offices, ownerOfficeIdForFlow]
  );

  const isCustomRoutingPending = isCustomRouting && customFlowSteps === null;
  const activeFlowSteps = useMemo(() => customFlowSteps ?? (isOfficeFlow ? flowStepsOffice : flowStepsQa), [customFlowSteps, isOfficeFlow]);

  const currentStep = useMemo(() => {
    if (isCustomRoutingPending && !currentTask?.step) return activeFlowSteps[0];
    if (isCustomRouting && currentTask?.step) {
      const assignedId = currentTask?.assigned_office_id ?? null;
      if (
        (currentTask.step === "custom_office_review" || currentTask.step === "custom_review_office") &&
        assignedId
      ) {
        const hit = activeFlowSteps.find((s) => s.id === `custom_review_office:${Number(assignedId)}`);
        if (hit) return hit;
      }
      if (
        (currentTask.step === "custom_office_approval" || currentTask.step === "custom_approval_office") &&
        assignedId
      ) {
        const hit = activeFlowSteps.find((s) => s.id === `custom_approval_office:${Number(assignedId)}`);
        if (hit) return hit;
      }
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
  }, [isCustomRoutingPending, currentTask, isCustomRouting, activeFlowSteps, localVersion?.status]);

  const currentPhase = useMemo(() => phases.find((p) => p.id === currentStep.phase) ?? phases[0], [currentStep.phase]);
  const currentPhaseIndex = useMemo(() => phaseOrder(phases, currentPhase.id), [currentPhase.id]);
  const currentGlobalIndex = useMemo(() => activeFlowSteps.findIndex((s) => s.id === currentStep.id), [activeFlowSteps, currentStep.id]);
  const nextStep = useMemo(() => (currentGlobalIndex >= 0 && currentGlobalIndex < activeFlowSteps.length - 1) 
    ? activeFlowSteps[currentGlobalIndex + 1] 
    : null, [currentGlobalIndex, activeFlowSteps]);

  const assignedOfficeId = currentTask?.assigned_office_id ?? null;
  const canAct = useMemo(() => adminDebugMode || (!!assignedOfficeId && Number(myOfficeId) === Number(assignedOfficeId)), [adminDebugMode, assignedOfficeId, myOfficeId]);

  // ── Signing state ─────────────────────────────────────────────────────
  const isInApprovalPhase = useMemo(() => {
    const s = localVersion?.status ?? "";
    if (s === "For Office Approval") return true;
    if (s === "For VP Approval") return true;
    if (s === "For President's Approval") return true;
    if (s === "For QA Approval Check") return true;
    if (s === "For Office Head Approval") return true;
    if (s === "For Staff Approval Check") return true;
    if (/^For .+ Approval$/.test(s)) return true;
    return false;
  }, [localVersion?.status]);

  const FINALIZATION_ACTION_CODES = [
    "QA_START_FINALIZATION",
    "OFFICE_START_FINALIZATION",
    "CUSTOM_START_FINALIZATION",
  ];
  const isPreFinalizeCheck = useMemo(() =>
    isInApprovalPhase && workflow.availableActions.some((a: string) => FINALIZATION_ACTION_CODES.includes(a)), [isInApprovalPhase, workflow.availableActions]);
  
  const isActiveApprover = useMemo(() => isInApprovalPhase && canAct && !isPreFinalizeCheck, [isInApprovalPhase, canAct, isPreFinalizeCheck]);

  const PRE_APPROVAL_START_ACTIONS = [
    "QA_START_OFFICE_APPROVAL",
    "OFFICE_START_APPROVAL",
    "CUSTOM_START_APPROVAL",
  ];
  const isPreApprovalCreatorCheck = useMemo(() =>
    canAct && workflow.availableActions.some((a: string) => PRE_APPROVAL_START_ACTIONS.includes(a)), [canAct, workflow.availableActions]);
  

  const [approverHasDownloaded, setApproverHasDownloaded] = useState(false);
  const [approverHasUploaded, setApproverHasUploaded] = useState(hasSignedFile);
  const approverNeedsSignedUpload = isActiveApprover && (!approverHasDownloaded || !approverHasUploaded);

  const isDraftStatus = localVersion?.status === "Draft" || localVersion?.status === "Office Draft";
  const needsFileReplacement = isDraftStatus && canAct && !!(localVersion as any)?.needs_file_replacement;

  const participantOfficeIds = useMemo(() => {
    const ids = new Set<number>();
    const ownerId = (document as any)?.owner_office_id || (document as any)?.office_id;
    if (ownerId) ids.add(Number(ownerId));
    
    workflow.tasks.forEach(t => {
      if (t.assigned_office_id) ids.add(Number(t.assigned_office_id));
    });
    
    routeSteps.forEach(rs => {
      if (rs.office_id) ids.add(Number(rs.office_id));
    });

    return Array.from(ids);
  }, [document, workflow.tasks, routeSteps]);


  const canReplace = localVersion?.status === "Draft" || localVersion?.status === "Office Draft";

  const headerActions: HeaderActionButton[] = useMemo(() => {
    const cancelBlockedStatuses = new Set([
      "For Registration",
      "For Distribution",
      "Distributed",
      "Superseded",
      "Cancelled",
    ]);
    const showCancel = !cancelBlockedStatuses.has(localVersion?.status ?? "");
    const wasReturnedOrRejected = workflow.tasks.some((t: WorkflowTask) => t.status === "returned" || t.status === "rejected");
    const showReplaceAction = canReplace && wasReturnedOrRejected && canAct && !isActiveApprover;

    const replaceAction: HeaderActionButton | null = showReplaceAction
      ? {
          key: "REPLACE_FILE",
          label: "Replace file",
          variant: "outline",
          disabled: workflow.isChangingStatus,
          onClick: async () => fileUpload.triggerFilePicker(),
        }
      : null;

    const cancelBtn =
      workflow.availableActions.includes("CANCEL_DOCUMENT") && showCancel
        ? [
            {
              key: "CANCEL_DOCUMENT",
              label: ACTION_LABELS["CANCEL_DOCUMENT"] ?? "Cancel document",
              variant: "danger" as const,
              disabled: workflow.isChangingStatus,
              onClick: async (note?: string) => {
                try {
                  const res = await workflow.submitAction("CANCEL_DOCUMENT", note);
                  if (res) {
                    handleActionResult(res);
                    push({ type: "success", title: "Workflow updated", message: res.message || "Action completed." });
                  }
                } catch (e: any) {
                  push({ type: "error", title: "Action failed", message: e?.message ?? "Action failed." });
                }
              },
            },
          ]
        : [];

    const makeWorkflowBtn = (code: string): HeaderActionButton => {
      let label = ACTION_LABELS[code] ?? code;
      let confirmMessage = ACTION_CONFIRM_MESSAGES[code];
      if (code === "CUSTOM_FORWARD") {
        const isDraftPhase = currentPhase.id === "draft";
        const isApprovalPhase = currentPhase.id === "approval";
        if (isDraftPhase) {
          label = "Submit for review";
          confirmMessage = "This document will be submitted to the first recipient for review.";
        } else if (isApprovalPhase) {
          label = "Approve";
          confirmMessage = "Your approval is confirmed. The document will be forwarded to the next recipient.";
        } else {
          label = "Forward";
          confirmMessage = "Your review is confirmed. The document will be forwarded to the next recipient.";
        }
      }

      const isRegisterAction = ["QA_REGISTER", "OFFICE_REGISTER", "CUSTOM_REGISTER"].includes(code);
      const isDistributeAction = ["QA_DISTRIBUTE", "OFFICE_DISTRIBUTE", "CUSTOM_DISTRIBUTE"].includes(code);

      return {
        key: code,
        label,
        confirmMessage,
        loading: (isRegisterAction && isRegisterModalOpen) || (isDistributeAction && isDistributeModalOpen) || (workflow.isChangingStatus && code === activeWorkflowCode),
        variant: (code === "REJECT" || code === "CANCEL_DOCUMENT") ? "danger" : "primary",
        disabled:
          workflow.isChangingStatus ||
          fileUpload.isUploading ||
          (code !== "CANCEL_DOCUMENT" && !canAct) ||
          (isDraftStatus && ["QA_SEND_TO_OFFICE_REVIEW", "OFFICE_SEND_TO_HEAD", "CUSTOM_FORWARD"].includes(code) && !localVersion?.file_path && !adminDebugMode) ||
          (needsFileReplacement && !["REJECT", "CANCEL_DOCUMENT"].includes(code)) ||
          (!adminDebugMode && isPreApprovalCreatorCheck && PRE_APPROVAL_START_ACTIONS.includes(code) && !hasSignedFile) ||
          (!adminDebugMode && isInApprovalPhase && canAct && !isPreFinalizeCheck && !approverHasUploaded && !["REJECT", "CANCEL_DOCUMENT"].includes(code)),
        skipConfirm: isRegisterAction || isDistributeAction,
        onClick: async (note?: string) => {
          if (isRegisterAction) {
            setActiveWorkflowCode(code);
            setIsRegisterModalOpen(true);
            return;
          }
          if (isDistributeAction) {
            setActiveWorkflowCode(code);
            setIsDistributeModalOpen(true);
            return;
          }
          try {
            const res = await workflow.submitAction(code as any, note);
            if (res) {
              handleActionResult(res);
              push({ type: "success", title: "Workflow updated", message: res.message || "Action completed." });
              if (code === "REJECT") setActiveSideTab("logs");
            }
          } catch (e: any) {
            push({ type: "error", title: "Action failed", message: e?.message ?? "Action failed." });
          }
        },
      };
    };

    const normalButtons = [...workflow.availableActions]
      .filter((code) => code !== "CANCEL_DOCUMENT" || showCancel)
      .sort((a, b) => (ACTION_PRIORITY[a] ?? 500) - (ACTION_PRIORITY[b] ?? 500))
      .map(makeWorkflowBtn);

    const finalButtons = isActiveApprover
      ? normalButtons
          .map((b) => ({
            ...b,
            disabled: b.disabled || (!adminDebugMode && (!approverHasDownloaded || !approverHasUploaded)) || (isPreApprovalCreatorCheck && !hasSignedFile && !["REJECT", "CANCEL_DOCUMENT"].includes(b.key)),
          }))
          .concat(cancelBtn)
      : normalButtons.map(b => ({
          ...b,
          disabled: b.disabled || (isPreApprovalCreatorCheck && !hasSignedFile && !["REJECT", "CANCEL_DOCUMENT"].includes(b.key)),
        }));



    const archiveBtn =
      localVersion?.status === "Distributed" && !document?.archived_at
        ? [
            {
              key: "ARCHIVE_DOCUMENT",
              label: "Archive",
              variant: "outline" as const,
              disabled: workflow.isChangingStatus || !canAct,
              onClick: async () => {
                try {
                  await archiveDocument(document!.id);
                  if (onChangedRef.current) await onChangedRef.current();
                  push({
                    type: "success",
                    title: "Document archived",
                    message: "The document has been moved to the archive.",
                  });
                } catch (e: any) {
                  push({
                    type: "error",
                    title: "Archival failed",
                    message: e?.message ?? "Operation failed.",
                  });
                }
              },
            },
          ]
        : [];

    const restoreBtn =
      localVersion?.status === "Distributed" && document?.archived_at
        ? [
            {
              key: "RESTORE_DOCUMENT",
              label: "Restore to Library",
              variant: "primary" as const,
              disabled: workflow.isChangingStatus || !canAct,
              onClick: async () => {
                try {
                  await restoreDocument(document!.id);
                  if (onChangedRef.current) await onChangedRef.current();
                  push({
                    type: "success",
                    title: "Document restored",
                    message: "The document has been moved back to the library.",
                  });
                } catch (e: any) {
                  push({
                    type: "error",
                    title: "Restoration failed",
                    message: e?.message ?? "Operation failed.",
                  });
                }
              },
            },
          ]
        : [];

    const templatesBtn = isDraftStatus
      ? [
          {
            key: "BROWSE_TEMPLATES",
            label: "Templates",
            variant: "outline" as const,
            onClick: async () => {
              if (onBrowseTemplates) onBrowseTemplates();
            },
          },
        ]
      : [];

    const finalResult = replaceAction ? [replaceAction, ...finalButtons] : finalButtons;
    return [...finalResult, ...templatesBtn, ...archiveBtn, ...restoreBtn];
  }, [
    workflow.availableActions,
    workflow.isChangingStatus,
    workflow.tasks,
    workflow.submitAction,
    canAct,
    canReplace,
    needsFileReplacement,
    isActiveApprover,
    approverHasDownloaded,
    approverHasUploaded,
    localVersion?.status,
    localVersion?.version_number,
    localVersion?.file_path,
    currentPhase.id,
    adminDebugMode,
    isPreApprovalCreatorCheck,
    hasSignedFile,
    approverNeedsSignedUpload,
    fileUpload.isUploading,
    document?.archived_at,
    document?.owner_office_id,
    isQAOfficeUser,
    myOfficeId,
    fileUpload.triggerFilePicker,
  ]);

  const versionActions: HeaderActionButton[] = useMemo(() => {
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
            push({ type: "error", title: "Download failed", message: e?.message ?? "Download failed." });
          }
        },
      });
    }
    const isOwner = !!myOfficeId && myOfficeId === (document as any)?.owner_office_id;
    if (isOwner && localVersion?.status === "Draft" && Number(localVersion?.version_number) === 0) {
      actions.push({
        key: "delete_draft",
        label: "Delete draft",
        variant: "danger",
        onClick: async () => setPendingDelete("draft"),
      });
    }
    return actions;
  }, [
    localVersion?.id, 
    localVersion?.status, 
    myOfficeId, 
    document?.id, 
    document?.owner_office_id,
    push
  ]);

  const state = useMemo(() => ({
    localVersion,
    localTitle,
    localDesc,
    localEffectiveDate,
    signingOpen,
    signingInBackground,
    signingEditMode,
    removingSignature,
    pendingDelete,
    isDeleting,
    signedPreviewUrl,
    isPreviewLoading,
    previewNonce,
    activeSideTab,
    currentTask,
    currentStep,
    currentPhase,
    currentPhaseIndex,
    nextStep,
    activeFlowSteps,
    canAct,
    isTerminal,
    isQAOfficeUser,
    canEditEffectiveDate,
    isActiveApprover,
    approverHasDownloaded,
    approverHasUploaded,
    needsFileReplacement,
    headerActions,
    versionActions,
    offices,
    routeSteps,
    isRegisterModalOpen,
    isDistributeModalOpen,
    isBusy: isRegisterModalOpen || isDistributeModalOpen || workflow.isChangingStatus,
    activeWorkflowCode,
    participantOfficeIds,
  }), [
    localVersion?.id,
    localVersion?.status,
    localVersion?.version_number,
    localVersion?.file_path,
    localVersion?.checksum,
    localVersion?.preview_path,
    localVersion?.updated_at,
    localTitle,
    localDesc,
    localEffectiveDate,
    signingOpen,
    signingInBackground,
    signingEditMode,
    removingSignature,
    pendingDelete,
    isDeleting,
    signedPreviewUrl,
    isPreviewLoading,
    previewNonce,
    activeSideTab,
    currentTask,
    currentStep,
    currentPhase,
    currentPhaseIndex,
    nextStep,
    activeFlowSteps,
    canAct,
    isTerminal,
    isQAOfficeUser,
    canEditEffectiveDate,
    isActiveApprover,
    approverHasDownloaded,
    approverHasUploaded,
    needsFileReplacement,
    headerActions,
    versionActions,
    offices,
    routeSteps,
    isRegisterModalOpen,
    isDistributeModalOpen,
    workflow.isChangingStatus,
    activeWorkflowCode,
    participantOfficeIds,
  ]);

  const hookActions = useMemo(() => ({
    push,
    setLocalVersion,
    setLocalTitle,
    setLocalDesc,
    setLocalEffectiveDate,
    setSigningOpen,
    setSigningInBackground,
    setSigningEditMode,
    setRemovingSignature,
    setPendingDelete,
    setIsDeleting,
    setIsPreviewLoading,
    setPreviewNonce,
    setActiveSideTab,
    setApproverHasDownloaded,
    setApproverHasUploaded,
    setIsRegisterModalOpen,
    setIsDistributeModalOpen,
    setActiveWorkflowCode,
    workflow,
    fileUpload,
    handleActionResult,
  }), [
    workflow,
    fileUpload,
    handleActionResult,
    push,
    setLocalVersion,
    setLocalTitle,
    setLocalDesc,
    setLocalEffectiveDate,
    setSigningOpen,
    setSigningInBackground,
    setSigningEditMode,
    setRemovingSignature,
    setPendingDelete,
    setIsDeleting,
    setIsPreviewLoading,
    setPreviewNonce,
    setActiveSideTab,
    setApproverHasDownloaded,
    setApproverHasUploaded,
    setIsRegisterModalOpen,
    setIsDistributeModalOpen,
    setActiveWorkflowCode,
  ]);

  return { state, actions: hookActions };
}
