import React from "react";
import {
  BookOpen,
  FileText,
  ArrowDownToLine,
  Users,
} from "lucide-react";
import type { Document } from "../../services/documents";

export type LibTab = "all" | "created" | "requested" | "shared";

export const TAB_LABELS: Record<LibTab, string> = {
  all: "All",
  created: "Created",
  requested: "Requested",
  shared: "Shared",
};

export const TAB_ICONS: Record<LibTab, React.ReactNode> = {
  all: React.createElement(BookOpen, { className: "h-3.5 w-3.5" }),
  created: React.createElement(FileText, { className: "h-3.5 w-3.5" }),
  requested: React.createElement(ArrowDownToLine, { className: "h-3.5 w-3.5" }),
  shared: React.createElement(Users, { className: "h-3.5 w-3.5" }),
};

export type LibraryItem = {
  _key: string;
  source: "created" | "shared" | "requested";
  title: string;
  subtitle?: string;
  doctype?: string;
  mode?: string;
  office?: string;
  code?: string;
  status?: string;
  version?: number;
  date: string; // fallback date
  dateDistributed?: string;
  dateShared?: string;
  effectiveDate?: string;
  docId?: number;
  reqId?: number;
  recipId?: number;
  itemId?: number;
};

export function docToLibraryItem(
  doc: Document,
  source: "created" | "shared",
): LibraryItem {
  return {
    _key: `doc-${doc.id}`,
    source,
    title: doc.title,
    subtitle: doc.code ?? undefined,
    doctype: doc.doctype,
    office: (doc as any).ownerOffice?.code ?? (doc as any).office?.code ?? (doc as any).ownerOffice?.name ?? undefined,
    code: doc.code ?? undefined,
    status: doc.status || "Distributed",
    version: doc.version_number,
    date: doc.created_at,
    dateDistributed: doc.distributed_at || doc.created_at,
    dateShared: source === "shared" ? doc.created_at : undefined,
    effectiveDate: doc.effective_date ?? undefined,
    docId: doc.id,
  };
}

export function reqToLibraryItem(row: any): LibraryItem {
  return {
    _key: `req-${row.request_id}-${row.row_id ?? row.recipient_id}`,
    source: "requested",
    title: row.item_title ?? row.batch_title,
    subtitle: row.item_title ? row.batch_title : undefined,
    mode: row.batch_mode,
    office: row.office_code,
    code: row.document_code ?? row.code ?? undefined,
    status: row.status || "Accepted",
    date: row.created_at,
    dateDistributed: row.created_at,
    reqId: row.request_id,
    recipId: row.recipient_id,
    itemId: row.item_id ?? undefined,
  };
}
