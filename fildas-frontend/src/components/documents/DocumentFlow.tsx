import React from "react";
import WorkflowProgressCard from "./documentFlow/WorkflowProgressCard";
import DocumentRightPanel from "./documentFlow/DocumentRightPanel";
import DocumentPreviewPanel from "./documentFlow/DocumentPreviewPanel";

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
}

// ── RightPanel: preview + collapsible versions shelf ────────────────────────
type RightPanelProps = {
  localVersion: DocumentVersion;
  allVersions: DocumentVersion[];
  selectedVersionId: number | null;
  signedPreviewUrl: string;
  previewNonce: number;
  isUploading: boolean;
  uploadProgress: number;
  isExternalUploading?: boolean;
  isPreviewLoading: boolean;
  setIsPreviewLoading: (v: boolean) => void;
  fileInputRef: React.Ref<HTMLInputElement>;
  onOpenPreview: () => Promise<void>;
  onClickReplace: () => void;
  onReloadPreview: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectVersion?: (v: DocumentVersion) => void;
  isLoadingSelectedVersion?: boolean;
  canReplace?: boolean;
};

const RightPanel: React.FC<RightPanelProps> = ({
  localVersion,
  signedPreviewUrl,
  previewNonce,
  isUploading,
  uploadProgress,
  isExternalUploading = false,
  isPreviewLoading,
  setIsPreviewLoading,
  fileInputRef,
  onOpenPreview,
  onClickReplace,
  onReloadPreview,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  canReplace = false,
}) => {
  // const statusColors: Record<string, string> = {
  //   draft:
  //     "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  //   review:
  //     "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  //   approval: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  //   registration:
  //     "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  //   distributed:
  //     "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  // };

  // const getStatusColor = (status: string) => {
  //   const key = status.toLowerCase().trim();
  //   return (
  //     statusColors[key] ??
  //     Object.entries(statusColors).find(([k]) => key.includes(k))?.[1] ??
  //     "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300"
  //   );
  // };

  return (
    <div
      className="flex flex-col gap-0 rounded-xl overflow-hidden border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500"
      style={{ height: "calc(100vh - 220px)" }}
    >
      {/* Preview — fills available space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <DocumentPreviewPanel
          versionId={localVersion.id}
          previewPath={localVersion.preview_path ?? null}
          filePath={localVersion.file_path ?? null}
          originalFilename={localVersion.original_filename ?? null}
          status={localVersion.status}
          canReplace={canReplace}
          signedPreviewUrl={signedPreviewUrl}
          previewNonce={previewNonce}
          isUploading={isUploading}
          uploadProgress={uploadProgress}
          isExternalUploading={isExternalUploading}
          isPreviewLoading={isPreviewLoading}
          setIsPreviewLoading={setIsPreviewLoading}
          fileInputRef={fileInputRef}
          onOpenPreview={onOpenPreview}
          onClickReplace={onClickReplace}
          onReloadPreview={onReloadPreview}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onFileSelect={onFileSelect}
        />
      </div>
    </div>
  );
};

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
}) => {
  const { push } = useToast();
  const myOfficeId = getCurrentUserOfficeId();
  const myUserId = Number(getAuthUser()?.id ?? 0);

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
    !!assignedOfficeId && Number(myOfficeId) === Number(assignedOfficeId);
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
  const hasSigned = !!(localVersion as any)?.signed_file_path;
  const needsSignedFile = isInApprovalPhase && canAct && !hasSigned;

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

  const headerActions: HeaderActionButton[] = React.useMemo(() => {
    const cancelBlockedStatuses = new Set([
      "For Registration",
      "For Distribution",
      "Distributed",
      "Superseded",
      "Cancelled",
    ]);
    const showCancel = !cancelBlockedStatuses.has(localVersion?.status ?? "");

    return [...workflow.availableActions]
      .filter((code) => code !== "CANCEL_DOCUMENT" || showCancel)
      .sort((a, b) => (ACTION_PRIORITY[a] ?? 500) - (ACTION_PRIORITY[b] ?? 500))
      .map((code) => ({
        key: code,
        label: ACTION_LABELS[code] ?? code,
        variant:
          code === "REJECT" || code === "CANCEL_DOCUMENT"
            ? "danger"
            : "primary",
        // CANCEL_DOCUMENT is always clickable for owner/admin — backend enforces who can cancel
        disabled:
          workflow.isChangingStatus ||
          (code !== "CANCEL_DOCUMENT" && !canAct) ||
          (needsSignedFile && !["REJECT", "CANCEL_DOCUMENT"].includes(code)) ||
          (needsFileReplacement &&
            !["REJECT", "CANCEL_DOCUMENT"].includes(code)),
        onClick: async () => {
          try {
            const res = await workflow.submitAction(code);
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
      }));
  }, [
    workflow.availableActions,
    workflow.isChangingStatus,
    canAct,
    needsSignedFile,
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

    const isOwner =
      !!myOfficeId &&
      (myOfficeId === (document as any)?.owner_office_id ||
        myOfficeId === qaOfficeId);

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
          try {
            if (
              !confirm(
                "Delete this draft? This will remove the whole document draft.",
              )
            )
              return;
            await deleteDraftVersion(localVersion!.id);
            onAfterActionClose?.();
          } catch (e: any) {
            push({
              type: "error",
              title: "Delete failed",
              message: e?.message ?? "Delete failed.",
            });
          }
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
          try {
            if (
              !confirm(
                "Cancel this revision draft? This will delete the draft and return to the last official version.",
              )
            )
              return;
            await deleteDraftVersion(localVersion!.id);
            if (onChanged) await onChanged();
            onAfterActionClose?.();
          } catch (e: any) {
            push({
              type: "error",
              title: "Cancel failed",
              message: e?.message ?? "Cancel failed.",
            });
          }
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
    `${localVersion?.status}|${localVersion?.version_number}|${canAct}|${workflow.isTasksReady}|${needsSignedFile ? 1 : 0}|${needsFileReplacement ? 1 : 0}|` +
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
    <section className="flex flex-col gap-4">
      {/* Cancelled banner */}
      {effectiveStatus === "Cancelled" && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
          <span className="text-rose-500 shrink-0 text-base">✕</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-rose-800 dark:text-rose-300">
              Document cancelled
            </p>
            <p className="text-[11px] text-rose-700 dark:text-rose-400 mt-0.5">
              This document was cancelled. No further workflow actions are
              available.
            </p>
          </div>
        </div>
      )}

      {/* File replacement required banner */}
      {needsFileReplacement && (
        <div className="flex items-center gap-3 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-3">
          <span className="text-orange-500 shrink-0 text-base">↺</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-orange-800 dark:text-orange-300">
              New file required before forwarding
            </p>
            <p className="text-[11px] text-orange-700 dark:text-orange-400 mt-0.5">
              Upload a new version of the document using the "Replace" button
              before forwarding.
            </p>
          </div>
        </div>
      )}

      {/* Signing required banner */}
      {needsSignedFile && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3">
          <span className="text-amber-500 shrink-0 text-base">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
              Signed document required
            </p>
            <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
              Upload a signed copy using the "Upload signed" button on the right
              before you can forward this document.
            </p>
          </div>
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
          <RightPanel
            localVersion={localVersion}
            allVersions={allVersions}
            selectedVersionId={selectedVersion?.id ?? null}
            canReplace={
              localVersion.status === "Draft" ||
              localVersion.status === "Office Draft" ||
              (canAct && isInApprovalPhase)
            }
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
            onReloadPreview={() => {
              // Nuke cache + force re-fetch for the current preview path
              if (localVersion?.preview_path) {
                delete previewUrlCacheRef.current[localVersion.preview_path];
              }
              previewUrlCacheRef.current = {};
              setSignedPreviewUrl("");
              setIsPreviewLoading(true);
              setPreviewNonce((n) => n + 1);
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
  );
};

export default DocumentFlow;
