// import React from "react";
import { FileText } from "lucide-react";
import RequestPreviewBox from "./RequestPreviewBox";

type Props = {
  req: any;
  examplePreviewUrl: string;
  examplePreviewLoading: boolean;
  examplePreviewError: string | null;
  onRefresh: () => void;
  onViewModal: () => void;
};

export default function RequestExampleTab({
  req,
  examplePreviewUrl,
  examplePreviewLoading,
  examplePreviewError,
  onRefresh,
  onViewModal,
}: Props) {
  return (
    <>
      <div className="shrink-0 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-surface-400 dark:bg-surface-600">
        <FileText size={13} className="text-slate-400 shrink-0" />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate flex-1">
          {req.example_original_filename ??
            (req.example_file_path ? "Attached" : "No example file")}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 shrink-0">
          Reference
        </span>
      </div>
      <RequestPreviewBox
        url={examplePreviewUrl}
        loading={examplePreviewLoading}
        error={examplePreviewError}
        filename={req.example_original_filename}
        emptyLabel={
          req.example_file_path
            ? "Preview not available for this file type."
            : "No example file attached."
        }
        onRefresh={req.example_preview_path ? onRefresh : undefined}
        onViewModal={examplePreviewUrl ? onViewModal : undefined}
      />
    </>
  );
}
