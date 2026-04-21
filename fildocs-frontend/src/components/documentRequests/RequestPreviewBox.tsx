// import React from "react";
import { Download, Maximize2 } from "lucide-react";

type Props = {
  url: string;
  loading: boolean;
  error: string | null;
  filename?: string | null;
  emptyLabel?: string;
  onViewModal?: () => void;
  onDownload?: () => void;
};

export default function RequestPreviewBox({
  url,
  loading,
  error,
  filename,
  emptyLabel,
  onViewModal,
  onDownload,
}: Props) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500">
      <div className="shrink-0 flex items-center justify-between border-b border-slate-100 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 pl-4 pr-2 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 shrink-0 uppercase tracking-wide">
            Preview
          </span>
          {filename && (
            <span className="text-xs text-slate-600 dark:text-slate-300 truncate max-w-50 sm:max-w-md">
              {filename}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {onDownload && (
            <button
              onClick={onDownload}
              title="Download file"
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-500 transition-colors"
            >
              <Download size={13} />
            </button>
          )}
          {onViewModal && url && (
            <button
              onClick={onViewModal}
              title="Full screen view"
              className="p-1.5 rounded text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-500 transition-colors"
            >
              <Maximize2 size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 min-h-0 bg-white dark:bg-surface-600">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
            <div className="h-4 w-4 rounded-full border-2 border-slate-300 border-t-slate-600 dark:border-surface-400 dark:border-t-slate-300 animate-spin" />
            Loading preview…
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-sm text-red-500 dark:text-red-400 px-4 text-center">
            {error}
          </div>
        ) : url ? (
          <iframe title="preview" src={url} className="h-full w-full" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
            {emptyLabel ?? "No preview available."}
          </div>
        )}
      </div>
    </div>
  );
}
