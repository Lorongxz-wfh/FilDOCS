import React from "react";
import { Trash2 } from "lucide-react";
import type { TableColumn } from "../../components/ui/Table";
import type { Document } from "../../services/documents";
import { formatDate } from "../../utils/formatters";
import MiddleTruncate from "../../components/ui/MiddleTruncate";
import type { LibraryItem } from "./documentLibraryTypes";
import { StatusBadge } from "../../components/ui/Badge";

// ── Reusable Cells ────────────────────────────────────────────────────────────

function NormalText({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  const content = typeof children === "object" && children !== null ? (children as any).code || (children as any).name || "—" : children;
  return (
    <span className={`text-xs ${secondary ? "text-slate-500 dark:text-slate-400" : "font-medium text-slate-700 dark:text-slate-100"}`}>
      {content || "—"}
    </span>
  );
}

function TypeText({ type }: { type: string }) {
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
      {type?.toLowerCase() || "—"}
    </span>
  );
}

// ── Column builders ───────────────────────────────────────────────────────────

export function buildCreatedColumns(onDelete?: (id: number) => void): TableColumn<Document>[] {
  const cols: TableColumn<Document>[] = [
    {
      key: "id",
      header: "ID",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
          #{doc.id}
        </span>
      ),
    },
    {
      key: "date_distributed",
      header: "Distributed",
      skeletonShape: "narrow",
      sortKey: "distributed_at",
      align: "left",
      render: (doc) => (
        <NormalText secondary>
          {formatDate(doc.distributed_at || doc.created_at)}
        </NormalText>
      ),
    },
    {
      key: "effective_date",
      header: "Effective Date",
      skeletonShape: "narrow",
      sortKey: "effective_date",
      align: "left",
      render: (doc) => (
        <NormalText secondary>
          {formatDate(doc.effective_date) || "—"}
        </NormalText>
      ),
    },
    {
      key: "title",
      header: "Document Title",
      skeletonShape: "text",
      sortKey: "title",
      render: (doc) => (
        <div className="min-w-0 pr-4">
          <MiddleTruncate 
            text={doc.title}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
          />
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
          {doc.code || "—"}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      skeletonShape: "text",
      render: (doc) => <TypeText type={doc.doctype} />,
    },
    {
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (doc: any) => (
        <NormalText secondary>
          {doc.ownerOffice?.code || doc.office?.code || "—"}
        </NormalText>
      ),
    },
    {
        key: "version",
        header: "Ver.",
        align: "center",
        skeletonShape: "narrow",
        render: (doc) => (
          <NormalText secondary>v{doc.version_number}</NormalText>
        ),
    },
    {
      key: "created_at",
      header: "Date Created",
      skeletonShape: "narrow",
      sortKey: "created_at",
      align: "right",
      render: (doc) => (
        <NormalText secondary>
          {formatDate(doc.created_at)}
        </NormalText>
      ),
    },
  ];

  if (onDelete) {
    cols.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (doc) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Delete Document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }

  return cols;
}

export function buildSharedColumns(onDelete?: (id: number) => void): TableColumn<Document>[] {
  const cols: TableColumn<Document>[] = [
    {
      key: "id",
      header: "ID",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
          #{doc.id}
        </span>
      ),
    },
    {
      key: "date_distributed",
      header: "Distributed",
      skeletonShape: "narrow",
      sortKey: "distributed_at",
      align: "left",
      render: (doc) => (
        <NormalText secondary>
          {formatDate(doc.distributed_at || doc.created_at)}
        </NormalText>
      ),
    },
    {
      key: "effective_date",
      header: "Effective Date",
      skeletonShape: "narrow",
      sortKey: "effective_date",
      align: "left",
      render: (doc) => (
        <NormalText secondary>
          {formatDate(doc.effective_date) || "—"}
        </NormalText>
      ),
    },
    {
      key: "title",
      header: "Document Title",
      skeletonShape: "text",
      sortKey: "title",
      render: (doc) => (
        <div className="min-w-0 pr-4">
          <MiddleTruncate 
            text={doc.title}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
          />
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
          {doc.code || "—"}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      skeletonShape: "text",
      render: (doc) => <TypeText type={doc.doctype} />,
    },
    {
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (doc: any) => (
        <NormalText secondary>
          {doc.ownerOffice?.code || doc.office?.code || "—"}
        </NormalText>
      ),
    },
    {
        key: "version",
        header: "Ver.",
        align: "center",
        skeletonShape: "narrow",
        render: (doc) => (
          <NormalText secondary>v{doc.version_number}</NormalText>
        ),
    },
    {
      key: "date_shared",
      header: "Date Shared",
      skeletonShape: "narrow",
      sortKey: "created_at",
      align: "right",
      render: (doc) => (
        <NormalText secondary>
          {formatDate(doc.created_at)}
        </NormalText>
      ),
    },
  ];

  if (onDelete) {
    cols.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (doc) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Delete Document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }

  return cols;
}

// Map old names to new unified builder with correct headers
export const buildBaseDocColumns = () => buildCreatedColumns();

