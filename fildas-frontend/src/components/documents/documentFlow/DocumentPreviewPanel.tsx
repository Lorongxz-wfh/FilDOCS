import React from "react";
import InlineSpinner from "../../ui/loader/InlineSpinner";
import UploadProgress from "../../ui/loader/UploadProgress";
import { Download, Maximize2, RotateCcw, Upload, X, FileX } from "lucide-react";

// ── Preview modal ────────────────────────────────────────────────────────────
function PreviewModal({
  url,
  filename,
  onClose,
}: {
  url: string;
  filename?: string | null;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-4xl h-[90vh] rounded-xl overflow-hidden bg-white shadow-2xl dark:bg-surface-500"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal toolbar */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-surface-400 dark:bg-surface-600">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[70%]">
            {filename ?? "Preview"}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.open(url, "_blank");
              }}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition dark:border-surface-400 dark:bg-surface-500 dark:text-slate-300"
            >
              <Download size={12} /> Download
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition dark:hover:bg-surface-400 dark:hover:text-slate-200"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        {/* iframe */}
        <iframe
          title="Full preview"
          src={url}
          className="flex-1 min-h-0 w-full bg-white dark:bg-surface-600"
        />
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
type Props = {
  versionId: number;
  previewPath: string | null;
  filePath: string | null;
  originalFilename?: string | null;
  status: string;
  canReplace?: boolean;
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
  onReloadPreview?: () => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => Promise<void> | void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => Promise<void> | void;
  isActiveApprover?: boolean;
  approverHasDownloaded?: boolean;
  onApproverDownload?: () => Promise<void>;
  onApproverUpload?: () => void;
  onRegeneratePreview?: () => Promise<void>;
  isRegeneratingPreview?: boolean;
};

