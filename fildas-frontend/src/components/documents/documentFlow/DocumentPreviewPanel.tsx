import React from "react";
import UploadProgress from "../../ui/loader/UploadProgress";
import { Download, Maximize2, RotateCcw, Upload, X, FileX, Loader2 } from "lucide-react";

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
  checksum?: string | null;
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
  // checksum,
}) => {
  const hasPreview = !!filePath && !!previewPath;
  const isProcessing = !!filePath && !previewPath;
  const isError = filePath && !previewPath && !isProcessing;

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
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 shadow-sm">
        {/* Toolbar - Command Center Style */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-2.5 backdrop-blur-sm dark:border-surface-400 dark:bg-surface-600/80">
          <div className="flex items-center gap-3 min-w-0">
            {/* Status Pill */}
            {hasPreview && signedPreviewUrl ? (
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-600 border border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Ready
              </div>
            ) : isProcessing ? (
              <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 border border-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                Optimizing
              </div>
            ) : isError ? (
              <div className="flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-600 border border-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
                Error
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border border-slate-200 dark:bg-surface-400 dark:text-slate-400 dark:border-surface-300">
                Idle
              </div>
            )}

            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Preview
              </span>
              {originalFilename && (
                <>
                  <span className="text-slate-300 dark:text-slate-600">·</span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400 max-w-[120px]">
                    {originalFilename}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isActiveApprover && onApproverDownload && (
              <button
                type="button"
                onClick={onApproverDownload}
                title="Download for signing"
                className="group flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-300 hover:text-brand-600 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-400 dark:hover:border-brand-500/50 dark:hover:text-brand-400"
              >
                <Download size={14} className="group-active:scale-90 transition-transform" />
              </button>
            )}
            {isActiveApprover && onApproverUpload && (
              <button
                type="button"
                onClick={onApproverUpload}
                title="Upload signed copy"
                disabled={isUploading}
                className="group flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-300 hover:text-brand-600 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-400 dark:hover:border-brand-500/50 dark:hover:text-brand-400"
              >
                <Upload size={14} className="group-active:scale-90 transition-transform" />
              </button>
            )}
            {hasPreview && onReloadPreview && (
              <button
                type="button"
                onClick={onReloadPreview}
                title="Reload preview"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-500 dark:hover:bg-surface-400 dark:hover:text-slate-200"
              >
                <RotateCcw size={13} />
              </button>
            )}
            {hasPreview && (
              <button
                type="button"
                onClick={openModal}
                title="Full Screen"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-500 dark:hover:bg-surface-400 dark:hover:text-slate-200"
              >
                <Maximize2 size={13} />
              </button>
            )}
            <div className="w-px h-4 bg-slate-200 dark:bg-surface-400 mx-1" />
            {canReplace && (
              <button
                type="button"
                disabled={isUploading || isExternalUploading}
                onClick={() => {
                  if (!isUploading && !isExternalUploading) onClickReplace();
                }}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-md transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500"
              >
                {filePath ? <RotateCcw size={12} /> : <Upload size={12} />}
                {filePath ? "Replace" : "Upload"}
              </button>
            )}
          </div>
        </div>

        {/* Preview body */}
        <div
          className={`relative flex-1 min-h-0 w-full overflow-hidden transition-all bg-slate-50 dark:bg-surface-600 ${
            canReplace && !filePath ? "cursor-pointer" : ""
          }`}
          onClick={() => {
            if (isUploading || isExternalUploading) return;
            if (!canReplace) return;
            if (!filePath) onClickReplace();
          }}
          onDrop={(e) => { if (!isExternalUploading) onDrop(e); }}
          onDragOver={(e) => { if (!isExternalUploading) onDragOver(e); }}
          onDragLeave={onDragLeave}
        >
          {hasPreview && signedPreviewUrl ? (
            <div className="h-full w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
              <iframe
                key={`${versionId}-${previewNonce}`}
                src={signedPreviewUrl}
                title="Document preview"
                className="h-full w-full border-0"
                onLoad={() => setIsPreviewLoading(false)}
                onError={() => setIsPreviewLoading(false)}
              />
            </div>
          ) : isProcessing || (filePath && previewPath && !signedPreviewUrl) ? (
            /* Premium Staggered Scanning Skeleton */
            <div className="absolute inset-0 flex flex-col p-8 gap-6 animate-pulse">
              <div className="flex flex-col gap-4">
                <div className="h-6 w-1/3 rounded-md bg-slate-200 dark:bg-surface-400" />
                <div className="h-4 w-full rounded-md bg-slate-100 dark:bg-surface-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="h-32 rounded-lg bg-slate-100 dark:bg-surface-500/50" />
                <div className="h-32 rounded-lg bg-slate-100 dark:bg-surface-500/50" />
              </div>
              <div className="flex flex-col gap-3">
                <div className="h-4 w-5/6 rounded-md bg-slate-100 dark:bg-surface-500" />
                <div className="h-4 w-4/6 rounded-md bg-slate-100 dark:bg-surface-500" />
                <div className="h-4 w-full rounded-md bg-slate-100 dark:bg-surface-500" />
              </div>
              <div className="mt-auto flex flex-col items-center justify-center pb-12">
                <div className="relative flex items-center justify-center mb-4">
                    <Loader2 className="h-8 w-8 text-brand-500 animate-spin" />
                    <div className="absolute inset-0 h-8 w-8 rounded-full border-2 border-brand-500/20" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 animate-pulse">
                  {isProcessing ? "Optimizing Assets..." : "Preparing Viewer..."}
                </p>
              </div>
            </div>
          ) : isError ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center animate-in fade-in duration-300">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 dark:bg-rose-500/10 transition-transform hover:scale-105">
                <FileX className="h-7 w-7 text-rose-500" />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-slate-100">Preview Failed</h4>
              <p className="max-w-[240px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                The preview engine encountered an error. This is often caused by encrypted or malformed files.
              </p>
              {onRegeneratePreview && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onRegeneratePreview(); }}
                  disabled={isRegeneratingPreview}
                  className="mt-6 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:hover:bg-surface-400"
                >
                  <RotateCcw size={12} className={isRegeneratingPreview ? "animate-spin" : ""} />
                  {isRegeneratingPreview ? "Regenerating..." : "Retry Analysis"}
                </button>
              )}
            </div>
          ) : (
            /* Upload Placeholder */
            <div className="group flex h-full flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 m-4 rounded-2xl transition-all hover:border-brand-400 hover:bg-brand-50/30 dark:border-surface-400 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition-all group-hover:scale-110 group-hover:bg-brand-100 group-hover:text-brand-600 dark:bg-surface-400 dark:text-slate-500 dark:group-hover:bg-brand-500/20 dark:group-hover:text-brand-400">
                <Upload size={28} strokeWidth={1.5} />
              </div>
              <h4 className="mb-1 text-sm font-bold text-slate-900 dark:text-slate-100">Attach Document</h4>
              <p className="max-w-[200px] text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Drafts require an attached file to begin the workflow. Drop PDF, Office, or Powerpoint here.
              </p>
            </div>
          )}

          {isUploading && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60 p-6 backdrop-blur-md dark:bg-surface-500/60">
              <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:bg-surface-600">
                <div className="mb-4 flex items-center justify-between">
                   <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                     Document Transfer
                   </p>
                   <span className="text-xs font-mono text-slate-400">{uploadProgress}%</span>
                </div>
                <UploadProgress value={uploadProgress} />
                <p className="mt-4 text-center text-[10px] text-slate-400 uppercase tracking-wide">
                  {uploadProgress >= 100 ? "Finalizing on server..." : "Encrypting and sending..."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Hidden File Picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          className="sr-only"
          onChange={onFileSelect}
        />
      </div>

      {/* Modal View */}
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
