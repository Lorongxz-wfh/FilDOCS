import React, { useState } from "react";
import type { DocumentTemplate } from "../../services/templates";
import {
  templateFileTypeLabel,
  templateFileTypeColor,
  downloadTemplate,
} from "../../services/templates";
import { useToast } from "../ui/toast/ToastContext";

type Props = {
  template: DocumentTemplate;
  onSelect: (t: DocumentTemplate) => void;
  onDeleteClick: (id: number) => void;
  isDeleting: boolean;
};

const TemplateGridCard: React.FC<Props> = ({
  template,
  onSelect,
  onDeleteClick,
  isDeleting,
}) => {
  const { push } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const typeLabel = templateFileTypeLabel(template.mime_type);
  const typeColor = templateFileTypeColor(template.mime_type);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadTemplate(template.id, template.original_filename);
    } catch (err: any) {
      push({ type: "error", title: "Download failed", message: err?.message });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      onClick={() => onSelect(template)}
      className="group relative flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden cursor-pointer transition hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-md"
    >
      {/* Thumbnail area */}
      <div className="relative aspect-3/4 w-full bg-slate-50 dark:bg-surface-600 overflow-hidden">
        {template.thumbnail_url && !imgError ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="h-full w-full object-cover object-top"
            onError={() => setImgError(true)}
          />
        ) : (
          /* Fallback — styled placeholder */
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4">
            <span
              className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-bold tracking-wide ${typeColor}`}
            >
              {typeLabel}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500 text-center truncate w-full px-2">
              {template.original_filename}
            </span>
          </div>
        )}

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-center pb-3 gap-2 opacity-0 group-hover:opacity-100">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-lg bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white transition disabled:opacity-50 shadow"
          >
            {downloading ? "…" : "↓ Download"}
          </button>
          {template.can_delete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(template.id);
              }}
              disabled={isDeleting}
              className="rounded-lg bg-rose-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 transition disabled:opacity-50 shadow"
            >
              {isDeleting ? "…" : "Delete"}
            </button>
          )}
        </div>

        {/* File type badge — top left */}
        <div className="absolute top-2 left-2">
          <span
            className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold tracking-wide shadow-sm ${typeColor}`}
          >
            {typeLabel}
          </span>
        </div>

        {/* Global/office badge — top right */}
        <div className="absolute top-2 right-2">
          {template.is_global ? (
            <span className="inline-flex items-center rounded-full bg-violet-50/90 dark:bg-violet-950/70 border border-violet-200 dark:border-violet-800 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400 shadow-sm">
              Global
            </span>
          ) : template.office ? (
            <span className="inline-flex items-center rounded-full bg-white/90 dark:bg-surface-500/90 border border-slate-200 dark:border-surface-400 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300 shadow-sm">
              {template.office.code}
            </span>
          ) : null}
        </div>
      </div>

      {/* Card footer */}
      <div className="p-3 border-t border-slate-100 dark:border-surface-400">
        <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate leading-snug">
          {template.name}
        </p>
        {template.description && (
          <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500 truncate">
            {template.description}
          </p>
        )}
        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
          {template.file_size_label}
          {template.uploaded_by ? ` · ${template.uploaded_by.name}` : ""}
        </p>
        {(template.tags ?? []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                +{template.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplateGridCard;
