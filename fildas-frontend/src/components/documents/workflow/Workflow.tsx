import React from "react";
import { getAssetUrl } from "../../../services/api";
import WorkflowProgressCard from "./WorkflowProgressCard";
import WorkflowRightPanel from "../panels/WorkflowRightPanel";
import WorkflowPreviewWrapper from "../panels/WorkflowPreviewWrapper";
import WorkflowDeleteDraftModal from "../modals/WorkflowDeleteDraftModal";
import WorkflowSignModal from "../modals/WorkflowSignModal";
import WorkflowHeaderPanel from "./WorkflowHeaderPanel";
import WorkflowRegisterModal from "../modals/WorkflowRegisterModal";
import WorkflowDistributeModal from "../modals/WorkflowDistributeModal";
import TemplatesBrowserPanel from "../../templates/TemplatesBrowserPanel";
import { setDocumentShares } from "../../../services/documents";

import {
  type Document,
  type DocumentVersion,
  getDocumentPreviewLink,
  invalidatePreviewCache,
  deleteDraftVersion,
  postDocumentMessage,
  downloadDocument,
} from "../../../services/documents";

import {
  removeInAppSignature,
  regenerateDocumentPreview,
  updateDocumentVersionEffectiveDate,
} from "../../../services/documentApi";
import { useToast } from "../../ui/toast/ToastContext";
import { getAuthUser } from "../../../lib/auth";
import { useWorkflowUI } from "../../../hooks/useWorkflowUI";
import { formatWhen } from "./config/flowUtils";
import { phases } from "./config/flowConfig";
import type { WorkflowHeaderState } from "./config/types";

interface WorkflowProps {
  isPageLoading?: boolean;
  isExternalUploading?: boolean;
  document: Document | null;
  version: DocumentVersion | null;
  allVersions?: DocumentVersion[];
  selectedVersion?: DocumentVersion | null;
  isLoadingSelectedVersion?: boolean;
  onSelectVersion?: (v: DocumentVersion) => void;
  onChanged?: () => Promise<void> | void;
  onHeaderStateChange?: (s: WorkflowHeaderState) => void;
  onAfterActionClose?: () => void;
  onRightPanelContent?: (content: React.ReactNode) => void;
  adminDebugMode?: boolean;
  refreshTrigger?: number;
}

