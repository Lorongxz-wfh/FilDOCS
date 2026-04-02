import React from "react";
import DocumentPreviewPanel from "./DocumentPreviewPanel";
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
  onReloadPreview: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSelectVersion?: (v: DocumentVersion) => void;
  isLoadingSelectedVersion?: boolean;
  canReplace?: boolean;
  isActiveApprover?: boolean;
  approverHasDownloaded?: boolean;
  onApproverDownload?: () => Promise<void>;
  onApproverUpload?: () => void;
  onRegeneratePreview?: () => Promise<void>;
  isRegeneratingPreview?: boolean;
};

const DocumentPreviewWrapper: React.FC<Props> = ({
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
  isActiveApprover = false,
  approverHasDownloaded = false,
  onApproverDownload,
  onApproverUpload,
  onRegeneratePreview,
  isRegeneratingPreview = false,
}) => {
  return (
    <div
      className="flex flex-col gap-0 rounded-xl overflow-hidden border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500"
      style={{ height: "100%" }}
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

export default DocumentPreviewWrapper;
