import React, { useState } from "react";
import type { DocumentTemplate } from "../../services/templates";
import { templateFileTypeLabel, downloadTemplate } from "../../services/templates";
import { getAuthUser } from "../../lib/auth";
import { isAdmin } from "../../lib/roleFilters";
import { useToast } from "../ui/toast/ToastContext";

type Props = {
  template: DocumentTemplate;
  onSelect: (t: DocumentTemplate) => void;
  onDeleteClick: (id: number) => void;
  isDeleting: boolean;
  adminDebugMode?: boolean;
};

const TemplateGridCard: React.FC<Props> = ({
  template,
  onSelect,
  onDeleteClick,
  isDeleting,
  adminDebugMode,
}) => {
  const { push } = useToast();
  const me = getAuthUser();
  const userRole = me?.role ?? "";
  const isAdminUser = isAdmin(userRole as any);

  const canDeleteActual = template.can_delete && (!isAdminUser || adminDebugMode);
  const [downloading, setDownloading] = useState(false);
  const [imgError, setImgError] = useState(false);

  const typeLabel = templateFileTypeLabel(template.mime_type);

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
      <div
        className="relative w-full bg-white overflow-hidden"
        style={{ height: "200px" }}
      >
        {template.thumbnail_url && !imgError ? (
          <img
            src={template.thumbnail_url}
            alt={template.name}
            className="absolute top-0 left-0 w-full origin-top"
            style={{ transform: "scale(1.4)", transformOrigin: "top center" }}
            onError={() => setImgError(true)}
          />
        ) : (
          /* Fallback — clean document placeholder */
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
            <div className="flex flex-col items-center justify-center w-14 h-16 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400  relative">
              {/* Folded corner */}
              <div className="absolute top-0 right-0 w-3 h-3 border-l border-b border-slate-200 dark:border-surface-300 bg-slate-50 dark:bg-surface-500 rounded-bl-sm" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mt-1">
                {typeLabel}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center truncate w-full px-2">
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
            className="rounded-md bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-white transition disabled:opacity-50 shadow"
          >
            {downloading ? "Downloading…" : "Download"}
          </button>
          {canDeleteActual && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteClick(template.id);
              }}
              disabled={isDeleting}
              className="rounded-md bg-rose-500/90 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 transition disabled:opacity-50 shadow"
            >
              {isDeleting ? "…" : "Delete"}
            </button>
          )}
        </div>

        {/* File type badge — top left */}
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
            {typeLabel}
          </span>
        </div>

        {/* Global/office badge — top right */}
        <div className="absolute top-2 right-2">
          {template.is_global ? (
            <span className="inline-flex items-center rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
              Global
            </span>
          ) : template.office ? (
            <span className="inline-flex items-center rounded bg-black/40 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
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
          <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
            {template.description}
          </p>
        )}
        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
          {template.file_size_label}
          {template.uploaded_by ? ` · ${template.uploaded_by.name}` : ""}
        </p>
        {(template.tags ?? []).length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {template.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-xs font-medium text-slate-500 dark:text-slate-300"
              >
                {tag}
              </span>
            ))}
            {template.tags.length > 3 && (
              <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-xs text-slate-400 dark:text-slate-500">
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