export function buildRequestedColumns(isQaAdmin: boolean, onDelete?: (id: number) => void): TableColumn<any>[] {
  const cols: TableColumn<any>[] = [
    {
      key: "id",
      header: "ID",
      skeletonShape: "narrow",
      render: (r) => (
        <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
          #{r.id || r.recipient_id || "?"}
        </span>
      ),
    },
    {
      key: "request",
      header: "Request Title",
      skeletonShape: "text",
      sortKey: "title",
      render: (r) => (
        <div className="min-w-0 pr-4">
          <MiddleTruncate 
            text={r.item_title ?? r.batch_title}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
          />
          {r.item_title && r.batch_title && (
            <MiddleTruncate 
              text={r.batch_title}
              className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5"
            />
          )}
        </div>
      ),
    },
  ];

  if (isQaAdmin) {
    cols.push({
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (r) => (
        <NormalText secondary>
          {r.office_code || "—"}
        </NormalText>
      ),
    });
  }

  cols.push(
    {
      key: "date",
      header: "Date Accepted",
      skeletonShape: "narrow",
      sortKey: "created_at",
      align: "right",
      render: (r) => (
        <NormalText secondary>
          {formatDate(r.created_at)}
        </NormalText>
      ),
    },
  );

  if (onDelete) {
    cols.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r.request_id || r.id);
          }}
          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Delete Request"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }

  return cols;
}

export function buildAllColumns(onDelete?: (id: number) => void): TableColumn<LibraryItem>[] {
  const cols: TableColumn<LibraryItem>[] = [
    {
      key: "id",
      header: "ID",
      skeletonShape: "narrow",
      render: (item) => (
        <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
          #{item.docId || item.reqId || (item._key?.split('-').pop()) || "?"}
        </span>
      ),
    },
    {
      key: "distributed",
      header: "Distributed",
      skeletonShape: "narrow",
      sortKey: "distributed_at",
      align: "left",
      render: (item) => (
        <NormalText secondary>
          {formatDate(item.dateDistributed || item.date)}
        </NormalText>
      ),
    },
    {
      key: "effective_date",
      header: "Effective Date",
      skeletonShape: "narrow",
      sortKey: "effective_date",
      align: "left",
      render: (item: any) => (
        <NormalText secondary>
          {formatDate(item.effectiveDate || item.effective_date) || "—"}
        </NormalText>
      ),
    },
    {
      key: "title",
      header: "Title",
      skeletonShape: "text",
      sortKey: "title",
      render: (item) => (
        <div className="min-w-0 pr-4">
          <MiddleTruncate 
            text={item.title}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
          />
          {item.subtitle && (
              <MiddleTruncate 
                text={item.subtitle}
                className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5"
              />
          )}
        </div>
      ),
    },
    {
      key: "source",
      header: "Source",
      skeletonShape: "narrow",
      render: (item) => (
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 dark:bg-surface-600 dark:text-slate-400 px-1.5 py-0.5 rounded">
          {item.source}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      skeletonShape: "text",
      render: (item) => <TypeText type={item.doctype || item.mode || "—"} />,
    },
    {
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (item: any) => {
        const off = item.office;
        const display = typeof off === "object" && off !== null 
          ? (off.code || off.name || "—") 
          : (off || "—");
        return (
          <NormalText secondary>
            {display}
          </NormalText>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      skeletonShape: "badge",
      render: (item) => <StatusBadge status={item.status || "Distributed"} />,
    },
    {
      key: "created_at",
      header: "Date Created",
      skeletonShape: "narrow",
      sortKey: "created_at",
      align: "right",
      render: (item) => (
        <NormalText secondary>
          {formatDate(item.date)}
        </NormalText>
      ),
    },
  ];

  if (onDelete) {
    cols.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (item) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(item.docId || item.reqId || 0);
          }}
          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Delete Record"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }

  return cols;
}

export function buildArchiveColumns(onDelete?: (id: number) => void): TableColumn<Document>[] {
  const cols: TableColumn<Document>[] = [
    {
      key: "id",
      header: "ID",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
          #{doc.id}
        </span>
      ),
    },
    {
      key: "archived_on",
      header: "Archived At",
      skeletonShape: "narrow",
      sortKey: "archived_at",
      align: "left",
      render: (doc) => (
        <NormalText secondary>
          {doc.archived_at ? formatDate(doc.archived_at) : (doc.updated_at ? formatDate(doc.updated_at) : "—")}
        </NormalText>
      ),
    },
    {
      key: "title",
      header: "Document Title",
      skeletonShape: "text",
      sortKey: "title",
      render: (doc) => (
        <div className="min-w-0 pr-4">
          <MiddleTruncate 
            text={doc.title}
            className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
          />
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      skeletonShape: "narrow",
      render: (doc) => (
        <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
          {doc.code || "—"}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      skeletonShape: "text",
      render: (doc) => <TypeText type={doc.doctype} />,
    },
    {
      key: "office",
      header: "Office",
      skeletonShape: "text",
      render: (doc: any) => (
        <NormalText secondary>
          {doc.ownerOffice?.code || doc.office?.code || "—"}
        </NormalText>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      skeletonShape: "text",
      render: (doc: any) => {
        const isArchived = !!doc.archived_at;
        
        // Priority 1: Server explicitly tells us the reason
        // Priority 2: Use status for Superseded/Cancelled
        // Priority 3: Fallback to "Manually Archived" if timestamp is there
        let reason = doc.archive_reason;
        
        if (!reason) {
          if (isArchived) reason = "Manually Archived";
          else if (doc.status === "Superseded") reason = "Superseded (New Version)";
          else if (doc.status === "Cancelled") reason = "Cancelled";
          else reason = doc.status || "—";
        }
        
        // Normalize "Superseded" label
        if (reason === "Superseded") reason = "Superseded (New Version)";
        
        return <StatusBadge status={reason} />;
      },
    },
  ];

  if (onDelete) {
    cols.push({
      key: "actions",
      header: "Action",
      align: "right",
      render: (doc) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(doc.id);
          }}
          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          title="Delete Archived Document"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ),
    });
  }

  return cols;
}
