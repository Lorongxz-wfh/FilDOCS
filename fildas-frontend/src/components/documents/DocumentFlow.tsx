import React from "react";
import WorkflowProgressCard from "./documentFlow/WorkflowProgressCard";
import DocumentRightPanel from "./documentFlow/DocumentRightPanel";
import DocumentPreviewWrapper from "./documentFlow/DocumentPreviewWrapper";
import DeleteDraftConfirmModal from "./documentFlow/DeleteDraftConfirmModal";
import SignDocumentModal from "./SignDocumentModal";
import WorkflowHeaderPanel from "./documentFlow/WorkflowHeaderPanel";
import { RegisterDocumentModal } from "./documentFlow/RegisterDocumentModal";
import { DistributeDocumentModal } from "./documentFlow/DistributeDocumentModal";
import TemplatesBrowserPanel from "../templates/TemplatesBrowserPanel";
import { setDocumentShares } from "../../services/documents";

import {
  type Document,
  type DocumentVersion,
  getDocumentPreviewLink,
  invalidatePreviewCache,
  deleteDraftVersion,
  postDocumentMessage,
  downloadDocument,
  type WorkflowActionCode,
} from "../../services/documents";

import {
  removeInAppSignature,
  regenerateDocumentPreview,
  updateDocumentVersionEffectiveDate,
} from "../../services/documentApi";
import { useToast } from "../ui/toast/ToastContext";
import { getAuthUser } from "../../lib/auth";
import { useDocumentFlowUI } from "../../hooks/useDocumentFlowUI";
import { formatWhen } from "./documentFlow/flowUtils";
import { phases } from "./documentFlow/flowConfig";
import type { DocumentFlowHeaderState } from "./documentFlow/types";

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
  refreshTrigger?: number;
}

const DocumentFlow: React.FC<DocumentFlowProps> = ({
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
  const currentUserSignatureUrl = me?.signature_url ?? null;
  const [templatesPanelOpen, setTemplatesPanelOpen] = React.useState(false);

  const { state, actions } = useDocumentFlowUI({
    document,
    version,
    onChanged,
    onAfterActionClose,
    adminDebugMode,
  });

  React.useEffect(() => {
    if (refreshTrigger > 0) {
      actions.syncAll();
    }
  }, [refreshTrigger, actions]);

  // ── Sync Header State to Parent ───────────────────────────
  const onHeaderStateChangeRef = React.useRef(onHeaderStateChange);
  React.useEffect(() => {
    onHeaderStateChangeRef.current = onHeaderStateChange;
  }, [onHeaderStateChange]);

  const headerSig = React.useMemo(() => {
    return `${state.localVersion?.id}|${state.localVersion?.status}|${state.localVersion?.version_number}|${state.canAct}|${actions.workflow.isTasksReady}|${state.needsFileReplacement ? 1 : 0}|${actions.fileUpload.isUploading ? 1 : 0}|${state.localTitle}`;
  }, [
    state.localVersion?.id,
    state.localVersion?.status,
    state.localVersion?.version_number,
    state.canAct,
    actions.workflow.isTasksReady,
    state.needsFileReplacement,
    actions.fileUpload.isUploading,
    state.localTitle
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
    });
  }, [headerSig, state.headerActions, state.versionActions, document?.title, document?.code, state.localTitle]);

  // ── Sync Right Panel Content to Parent ───────────────────────
  const [draftMessage, setDraftMessage] = React.useState("");
  const [isSendingMessage, setIsSendingMessage] = React.useState(false);
  const [optimisticMessages, setOptimisticMessages] = React.useState<any[]>([]);

  const onRightPanelContentRef = React.useRef(onRightPanelContent);
  React.useEffect(() => {
    onRightPanelContentRef.current = onRightPanelContent;
  }, [onRightPanelContent]);

  const handleSendMessage = React.useCallback(async () => {
    const text = draftMessage.trim();
    if (!text || !state.localVersion?.id) return;
    setIsSendingMessage(true);
    try {
      await postDocumentMessage(state.localVersion.id, { message: text, type: "comment" });
      await actions.workflow.refreshMessages();
      setDraftMessage("");
    } catch (e: any) {
      push({ type: "error", title: "Send failed", message: e?.message ?? "Failed to send." });
    } finally {
      setIsSendingMessage(false);
    }
  }, [state.localVersion?.id, actions.workflow.refreshMessages, draftMessage, push]);

  const rightPanelSig = React.useMemo(() => {
    return `${state.localVersion?.id}|${state.localVersion?.updated_at}|${actions.workflow.tasks.length}|${actions.workflow.messages.length}|${actions.workflow.activityLogs.length}|${state.activeSideTab}|${isSendingMessage}|${draftMessage}|${actions.workflow.newMessageCount}`;
  }, [
    state.localVersion?.id,
    state.localVersion?.updated_at,
    actions.workflow.tasks.length,
    actions.workflow.messages.length,
    actions.workflow.activityLogs.length,
    state.activeSideTab,
    isSendingMessage,
    draftMessage,
    actions.workflow.newMessageCount,
  ]);

  const lastRightPanelSigRef = React.useRef("");
  React.useEffect(() => {
    if (!document || !state.localVersion) return;
    if (rightPanelSig === lastRightPanelSigRef.current) return;
    lastRightPanelSigRef.current = rightPanelSig;

    onRightPanelContentRef.current?.(
      <DocumentRightPanel
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
        draftMessage={draftMessage}
        setDraftMessage={setDraftMessage}
        isSendingMessage={isSendingMessage}
        onSendMessage={handleSendMessage}
        optimisticMessages={optimisticMessages}
        setOptimisticMessages={setOptimisticMessages}
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
    rightPanelSig,
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
    isSendingMessage,
    draftMessage,
    optimisticMessages,
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
          isDraft={state.localVersion?.status === "Draft" || state.localVersion?.status === "Office Draft"}
          hasFile={!!state.localVersion?.file_path}
          canAct={state.canAct}
          headerActions={state.headerActions}
          approverNeedsSignedUpload={state.isActiveApprover && (!state.approverHasDownloaded || !state.approverHasUploaded)}
          approverHasDownloaded={state.approverHasDownloaded}
          isPreApprovalCreatorCheck={state.canAct && actions.workflow.availableActions.some((a: WorkflowActionCode) => ["QA_START_OFFICE_APPROVAL", "OFFICE_START_APPROVAL", "CUSTOM_START_APPROVAL"].includes(a))}
          hasSignedFile={!!(state.localVersion as any)?.signed_file_path}
          hasPreSignBackup={!!(state.localVersion as any)?.pre_sign_file_path}
          currentUserSignatureUrl={currentUserSignatureUrl}
          needsFileReplacement={state.needsFileReplacement}
          isActiveApprover={state.isActiveApprover}
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
            <DocumentPreviewWrapper
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
              onReloadPreview={async () => {
                // This logic is mostly handled in hook useEffect, but we can trigger a refresh via actions if needed
                invalidatePreviewCache(state.localVersion!.id);
                actions.handleActionResult({ version: state.localVersion! });
              }}
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
        <DeleteDraftConfirmModal
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
        <SignDocumentModal
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
            if (onChanged) await onChanged();
            // Preview refresh handled by hook's useEffect watching localVersion.updated_at
          }}
          onSignError={(msg) => push({ type: "error", title: "Signing failed", message: msg })}
        />
      )}

      {state.isRegisterModalOpen && (
        <RegisterDocumentModal
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
        <DistributeDocumentModal
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

export default DocumentFlow;