const Workflow: React.FC<WorkflowProps> = ({
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
  refreshTrigger = 0,
}) => {
  const { push } = useToast();
  const me = React.useMemo(() => getAuthUser(), []);
  const currentUserSignatureUrl = React.useMemo(() => 
    getAssetUrl(me?.signature_url || me?.signature_path || null)
  , [me]);
  const [templatesPanelOpen, setTemplatesPanelOpen] = React.useState(false);

  const { state, actions } = useWorkflowUI({
    document,
    version,
    onChanged,
    onAfterActionClose,
    adminDebugMode,
  });

  const lastHandledRefreshRef = React.useRef(refreshTrigger);
  React.useEffect(() => {
    if (refreshTrigger > 0 && refreshTrigger !== lastHandledRefreshRef.current) {
      lastHandledRefreshRef.current = refreshTrigger;
      actions.syncAll();
      // Note: onChanged and previewNonce are now handled by useWorkflowUI's updated_at watcher
    }
  }, [refreshTrigger, actions]);

  // ── Automatic Real-time Sync ───────────────────────────────
  React.useEffect(() => {
    if (actions.workflow.taskChanged) {
      actions.workflow.clearTaskChanged();
      // Silent refresh of workspace/version data
      onChanged?.(); 
      // Auto-bust preview if file/signature might have changed
      if (state.localVersion) {
        invalidatePreviewCache(state.localVersion.id);
        actions.setPreviewNonce((n) => n + 1);
      }
    }
  }, [actions.workflow.taskChanged, actions.workflow, actions.setPreviewNonce, state.localVersion?.id, onChanged]);

  // ── Sync Header State to Parent ───────────────────────────
  const onHeaderStateChangeRef = React.useRef(onHeaderStateChange);
  React.useEffect(() => {
    onHeaderStateChangeRef.current = onHeaderStateChange;
  }, [onHeaderStateChange]);

  const headerSig = React.useMemo(() => {
    return `${state.localVersion?.id}|${state.localVersion?.status}|${state.localVersion?.version_number}|${state.canAct}|${actions.workflow.isTasksReady}|${actions.workflow.availableActions.join(",")}|${state.needsFileReplacement ? 1 : 0}|${actions.fileUpload.isUploading ? 1 : 0}|${state.localTitle}|${state.routingUsers?.length}|${state.actingAsUserId}|${state.isLoadingRoutingUsers}|${state.hasSignedFile ? 1 : 0}|${state.approverHasUploaded ? 1 : 0}`;
  }, [
    state.localVersion?.id,
    state.localVersion?.status,
    state.localVersion?.version_number,
    state.canAct,
    actions.workflow.isTasksReady,
    actions.workflow.availableActions,
    state.needsFileReplacement,
    actions.fileUpload.isUploading,
    state.localTitle,
    state.routingUsers?.length,
    state.actingAsUserId,
    state.isLoadingRoutingUsers,
    state.hasSignedFile,
    state.approverHasUploaded,
  ]);

  const lastSigRef = React.useRef("");
  React.useEffect(() => {
    if (!state.localVersion) return;
    if (headerSig === lastSigRef.current) return;
    lastSigRef.current = headerSig;

    onHeaderStateChangeRef.current?.({
      title: state.localVersion.status === "Draft" ? state.localTitle : (document?.title ?? ""),
      code: document?.code ?? "CODE-NOT-AVAILABLE",
      status: state.localVersion.status ?? "",
      versionNumber: Number(state.localVersion.version_number ?? 0),
      canAct: state.canAct,
      isTasksReady: actions.workflow.isTasksReady,
      headerActions: state.headerActions,
      versionActions: state.versionActions,

      // Impersonation
      routingUsers: state.routingUsers,
      actingAsUserId: state.actingAsUserId,
      isLoadingRoutingUsers: state.isLoadingRoutingUsers,
      setActingAsUserId: actions.setActingAsUserId,
    });
  }, [
    headerSig,
    state.headerActions,
    state.versionActions,
    document?.title,
    document?.code,
    state.localTitle,
    state.routingUsers,
    state.actingAsUserId,
    state.isLoadingRoutingUsers,
    state.canAct,
    actions.workflow.isTasksReady,
    state.localVersion,
    actions.setActingAsUserId,
  ]);

  // ── Right Panel ───────────────────────────────────────────────
  const onRightPanelContentRef = React.useRef(onRightPanelContent);
  React.useEffect(() => {
    onRightPanelContentRef.current = onRightPanelContent;
  }, [onRightPanelContent]);

  const handleSendMessage = React.useCallback(async (text: string) => {
    if (!text || !state.localVersion?.id) return;
    await postDocumentMessage(state.localVersion.id, { message: text, type: "comment" });
    await actions.workflow.refreshMessages();
  }, [state.localVersion?.id, actions.workflow.refreshMessages]);

  // ── Sync right panel UI to parent shell (fully reactive) ───────────────────
  React.useEffect(() => {
    console.debug("[Workflow] Syncing right panel content to parent.");
    
    // We stop the signature optimization because it caused 'frozen' UI or missed updates.
    // Instead, we push whenever the underlying data or tab changes.
    onRightPanelContentRef.current?.(
      <WorkflowRightPanel
        document={document}
        version={state.localVersion}
        offices={state.offices}
        routeSteps={state.routeSteps}
        tasks={actions.workflow.tasks}
        newMessageCount={actions.workflow.newMessageCount}
        clearNewMessageCount={actions.workflow.clearNewMessageCount}
        activeSideTab={state.activeSideTab}
        setActiveSideTab={actions.setActiveSideTab}
        isLoadingActivityLogs={actions.workflow.isLoadingActivityLogs}
        activityLogs={actions.workflow.activityLogs}
        isLoadingMessages={actions.workflow.isLoadingMessages}
        messages={actions.workflow.messages}
        onSendMessage={handleSendMessage}
        formatWhen={formatWhen}
        isEditable={
          state.isQAOfficeUser ||
          me?.office_id === Number((document as any)?.owner_office_id ?? -1) ||
          Number(me?.id) === Number((document as any)?.created_by ?? -1)
        }
        onChanged={() => onChanged?.()}
        onTitleSaved={(newTitle) => {
          actions.setLocalTitle(newTitle);
          onChanged?.();
        }}
      />
    );
  }, [
    document,
    state.localVersion,
    state.offices,
    state.routeSteps,
    actions.workflow.tasks,
    actions.workflow.messages,
    actions.workflow.activityLogs,
    actions.workflow.newMessageCount,
    actions.workflow.clearNewMessageCount,
    actions.workflow.isLoadingActivityLogs,
    actions.workflow.isLoadingMessages,
    state.activeSideTab,
    handleSendMessage,
    formatWhen,
    state.isQAOfficeUser,
    me,
    onChanged,
    actions.setActiveSideTab,
    actions.setLocalTitle,
  ]);

  return (
    <>
      <section className="flex flex-col gap-4 animate-in fade-in duration-300">
        <WorkflowHeaderPanel
          documentCode={document?.code ?? "N/A"}
          versionNumber={Number(state.localVersion?.version_number ?? 0)}
          status={state.localVersion?.status ?? "Loading..."}
          isDraft={state.isDraft}
          hasFile={state.hasFile}
          canAct={state.canAct}
          headerActions={state.headerActions}
          approverNeedsSignedUpload={state.approverNeedsSignedUpload}
          approverHasDownloaded={state.approverHasDownloaded}
          isPreApprovalCreatorCheck={state.isPreApprovalCreatorCheck}
          hasSignedFile={!!(state.localVersion as any)?.signed_file_path}
          hasPreSignBackup={!!(state.localVersion as any)?.pre_sign_file_path}
          currentUserSignatureUrl={currentUserSignatureUrl}
          needsFileReplacement={state.needsFileReplacement}
          isActiveApprover={state.isActiveApprover}
          approverHasUploaded={state.approverHasUploaded}
          onDownload={async () => {
             try {
               await downloadDocument(state.localVersion!);
               actions.setApproverHasDownloaded(true);
             } catch (e: any) {
               push({ type: "error", title: "Download failed", message: e?.message ?? "Could not download." });
             }
          }}
          onTriggerSign={(editMode) => {
            actions.setSigningEditMode(editMode ?? false);
            actions.setSigningOpen(true);
          }}
          onTriggerUpload={() => {
            if (!state.canAct) return;
            actions.fileUpload.triggerFilePicker();
          }}
          onRemoveSignature={async () => {
            actions.setRemovingSignature(true);
            try {
              await removeInAppSignature(state.localVersion!.id);
              if (onChanged) await onChanged();
            } catch (e: any) {
              push({ type: "error", title: "Failed to remove signature", message: e?.message ?? "Could not remove signature." });
            } finally {
              actions.setRemovingSignature(false);
            }
          }}
          isChangingStatus={actions.workflow.isChangingStatus}
          isUploading={actions.fileUpload.isUploading}
          signingInBackground={state.signingInBackground}
          removingSignature={state.removingSignature}
        />

        <WorkflowProgressCard
          phases={phases}
          routeStepsCount={state.routeSteps.length}
          isTasksReady={actions.workflow.isTasksReady}
          currentStep={state.currentStep}
          nextStep={state.nextStep}
          currentPhaseIndex={state.currentPhaseIndex}
          currentGlobalIndex={state.activeFlowSteps.findIndex(s => s.id === state.currentStep.id)}
          currentPhaseId={state.currentPhase.id}
          activeFlowSteps={state.activeFlowSteps}
          tasks={actions.workflow.tasks}
        />

        {/* Specialized Finalization Modals are handled via hook state */}

        <div style={{ height: "calc(100vh - 145px)" }}>
          {!state.localVersion ? (
            <div className="flex flex-col h-full rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
              <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-2 gap-3">
                <div className="h-2.5 w-32 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                <div className="h-6 w-14 rounded-md bg-slate-200 dark:bg-surface-300 animate-pulse" />
              </div>
              <div className="flex-1 bg-slate-100 dark:bg-surface-600 animate-pulse" />
            </div>
          ) : (
            <WorkflowPreviewWrapper
              localVersion={state.localVersion}
              allVersions={allVersions}
              selectedVersionId={selectedVersion?.id ?? null}
              canReplace={(state.localVersion.status === "Draft" || state.localVersion.status === "Office Draft") && state.canAct}
              isActiveApprover={state.isActiveApprover}
              approverHasDownloaded={state.approverHasDownloaded}
              onApproverDownload={async () => {
                try {
                  await downloadDocument(state.localVersion!);
                  actions.setApproverHasDownloaded(true);
                } catch (e: any) {
                  push({ type: "error", title: "Download failed", message: e?.message ?? "Could not download." });
                }
              }}
              onApproverUpload={() => {
                if (!state.canAct) return;
                actions.fileUpload.triggerFilePicker();
              }}
              signedPreviewUrl={state.signedPreviewUrl}
              previewNonce={state.previewNonce}
              isUploading={actions.fileUpload.isUploading}
              uploadProgress={actions.fileUpload.uploadProgress}
              isPreviewLoading={state.isPreviewLoading}
              setIsPreviewLoading={actions.setIsPreviewLoading}
              fileInputRef={actions.fileUpload.fileInputRef}
              onOpenPreview={async () => {
                
                const res = await getDocumentPreviewLink(state.localVersion!.id);
                window.open(res.url, "_blank");
              }}
              onClickReplace={() => {
                if (!state.canAct) return;
                actions.fileUpload.triggerFilePicker();
              }}
              onClickTemplates={() => setTemplatesPanelOpen(true)}
              onDrop={actions.fileUpload.handleDrop}
              onDragOver={actions.fileUpload.handleDragOver}
              onDragLeave={actions.fileUpload.handleDragLeave}
              onFileSelect={actions.fileUpload.handleFileSelect}
              isExternalUploading={isExternalUploading || state.signingInBackground}
              onSelectVersion={onSelectVersion}
              isLoadingSelectedVersion={isLoadingSelectedVersion}
              isRegeneratingPreview={false} // hook-state TBD
              onRegeneratePreview={async () => {
                if (!state.localVersion) return;
                try {
                  await regenerateDocumentPreview(state.localVersion.id);
                  if (onChanged) await onChanged();
                } catch (e: any) {
                  push({ type: "error", title: "Regeneration failed", message: e?.message ?? "Error." });
                }
              }}
            />
          )}
        </div>
      </section>

      {state.pendingDelete != null && (
        <WorkflowDeleteDraftModal
          pendingDelete={state.pendingDelete}
          isDeleting={state.isDeleting}
          onCancel={() => actions.setPendingDelete(null)}
          onConfirm={async () => {
            actions.setIsDeleting(true);
            try {
              await deleteDraftVersion(state.localVersion!.id);
              if (state.pendingDelete === "revision" && onChanged) await onChanged();
              actions.setPendingDelete(null);
              onAfterActionClose?.();
            } catch (e: any) {
              push({ type: "error", title: "Delete failed", message: e?.message ?? "Operation failed." });
              actions.setPendingDelete(null);
            } finally {
              actions.setIsDeleting(false);
            }
          }}
        />
      )}

      {state.signingOpen && state.localVersion && (
        <WorkflowSignModal
          open={state.signingOpen}
          onClose={() => { actions.setSigningOpen(false); actions.setSigningEditMode(false); }}
          documentVersionId={state.localVersion.id}
          signatureUrl={currentUserSignatureUrl ?? undefined}
          isEditMode={state.signingEditMode}
          originalFilename={state.localVersion.original_filename ?? document?.title ?? undefined}
          onSigningStart={() => actions.setSigningInBackground(true)}
          onSigned={async () => {
            actions.setApproverHasDownloaded(true);
            actions.setApproverHasUploaded(true);
            actions.setSigningInBackground(false);
            actions.setSigningEditMode(false);
            await actions.syncAll();
            if (onChanged) await onChanged();
            // Preview refresh handled by hook's useEffect watching localVersion.updated_at
          }}
          onSignError={(msg) => push({ type: "error", title: "Signing failed", message: msg })}
        />
      )}

      {state.isRegisterModalOpen && (
        <WorkflowRegisterModal
          isOpen={state.isRegisterModalOpen}
          onClose={() => actions.setIsRegisterModalOpen(false)}
          documentTitle={document?.title ?? ""}
          documentCode={(document as any)?.reserved_code || document?.code || "—"}
          officeName={
            state.offices.find((o) => o.id === document?.owner_office_id)?.name ||
            document?.ownerOffice?.name ||
            "System"
          }
          effectiveDate={state.localEffectiveDate}
          onEffectiveDateChange={actions.setLocalEffectiveDate}
          isProcessing={actions.workflow.isChangingStatus}
          onConfirm={async () => {
            if (!state.activeWorkflowCode || !state.localVersion) return;
            
            // Close immediately for instant feedback
            actions.setIsRegisterModalOpen(false);
            // Immediate feedback: start spinner while async logic runs
            actions.setActiveWorkflowCode(state.activeWorkflowCode);
            actions.workflow.setIsChangingStatus(true);
            
            try {
              // 1. Sync effective date if changed
              await updateDocumentVersionEffectiveDate(
                state.localVersion.id,
                state.localEffectiveDate.trim() || null
              );

              // 2. Submit workflow action
              const res = await actions.workflow.submitAction(
                state.activeWorkflowCode as any
              );
              if (res) {
                actions.handleActionResult(res);
                push({
                  type: "success",
                  title: "Document Registered",
                  message: res.message || "Registration complete.",
                });
                if (onChanged) await onChanged();
              }
            } catch (e: any) {
              push({
                type: "error",
                title: "Registration failed",
                message: e?.message ?? "Error.",
              });
            }
          }}
        />
      )}

      {state.isDistributeModalOpen && (
        <WorkflowDistributeModal
          isOpen={state.isDistributeModalOpen}
          onClose={() => actions.setIsDistributeModalOpen(false)}
          offices={state.offices}
          participantOfficeIds={state.participantOfficeIds}
          ownerOfficeId={document?.owner_office_id ?? null}
          isProcessing={actions.workflow.isChangingStatus}
          onConfirm={async (selectedOfficeIds) => {
            if (!state.activeWorkflowCode || !state.localVersion) return;
            
            // Close immediately for instant feedback
            actions.setIsDistributeModalOpen(false);
            // Immediate feedback: start spinner while async logic runs
            actions.setActiveWorkflowCode(state.activeWorkflowCode);
            actions.workflow.setIsChangingStatus(true);
            
            try {
              // 1. Save shares first
              await setDocumentShares(document!.id, selectedOfficeIds);
              
              // 2. Submit workflow action
              const res = await actions.workflow.submitAction(state.activeWorkflowCode as any);
              if (res) {
                actions.handleActionResult(res);
                push({ type: "success", title: "Document Distributed", message: res.message || "Distribution complete." });
                if (onChanged) await onChanged();
              }
            } catch (e: any) {
              push({ type: "error", title: "Distribution failed", message: e?.message ?? "Error." });
            }
          }}
        />
      )}

      <TemplatesBrowserPanel
        open={templatesPanelOpen}
        onClose={() => setTemplatesPanelOpen(false)}
      />
    </>
  );
};

export default Workflow;
