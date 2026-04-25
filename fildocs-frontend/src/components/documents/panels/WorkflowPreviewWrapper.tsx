import React from "react";
import WorkflowPreviewPanel from "./WorkflowPreviewPanel";
import type { DocumentVersion } from "../../../services/documents";

type Props = {
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
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectVersion?: (v: DocumentVersion) => void;
  isLoadingSelectedVersion?: boolean;
  canReplace?: boolean;
  onClickTemplates?: () => void;
  isActiveApprover?: boolean;
  approverHasDownloaded?: boolean;
  onApproverDownload?: () => Promise<void>;
  onApproverUpload?: () => void;
  onRegeneratePreview?: () => Promise<void>;
  isRegeneratingPreview?: boolean;
};

const WorkflowPreviewWrapper: React.FC<Props> = ({
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
  onClickTemplates,
  onDrop,
  onDragOver,
  onDragLeave,
  onFileSelect,
  canReplace = false,
  isActiveApprover = false,
  approverHasDownloaded = false,
  onApproverDownload,
  onApproverUpload,
  onRegeneratePreview,
  isRegeneratingPreview = false,
}) => {
  return (
    <div
      className="flex flex-col gap-0 rounded-xl overflow-hidden border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-sm"
      style={{ height: "100%" }}
    >
      {/* Info Strip */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-surface-600/50 border-b border-slate-200 dark:border-surface-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center px-1.5 py-0.5 rounded-sm bg-slate-800 dark:bg-slate-400 text-[9px] font-bold text-white dark:text-slate-900 uppercase tracking-widest">
            V{localVersion.version_number}
          </div>
          <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
            {localVersion.status}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 tabular-nums">
             <span className="opacity-60">Synced:</span>
             <span>{new Date(localVersion.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>
        </div>
      </div>
      {/* Preview — fills available space */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <WorkflowPreviewPanel
          versionId={localVersion.id}
          previewPath={localVersion.preview_path ?? null}
          filePath={localVersion.file_path ?? null}
          checksum={localVersion.checksum ?? null}
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
          onClickTemplates={onClickTemplates}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onFileSelect={onFileSelect}
          isActiveApprover={isActiveApprover}
          approverHasDownloaded={approverHasDownloaded}
          onApproverDownload={onApproverDownload}
          onApproverUpload={onApproverUpload}
          onRegeneratePreview={onRegeneratePreview}
          isRegeneratingPreview={isRegeneratingPreview}
        />
      </div>
    </div>
  );
};

export default WorkflowPreviewWrapper;
