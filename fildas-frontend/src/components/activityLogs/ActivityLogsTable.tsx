import React from "react";
import Table, { type TableColumn } from "../ui/Table";
import MiddleTruncate from "../ui/MiddleTruncate";
import { friendlyEvent } from "../../utils/activityFormatters";
import { formatDateTime } from "../../utils/formatters";
import type { ActivityLogItem } from "../../services/types";

interface Props {
  rows: ActivityLogItem[];
  loading: boolean;
  initialLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  onRowClick: (row: ActivityLogItem) => void;
  error: string | null;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSortChange: (key: string, dir: "asc" | "desc") => void;
}

const ActivityLogsTable: React.FC<Props> = ({
  rows,
  loading,
  initialLoading,
  hasMore,
  onLoadMore,
  onRowClick,
  error,
  sortBy,
  sortDir,
  onSortChange,
}) => {
  const columns: TableColumn<ActivityLogItem>[] = [
    {
      key: "when",
      header: "When",
      skeletonShape: "narrow",
      sortKey: "created_at",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-slate-500 dark:text-slate-400">
          {formatDateTime(r.created_at)}
        </span>
      ),
    },
    {
      key: "event",
      header: "Event",
      skeletonShape: "text",
      sortKey: "event",
      render: (r) => (
        <MiddleTruncate
          text={friendlyEvent(r.event)}
          className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors"
        />
      ),
    },
    {
      key: "label",
      header: "Label",
      skeletonShape: "text",
      sortKey: "label",
      render: (r) => (
        <MiddleTruncate
          text={r.label ?? "—"}
          className="text-xs text-slate-500 dark:text-slate-400"
        />
      ),
    },
    {
      key: "actor",
      header: "Actor",
      skeletonShape: "double",
      render: (r) => (
        <div className="flex flex-col min-w-0 py-0.5">
          <MiddleTruncate
            text={r.actor_user?.full_name ?? r.actor_user?.name ?? "—"}
            className="text-xs font-medium text-slate-800 dark:text-slate-200"
          />
          {r.actor_office && (
            <MiddleTruncate
              text={r.actor_office.name}
              className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight"
            />
          )}
        </div>
      ),
    },
    {
      key: "doc",
      header: "Doc",
      skeletonShape: "text",
      render: (r) => (
        <MiddleTruncate
          text={r.document?.title ?? (r.document_id ? `#${r.document_id}` : "—")}
          className="text-xs text-slate-500 dark:text-slate-400"
        />
      ),
    },
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden flex-1 min-h-0">
      <Table
        bare
        className="h-full"
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowClick={onRowClick}
        loading={loading}
        initialLoading={initialLoading}
        error={error}
        emptyMessage="No logs found."
        hasMore={hasMore}
        onLoadMore={onLoadMore}
        mobileRender={(r) => (
          <div className="px-4 py-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wide">
                {friendlyEvent(r.event)}
              </span>
              <span className="text-[10px] text-slate-400 tabular-nums">
                {formatDateTime(r.created_at)}
              </span>
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
              {r.actor_user?.full_name ?? r.actor_user?.name ?? "—"}
            </p>
            <div className="flex items-center justify-between gap-4 overflow-hidden">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {r.actor_office?.name || "No office"}
              </p>
              {r.document?.title && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate shrink-0 max-w-[40%]">
                  {r.document.title}
                </p>
              )}
            </div>
          </div>
        )}
        gridTemplateColumns="12rem minmax(140px, 1.2fr) minmax(120px, 1fr) 12rem 10rem"
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={onSortChange}
      />
    </div>
  );
};

export default ActivityLogsTable;
