import React from "react";
import { Share2 } from "lucide-react";
import type { TableColumn } from "../../components/ui/Table";
import type { Document } from "../../services/documents";
import { formatDate } from "../../utils/formatters";
import { TypeBadge, ModeBadge, SourceBadge } from "./DocumentLibraryBadges";
import { StatusBadge } from "../../components/ui/Badge";
import type { LibraryItem } from "./documentLibraryTypes";

// ── DocTitle cell ─────────────────────────────────────────────────────────────
function DocTitle({ doc }: { doc: Document }) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
        {doc.title}
      </div>
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        {doc.code && (
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {doc.code}
          </span>
        )}
        {(doc as any).ownerOffice && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {(doc as any).ownerOffice.name}
          </span>
        )}
        {Array.isArray((doc as any).tags) && (doc as any).tags.length > 0 && (
          <div className="flex items-center gap-1">
            {(doc as any).tags.slice(0, 2).map((t: any) => {
              const name = typeof t === "string" ? t : t.name;
              return (
                <span
                  key={name}
                  className="rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1.5 py-0 text-[10px] text-slate-400 dark:text-slate-500"
                >
                  {name}
                </span>
              );
            })}
            {(doc as any).tags.length > 2 && (
              <span className="text-[10px] text-slate-400">
                +{(doc as any).tags.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ShareCell ─────────────────────────────────────────────────────────────────
const ShareCell: React.FC<{
  doc: Document;
  canShare: boolean;
  onShare: (id: number) => void;
}> = ({ doc, canShare, onShare }) => {
  if (!canShare) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onShare(doc.id);
      }}
      className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition cursor-pointer"
    >
      <Share2 className="h-2.5 w-2.5" />
      Share
    </button>
  );
};

// ── Column builders ───────────────────────────────────────────────────────────

export function buildBaseDocColumns(): TableColumn<Document>[] {
  return [
    {
      key: "type",
      header: "Type",
      skeletonShape: "badge",
      render: (doc) => <TypeBadge type={doc.doctype} />,
    },
    {
      key: "document",
      header: "Document",
      skeletonShape: "double",
      sortKey: "title",
      render: (doc) => <DocTitle doc={doc} />,
    },
    {
      key: "version",
      header: "Ver.",
      skeletonShape: "badge",
      align: "center" as const,
      render: (doc) => (
       <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
            v{doc.version_number}
          </span>
      ),
    },
    {
      key: "effective_date",
      header: "Effective",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {doc.effective_date ? (
            formatDate(doc.effective_date)
          ) : (
            <span className="text-slate-300 dark:text-slate-600">—</span>
          )}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      skeletonShape: "narrow",
      sortKey: "created_at",
      render: (doc) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {formatDate(doc.created_at)}
        </span>
      ),
    },
  ];
}

export function buildSharedColumns(
  canShare: boolean,
  onShare: (id: number) => void,
): TableColumn<Document>[] {
  const base = buildBaseDocColumns();
  if (!canShare) return base;
  return [
    ...base,
    {
      key: "actions",
      header: "",
      align: "right" as const,
      render: (doc) => (
        <ShareCell doc={doc} canShare={canShare} onShare={onShare} />
      ),
    },
  ];
}

export function buildRequestedColumns(isQaAdmin: boolean): TableColumn<any>[] {
  const cols: TableColumn<any>[] = [
    {
      key: "mode",
      header: "Type",
      skeletonShape: "badge",
      render: (r) => <ModeBadge mode={r.batch_mode} />,
    },
    {
      key: "request",
      header: "Request",
      skeletonShape: "double",
      sortKey: "title",
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {r.item_title ?? r.batch_title}
          </div>
          {r.item_title && (
            <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {r.batch_title}
            </div>
          )}
        </div>
      ),
    },
  ];

  if (isQaAdmin) {
    cols.push({
      key: "office",
      header: "Office",
      render: (r) => (
        <div className="min-w-0">
          <div className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {r.office_name ?? "—"}
          </div>
          {r.office_code && (
            <div className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
              {r.office_code}
            </div>
          )}
        </div>
      ),
    });
  }

  cols.push(
    {
      key: "status",
      header: "Status",
      skeletonShape: "badge",
      render: () => <StatusBadge status="Accepted" />,
    },
    {
      key: "date",
      header: "Date",
      skeletonShape: "narrow",
      sortKey: "created_at",
      render: (r) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {formatDate(r.created_at)}
        </span>
      ),
    },
  );

  return cols;
}

export function buildAllColumns(): TableColumn<LibraryItem>[] {
  return [
    {
      key: "source",
      header: "Source",
      skeletonShape: "badge",
      render: (item) => <SourceBadge source={item.source} />,
    },
    {
      key: "title",
      header: "Title",
      skeletonShape: "double",
      sortKey: "title",
      render: (item) => (
        <div className="min-w-0">
          <div className="font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
            {item.title}
          </div>
          {item.subtitle && (
            <div className="font-mono text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
              {item.subtitle}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      skeletonShape: "badge",
      render: (item) =>
        item.doctype ? (
          <TypeBadge type={item.doctype} />
        ) : item.mode ? (
          <ModeBadge mode={item.mode} />
        ) : null,
    },
    {
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (item) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {item.office ?? "—"}
        </span>
      ),
    },
    {
      key: "meta",
      header: "Ver. / Status",
      skeletonShape: "badge",
      render: (item) =>
        item.version != null ? (
          <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">
            v{item.version}
          </span>
        ) : (
          <StatusBadge status="Accepted" />
        ),
    },
    {
      key: "date",
      header: "Date",
      skeletonShape: "narrow",
      sortKey: "created_at",
      render: (item) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {formatDate(item.date)}
        </span>
      ),
    },
  ];
}

export function buildArchiveColumns(): TableColumn<Document>[] {
  return [
    {
      key: "type",
      header: "Type",
      skeletonShape: "badge",
      render: (doc) => <TypeBadge type={doc.doctype} />,
    },
    {
      key: "document",
      header: "Document",
      skeletonShape: "double",
      sortKey: "title",
      render: (doc) => <DocTitle doc={doc} />,
    },
    {
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (doc) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
          {(doc as any).ownerOffice?.name ?? "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      skeletonShape: "badge",
      render: (doc) => (
        <StatusBadge status={(doc as any).latestVersion?.status ?? "Cancelled"} />
      ),
    },
    {
      key: "archived_on",
      header: "Archived On",
      skeletonShape: "narrow",
      sortKey: "updated_at",
      render: (doc) => (
        <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {doc.updated_at ? formatDate(doc.updated_at) : "—"}
        </span>
      ),
    },
  ];
}
