import React from "react";
import { Download, XCircle } from "lucide-react";

type Props = {
  url: string;
  filename?: string;
  onClose: () => void;
};

export default function RequestPreviewModal({ url, filename, onClose }: Props) {
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
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
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-surface-400 dark:bg-surface-600">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate max-w-[70%]">
            {filename ?? "Preview"}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(url, "_blank")}
              className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition dark:border-surface-400 dark:bg-surface-500 dark:text-slate-300"
            >
              <Download size={12} /> Download
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition dark:hover:bg-surface-400 dark:hover:text-slate-200"
            >
              <XCircle size={14} />
            </button>
          </div>
        </div>
        <iframe
          title="Full preview"
          src={url}
          className="flex-1 min-h-0 w-full bg-white dark:bg-surface-600"
        />
      </div>
    </div>
  );
}
