import { FileText, FileCheck } from "lucide-react";
import RequestPreviewBox from "./RequestPreviewBox";
import { downloadTemplate } from "../../services/templates";
import { getDocumentRequestExampleDownloadLink, getDocumentRequestItemExampleDownloadLink } from "../../services/documentRequests";

type Props = {
  req: any;
  examplePreviewUrl: string;
  examplePreviewLoading: boolean;
  examplePreviewError: string | null;
  onViewModal: () => void;
};

export default function RequestExampleTab({
  req,
  examplePreviewUrl,
  examplePreviewLoading,
  examplePreviewError,
  onViewModal,
}: Props) {
  const isTemplate = !!req.template;
  const fileName = isTemplate ? req.template.name : (req.example_original_filename ?? "Attached file");
  const hasExample = !!(req.example_file_path || isTemplate);

  const handleDownload = async () => {
    if (isTemplate) {
      await downloadTemplate(req.template.id, req.template.original_filename);
    } else if (req.example_file_path) {
      try {
        // req.id might be a request ID or an item ID depending on context
        // The props passed to this tab usually distinguish them, but we can check if it's an item
        const isItem = !!req.request_id; // items have request_id
        const { url } = isItem 
          ? await getDocumentRequestItemExampleDownloadLink(req.id)
          : await getDocumentRequestExampleDownloadLink(req.id);
        
        window.open(url, "_blank");
      } catch (err) {
        console.error("Download failed", err);
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <div className="shrink-0 flex items-center gap-3 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-5 py-4">
        {isTemplate ? (
          <FileCheck size={14} className="text-emerald-500 shrink-0" />
        ) : (
          <FileText size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
        )}
        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate flex-1">
          {isTemplate ? `Template: ${fileName}` : fileName}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 uppercase tracking-widest font-medium">
          {isTemplate ? "System Template" : "Reference"}
        </span>
      </div>
      <RequestPreviewBox
        url={examplePreviewUrl}
        loading={examplePreviewLoading}
        error={examplePreviewError}
        filename={fileName}
        onDownload={hasExample ? handleDownload : undefined}
        emptyLabel={
          hasExample
            ? "Preview not available for this file type."
            : "No example file attached."
        }
        onViewModal={examplePreviewUrl ? onViewModal : undefined}
      />
    </div>
  );
}
