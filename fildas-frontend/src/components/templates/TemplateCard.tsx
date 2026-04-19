import React from "react";
import type { DocumentTemplate } from "../../services/templates";
import {
  templateFileTypeLabel,
  templateFileTypeColor,
  downloadTemplate,
} from "../../services/templates";
import { useToast } from "../ui/toast/ToastContext";

type Props = {
  template: DocumentTemplate;
  onDeleted: (id: number) => void;
  isDeleting: boolean;
  onDeleteClick: (id: number) => void;
  onSelect: (template: DocumentTemplate) => void;
};

const TemplateCard: React.FC<Props> = ({
  template,
  isDeleting,
  onDeleteClick,
  onSelect,
}) => {
  const { push } = useToast();
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadTemplate(template.id, template.original_filename);
    } catch (e: any) {
      push({
        type: "error",
        title: "Download failed",
        message: e?.message ?? "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  const typeLabel = templateFileTypeLabel(template.mime_type);
  const typeColor = templateFileTypeColor(template.mime_type);

  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3 transition hover: hover:border-sky-300 dark:hover:border-sky-700 cursor-pointer"
      onClick={() => onSelect(template)}
    >
      {/* File type badge */}
      <div className="shrink-0 pt-0.5">
        <span
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${typeColor}`}
        >
          {typeLabel}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {template.name}
          </p>

          {template.is_global ? (
            <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400">
              Global
            </span>
          ) : template.office ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-surface-400 border border-slate-200 dark:border-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
              {template.office.code}
            </span>
          ) : null}
        </div>

        {template.description && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
            {template.description}
          </p>
        )}

        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-400 dark:text-slate-500">
          <span>{template.original_filename}</span>
          <span>{template.file_size_label}</span>
          {template.uploaded_by && <span>by {template.uploaded_by.name}</span>}
          <span>{new Date(template.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          disabled={downloading}
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50"
        >
          {downloading ? "…" : "↓ Download"}
        </button>

        {template.can_delete && (
          <button
            type="button"
            disabled={isDeleting}
            onClick={(e) => {
              e.stopPropagation();
              onDeleteClick(template.id);
            }}
            className="inline-flex items-center rounded-md border border-rose-200 dark:border-rose-800 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50"
          >
            {isDeleting ? "…" : "Delete"}
          </button>
        )}
      </div>
    </div>
  );
};

export default TemplateCard;
