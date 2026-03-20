import React from "react";
import type { DocumentTemplate } from "../../services/templates";
import {
  templateFileTypeLabel,
  templateFileTypeColor,
  downloadTemplate,
} from "../../services/templates";
import Table, { type TableColumn } from "../ui/Table";
import { useToast } from "../ui/toast/ToastContext";

type Props = {
  templates: DocumentTemplate[];
  loading: boolean;
  deletingId: number | null;
  onDeleteClick: (id: number) => void;
  onSelect: (template: DocumentTemplate) => void;
};

// ── Action cell — isolated so download state is per-row ───────────────────
const TemplateActions: React.FC<{
  template: DocumentTemplate;
  isDeleting: boolean;
  onDeleteClick: (id: number) => void;
}> = ({ template, isDeleting, onDeleteClick }) => {
  const { push } = useToast();
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadTemplate(template.id, template.original_filename);
    } catch (err: any) {
      push({ type: "error", title: "Download failed", message: err?.message ?? "Unknown error" });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1.5 justify-end">
      <button
        type="button"
        disabled={downloading}
        onClick={handleDownload}
        className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50"
      >
        {downloading ? "…" : "↓ Download"}
      </button>
      {template.can_delete && (
        <button
          type="button"
          disabled={isDeleting}
          onClick={(e) => { e.stopPropagation(); onDeleteClick(template.id); }}
          className="cursor-pointer inline-flex items-center rounded-md border border-rose-200 dark:border-rose-800 bg-white dark:bg-surface-600 px-2.5 py-1 text-xs font-medium text-rose-600 dark:text-rose-400 transition hover:bg-rose-50 dark:hover:bg-rose-950/30 disabled:opacity-50"
        >
          {isDeleting ? "…" : "Delete"}
        </button>
      )}
    </div>
  );
};

// ── List view using shared Table component ─────────────────────────────────
const TemplateList: React.FC<Props> = ({
  templates,
  loading,
  deletingId,
  onDeleteClick,
  onSelect,
}) => {
  const columns: TableColumn<DocumentTemplate>[] = React.useMemo(
    () => [
      {
        key: "type",
        header: "Type",
        render: (t) => {
          const label = templateFileTypeLabel(t.mime_type);
          const color = templateFileTypeColor(t.mime_type);
          return (
            <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-wide ${color}`}>
              {label}
            </span>
          );
        },
      },
      {
        key: "name",
        header: "Template",
        render: (t) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {t.name}
            </p>
            {t.description && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {t.description}
              </p>
            )}
            {(t.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {t.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                    {tag}
                  </span>
                ))}
                {t.tags.length > 3 && (
                  <span className="text-[10px] text-slate-400">+{t.tags.length - 3}</span>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "scope",
        header: "Scope",
        render: (t) =>
          t.is_global ? (
            <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-[10px] font-medium text-violet-700 dark:text-violet-400">
              Global
            </span>
          ) : t.office ? (
            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-surface-400 border border-slate-200 dark:border-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
              {t.office.code}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
      {
        key: "size",
        header: "Size",
        render: (t) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">{t.file_size_label}</span>
        ),
      },
      {
        key: "uploaded_by",
        header: "Uploaded by",
        render: (t) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {t.uploaded_by?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        render: (t) => (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {new Date(t.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "actions",
        header: "",
        align: "right",
        render: (t) => (
          <TemplateActions
            template={t}
            isDeleting={deletingId === t.id}
            onDeleteClick={onDeleteClick}
          />
        ),
      },
    ],
    [deletingId, onDeleteClick],
  );

  return (
    <Table<DocumentTemplate>
      columns={columns}
      rows={templates}
      rowKey={(t) => t.id}
      initialLoading={loading}
      loading={false}
      onRowClick={onSelect}
      emptyMessage="No templates match your filters."
      gridTemplateColumns="auto 1fr auto auto auto auto auto"
    />
  );
};

export default TemplateList;
