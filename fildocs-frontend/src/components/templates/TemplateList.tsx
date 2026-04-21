import React from "react";
import type { DocumentTemplate } from "../../services/templates";
import {
  templateFileTypeLabel,
  downloadTemplate,
} from "../../services/templates";
import Table, { type TableColumn } from "../ui/Table";
import { Download, Trash2 } from "lucide-react";
import { useToast } from "../ui/toast/ToastContext";
import MiddleTruncate from "../ui/MiddleTruncate";
import { getAuthUser } from "../../lib/auth";
import { isAdmin } from "../../lib/roleFilters";

import type { SortDir } from "../ui/Table";

type Props = {
  templates: DocumentTemplate[];
  loading: boolean;
  deletingId: number | null;
  onDeleteClick: (id: number) => void;
  onSelect: (template: DocumentTemplate) => void;
  sortBy?: string;
  sortDir?: SortDir;
  onSortChange?: (key: string, dir: SortDir) => void;
  adminDebugMode?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string | number>;
  onToggleRow?: (id: string | number) => void;
  onToggleAll?: () => void;
};

// ── Action cell — isolated so download state is per-row ───────────────────
const TemplateActions: React.FC<{
  template: DocumentTemplate;
  isDeleting: boolean;
  onDeleteClick: (id: number) => void;
  adminDebugMode?: boolean;
}> = ({ template, isDeleting, onDeleteClick, adminDebugMode }) => {
  const { push } = useToast();
  const me = getAuthUser();
  const userRole = me?.role ?? "";
  const isAdminUser = isAdmin(userRole as any);

  const canDeleteActual = template.can_delete && (!isAdminUser || adminDebugMode);
  const [downloading, setDownloading] = React.useState(false);

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDownloading(true);
    try {
      await downloadTemplate(template.id, template.original_filename);
    } catch (err: any) {
      push({
        type: "error",
        title: "Download failed",
        message: err?.message ?? "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-1 justify-end">
      <button
        type="button"
        disabled={downloading}
        onClick={handleDownload}
        title="Download"
        className="cursor-pointer inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-surface-400 bg-transparent p-1.5 text-slate-500 dark:text-slate-400 transition hover:bg-slate-50 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
      >
        {downloading ? (
          <span className="h-3.5 w-3.5 inline-block animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
      </button>
      {canDeleteActual && (
        <button
          type="button"
          disabled={isDeleting}
          onClick={(e) => {
            e.stopPropagation();
            onDeleteClick(template.id);
          }}
          title="Delete"
          className="cursor-pointer inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-surface-400 bg-transparent p-1.5 text-rose-500 dark:text-rose-400 transition hover:border-rose-300 hover:bg-rose-50 dark:hover:border-rose-800 dark:hover:bg-rose-950/30 disabled:opacity-50"
        >
          {isDeleting ? (
            <span className="h-3.5 w-3.5 inline-block animate-spin rounded-full border-2 border-rose-300 border-t-rose-600" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
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
  sortBy,
  sortDir,
  onSortChange,
  adminDebugMode,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
}) => {
  const columns: TableColumn<DocumentTemplate>[] = React.useMemo(
    () => [
      {
        key: "type",
        header: "TYPE",
        skeletonShape: "badge",
        sortKey: "mime_type",
        render: (t) => {
          const label = templateFileTypeLabel(t.mime_type);
          return (
            <span className="inline-flex items-center rounded bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {label}
            </span>
          );
        },
      },
      {
        key: "name",
        header: "TEMPLATE",
        skeletonShape: "double",
        sortKey: "name",
        render: (t) => (
          <div className="min-w-0">
            <MiddleTruncate 
              text={t.name}
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors"
            />
            {t.description && (
              <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">
                {t.description}
              </p>
            )}
            {(t.tags ?? []).length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {t.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1.5 text-[10px] text-slate-400 dark:text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
                {t.tags.length > 3 && (
                  <span className="text-[10px] text-slate-400">
                    +{t.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "scope",
        header: "SCOPE",
        skeletonShape: "badge",
        render: (t) =>
          t.is_global ? (
            <span className="inline-flex items-center rounded bg-sky-50 dark:bg-sky-950/30 px-1.5 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400">
              Global
            </span>
          ) : t.office ? (
            <span className="inline-flex items-center rounded bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              {t.office.code}
            </span>
          ) : (
            <span className="text-xs text-slate-400">—</span>
          ),
      },
      {
        key: "size",
        header: "SIZE",
        skeletonShape: "narrow",
        sortKey: "file_size",
        render: (t) => (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            {t.file_size_label}
          </span>
        ),
      },
      {
        key: "uploaded_by",
        header: "UPLOADED BY",
        skeletonShape: "text",
        render: (t) => (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {t.uploaded_by?.name ?? "—"}
          </span>
        ),
      },
      {
        key: "date",
        header: "DATE",
        skeletonShape: "narrow",
        sortKey: "created_at",
        render: (t) => (
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            {new Date(t.created_at).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "actions",
        header: "ACTIONS",
        align: "right",
        render: (t) => (
          <TemplateActions
            template={t}
            isDeleting={deletingId === t.id}
            onDeleteClick={onDeleteClick}
            adminDebugMode={adminDebugMode}
          />
        ),
      },
    ],
    [deletingId, onDeleteClick, adminDebugMode],
  );

  return (
    <Table<DocumentTemplate>
      bare
      columns={columns}
      rows={templates}
      rowKey={(t) => t.id}
      initialLoading={loading}
      loading={false}
      onRowClick={onSelect}
      emptyMessage="No templates match your filters."
      mobileRender={(t) => (
        <div className="px-4 py-3 bg-transparent border-b border-slate-100 dark:border-surface-400">
          <div className="flex items-center justify-between mb-1.5">
            <span className="rounded bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              {templateFileTypeLabel(t.mime_type)}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(t.created_at).toLocaleDateString()}
            </span>
          </div>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate mb-0.5">
                {t.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {t.file_size_label} • {t.uploaded_by?.name || "—"}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-1">
              <TemplateActions
                template={t}
                isDeleting={deletingId === t.id}
                onDeleteClick={onDeleteClick}
                adminDebugMode={adminDebugMode}
              />
            </div>
          </div>
        </div>
      )}
      gridTemplateColumns="80px minmax(200px, 1fr) 90px 100px 180px 110px 100px"
      className="h-full"
      sortBy={sortBy}
      sortDir={sortDir}
      onSortChange={onSortChange}
      selectable={selectable}
      selectedIds={selectedIds}
      onToggleRow={onToggleRow}
      onToggleAll={onToggleAll}
    />
  );
};

export default TemplateList;