const DocumentPreviewPanel: React.FC<Props> = ({
  versionId,
  previewPath,
  filePath,
  originalFilename,
  // status prop kept for API compatibility
  canReplace = false,
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
  isActiveApprover = false,
  // approverHasDownloaded = false,
  onApproverDownload,
  onApproverUpload,
  onRegeneratePreview,
  isRegeneratingPreview = false,
}) => {
  const hasPreview = !!filePath && !!previewPath;
  const [modal, setModal] = React.useState(false);

  const openModal = () => {
    if (signedPreviewUrl) setModal(true);
    else
      onOpenPreview()
        .then(() => setModal(true))
        .catch(() => {});
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Preview container */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
        {/* Toolbar */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 dark:border-surface-400 dark:bg-surface-600">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Document Preview
            </span>
            {originalFilename && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span className="truncate text-xs text-slate-500 dark:text-slate-400 max-w-xs">
                  {originalFilename}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0 overflow-visible">
            {isActiveApprover && onApproverDownload && (
              <button
                type="button"
                onClick={onApproverDownload}
                title="Download for signing"
                className="cursor-pointer flex items-center justify-center h-7 w-7 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition shadow-sm"
              >
                <Download size={13} />
              </button>
            )}
            {isActiveApprover && onApproverUpload && (
              <button
                type="button"
                onClick={onApproverUpload}
                title="Upload signed copy"
                disabled={isUploading}
                className="cursor-pointer flex items-center justify-center h-7 w-7 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload size={13} />
              </button>
            )}
            {hasPreview && onReloadPreview && (
              <button
                type="button"
                onClick={onReloadPreview}
                title="Reload preview"
                className="cursor-pointer flex items-center justify-center h-7 w-7 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition shadow-sm"
              >
                <RotateCcw size={12} />
              </button>
            )}
            {hasPreview && (
              <button
                type="button"
                onClick={openModal}
                title="View fullscreen"
                className="cursor-pointer flex items-center justify-center h-7 w-7 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-500 dark:text-slate-400 hover:bg-slate-50 hover:text-slate-700 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition shadow-sm"
              >
                <Maximize2 size={13} />
              </button>
            )}
            {canReplace && (
              <button
                type="button"
                disabled={isUploading || isExternalUploading}
                onClick={() => {
                  if (!isUploading && !isExternalUploading) onClickReplace();
                }}
                className="cursor-pointer flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400"
              >
                {filePath ? "Replace" : "Upload"}
              </button>
            )}
          </div>
        </div>

        {/* Preview body */}
        <div
          className={`relative flex-1 min-h-0 w-full overflow-hidden transition-all ${
            canReplace && !filePath ? "cursor-pointer" : ""
          }`}
          onClick={() => {
            if (isUploading || isExternalUploading) return;
            if (!canReplace) return;
            // Only trigger replace on body click when no file is uploaded yet
            if (!filePath) onClickReplace();
          }}
          onDrop={(e) => {
            if (!isExternalUploading) onDrop(e);
          }}
          onDragOver={(e) => {
            if (!isExternalUploading) onDragOver(e);
          }}
          onDragLeave={onDragLeave}
        >
          {filePath && previewPath && !signedPreviewUrl && (
            <div className="absolute inset-0 p-4">
              <div className="h-full w-full rounded-md bg-slate-100 dark:bg-surface-400 animate-pulse flex flex-col gap-3 p-6">
                <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-surface-300" />
                <div className="h-4 w-full rounded bg-slate-200 dark:bg-surface-300" />
                <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-surface-300" />
                <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-surface-300" />
                <div className="mt-2 h-4 w-full rounded bg-slate-200 dark:bg-surface-300" />
                <div className="h-4 w-4/5 rounded bg-slate-200 dark:bg-surface-300" />
                <div className="h-4 w-full rounded bg-slate-200 dark:bg-surface-300" />
              </div>
            </div>
          )}

          {hasPreview && signedPreviewUrl ? (
            <iframe
              key={`${versionId}-${previewNonce}`}
              src={signedPreviewUrl}
              title="Document preview"
              className="h-full w-full"
              onLoad={() => setIsPreviewLoading(false)}
              onError={() => setIsPreviewLoading(false)}
            />
          ) : filePath && !previewPath ? (
            /* File uploaded but preview generation failed */
            <div className="flex h-full flex-col items-center justify-center p-8 text-center text-sm m-3">
              <div className="mb-3 h-12 w-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <FileX className="h-6 w-6 text-amber-400 dark:text-amber-500" />
              </div>
              <p className="mb-1 font-medium text-slate-900 dark:text-slate-100">
                Preview unavailable
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs max-w-xs">
                The preview could not be generated for this file. You can try regenerating it or replace the document.
              </p>
              {originalFilename && (
                <p className="mt-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-surface-400 px-2 py-0.5 rounded">
                  {originalFilename}
                </p>
              )}
              {onRegeneratePreview && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRegeneratePreview();
                  }}
                  disabled={isRegeneratingPreview}
                  className="mt-4 flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isRegeneratingPreview ? (
                    <InlineSpinner className="h-3.5 w-3.5 border" />
                  ) : (
                    <RotateCcw size={12} />
                  )}
                  {isRegeneratingPreview ? "Regenerating..." : "Regenerate Preview"}
                </button>
              )}
            </div>
          ) : (
            /* No file uploaded yet */
            <div
              className="flex h-full flex-col items-center justify-center p-8 text-center text-sm border-2 border-dashed m-3 rounded-xl transition border-slate-300 hover:border-slate-400 hover:bg-slate-50 dark:border-surface-400 dark:hover:border-surface-300 dark:hover:bg-surface-400"
            >
              <div className="mb-3 h-12 w-12 rounded-full bg-slate-100 dark:bg-surface-400 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-slate-400 dark:text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <p className="mb-1 font-medium text-slate-900 dark:text-slate-100">
                Upload document
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-xs">
                Drag & drop or click to browse · PDF, Word, Excel, PowerPoint · max 10MB
              </p>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 bg-white/90 dark:bg-surface-500/90 backdrop-blur-sm flex items-center justify-center">
              <div className="w-full max-w-sm rounded-xl bg-white dark:bg-surface-600 p-4 shadow-md">
                <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
                  {uploadProgress >= 100 ? "Processing..." : "Uploading..."}
                </p>
                <UploadProgress value={uploadProgress} />
              </div>
            </div>
          )}

          {isPreviewLoading && (
            <div className="absolute inset-0 bg-white/80 dark:bg-surface-500/80 backdrop-blur-sm flex items-center justify-center">
              <InlineSpinner className="h-8 w-8 border-2" />
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
            className="sr-only"
            onChange={onFileSelect}
          />
        </div>
      </div>

      {/* Modal */}
      {modal && signedPreviewUrl && (
        <PreviewModal
          url={signedPreviewUrl}
          filename={originalFilename}
          onClose={() => setModal(false)}
        />
      )}
    </div>
  );
};

export default DocumentPreviewPanel;
