import React, { useEffect, useMemo, useState } from "react";
import {
  listDocumentsPage,
  getCurrentUserOfficeId,
  type Document,
} from "../services/documents";
import { listDocumentRequestIndividual } from "../services/documentRequests";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import {
  getUserRole,
  isQA,
  isSysAdmin,
  isOfficeStaff,
  isOfficeHead,
} from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import Button from "../components/ui/Button";
import Table, { type TableColumn } from "../components/ui/Table";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import ShareDocumentModal from "../components/documents/ShareDocumentModal";
import {
  Search,
  X,
  BookOpen,
  FileText,
  Share2,
  Users,
  ArrowDownToLine,
  FileStack,
} from "lucide-react";
import { inputCls, selectCls } from "../utils/formStyles";
import { formatDate } from "../utils/formatters";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import RefreshButton from "../components/ui/RefreshButton";

// ── Type badge ───────────────────────────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  internal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  external: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  forms: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function TypeBadge({ type }: { type: string }) {
  const cls =
    TYPE_STYLES[type?.toLowerCase()] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}
    >
      {type || "—"}
    </span>
  );
}

// ── Mode badge (document request mode) ───────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const isMultiDoc = mode === "multi_doc";
  return (
    <span
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        isMultiDoc
          ? "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-400"
          : "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-400",
      ].join(" ")}
    >
      {isMultiDoc ? (
        <FileStack className="h-2.5 w-2.5" />
      ) : (
        <Users className="h-2.5 w-2.5" />
      )}
      {isMultiDoc ? "Multi-Doc" : "Multi-Office"}
    </span>
  );
}

// ── Source badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source }: { source: "created" | "requested" | "shared" }) {
  const map = {
    created: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    requested: "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
    shared: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  };
  const label = { created: "Created", requested: "Requested", shared: "Shared" };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[source]}`}
    >
      {label[source]}
    </span>
  );
}

// ── Tab type ─────────────────────────────────────────────────────────────────
type LibTab = "all" | "created" | "requested" | "shared";

const TAB_LABELS: Record<LibTab, string> = {
  all: "All",
  created: "Created",
  requested: "Requested",
  shared: "Shared",
};

const TAB_ICONS: Record<LibTab, React.ReactNode> = {
  all: <BookOpen className="h-3.5 w-3.5" />,
  created: <FileText className="h-3.5 w-3.5" />,
  requested: <ArrowDownToLine className="h-3.5 w-3.5" />,
  shared: <Users className="h-3.5 w-3.5" />,
};

// ── Unified All-tab item ──────────────────────────────────────────────────────
type LibraryItem = {
  _key: string;
  source: "created" | "shared" | "requested";
  title: string;
  subtitle?: string;
  doctype?: string;
  mode?: string;
  office?: string;
  version?: number;
  date: string;
  docId?: number;
  reqId?: number;
  recipId?: number;
  itemId?: number;
};

function docToLibraryItem(doc: Document, source: "created" | "shared"): LibraryItem {
  return {
    _key: `doc-${doc.id}`,
    source,
    title: doc.title,
    subtitle: doc.code ?? undefined,
    doctype: doc.doctype,
    office: (doc as any).ownerOffice?.name ?? undefined,
    version: doc.version_number,
    date: doc.created_at,
    docId: doc.id,
  };
}

function reqToLibraryItem(row: any): LibraryItem {
  return {
    _key: `req-${row.request_id}-${row.row_id ?? row.recipient_id}`,
    source: "requested",
    title: row.item_title ?? row.batch_title,
    subtitle: row.item_title ? row.batch_title : undefined,
    mode: row.batch_mode,
    office: row.office_name,
    date: row.created_at,
    reqId: row.request_id,
    recipId: row.recipient_id,
    itemId: row.item_id ?? undefined,
  };
}

// ── Doc title cell ────────────────────────────────────────────────────────────
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

// ── Share button cell ─────────────────────────────────────────────────────────
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DocumentLibraryPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  const myOfficeId = getCurrentUserOfficeId();
  const isAdmin = ["ADMIN", "SYSADMIN"].includes(String(role).toUpperCase());
  const isQaAdmin = isQA(role) || isSysAdmin(role) || isAdmin;
  const adminDebugMode = useAdminDebugMode();
  const canCreate =
    isQA(role) ||
    isOfficeStaff(role) ||
    isOfficeHead(role) ||
    (isAdmin && adminDebugMode);
  const canShare = isQA(role) || isSysAdmin(role);

  const [tab, setTab] = useState<LibTab>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── State: Created / Shared tabs (both use listDocumentsPage) ─────────────
  const [docRows, setDocRows] = useState<Document[]>([]);
  const [docPage, setDocPage] = useState(1);
  const [docHasMore, setDocHasMore] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [docInitialLoading, setDocInitialLoading] = useState(true);

  // ── State: Requested tab ──────────────────────────────────────────────────
  const [reqRows, setReqRows] = useState<any[]>([]);
  const [reqPage, setReqPage] = useState(1);
  const [reqHasMore, setReqHasMore] = useState(true);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqInitialLoading, setReqInitialLoading] = useState(true);

  // ── State: All tab (dual sources) ─────────────────────────────────────────
  const [allDocRows, setAllDocRows] = useState<Document[]>([]);
  const [allDocPage, setAllDocPage] = useState(1);
  const [allDocHasMore, setAllDocHasMore] = useState(true);
  const [allReqRows, setAllReqRows] = useState<any[]>([]);
  const [allReqPage, setAllReqPage] = useState(1);
  const [allReqHasMore, setAllReqHasMore] = useState(true);
  const [allLoading, setAllLoading] = useState(false);
  const [allInitialLoading, setAllInitialLoading] = useState(true);

  // ── Share modal ───────────────────────────────────────────────────────────
  const [shareOpen, setShareOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // Reset all state on tab / filter change
  useEffect(() => {
    setDocRows([]); setDocPage(1); setDocHasMore(true); setDocInitialLoading(true); setDocLoading(false);
    setReqRows([]); setReqPage(1); setReqHasMore(true); setReqInitialLoading(true); setReqLoading(false);
    setAllDocRows([]); setAllDocPage(1); setAllDocHasMore(true);
    setAllReqRows([]); setAllReqPage(1); setAllReqHasMore(true); setAllInitialLoading(true); setAllLoading(false);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo]);

  // ── Load: Created / Shared ────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "created" && tab !== "shared") return;
    if (!docHasMore && docPage > 1) return;
    let alive = true;
    const load = async () => {
      setDocLoading(true);
      setError(null);
      try {
        const scope = isAdmin ? "all" : tab === "created" ? "owned" : "shared";
        const res = await listDocumentsPage({
          page: docPage,
          perPage: 25,
          q: qDebounced.trim() || undefined,
          status: "Distributed",
          doctype: typeFilter !== "ALL" ? typeFilter : undefined,
          scope,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
        });
        if (!alive) return;
        const incoming = res.data ?? [];
        setDocRows((prev) => (docPage === 1 ? incoming : [...prev, ...incoming]));
        setDocHasMore(
          (res.meta?.current_page ?? 0) < (res.meta?.last_page ?? 0),
        );
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load.");
      } finally {
        if (!alive) return;
        setDocLoading(false);
        setDocInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, docPage, qDebounced, typeFilter, dateFrom, dateTo, isAdmin]);

  // ── Load: Requested ───────────────────────────────────────────────────────
  useEffect(() => {
    if (tab !== "requested") return;
    if (!reqHasMore && reqPage > 1) return;
    let alive = true;
    const load = async () => {
      setReqLoading(true);
      setError(null);
      try {
        const res = await listDocumentRequestIndividual({
          status: "accepted",
          q: qDebounced.trim() || undefined,
          per_page: 25,
          page: reqPage,
        });
        if (!alive) return;
        const incoming = Array.isArray(res.data) ? res.data : [];
        setReqRows((prev) => (reqPage === 1 ? incoming : [...prev, ...incoming]));
        setReqHasMore(
          res.current_page != null &&
            res.last_page != null &&
            res.current_page < res.last_page,
        );
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load.");
      } finally {
        if (!alive) return;
        setReqLoading(false);
        setReqInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reqPage, qDebounced]);

  // ── Load: All tab (parallel fetch) ───────────────────────────────────────
  useEffect(() => {
    if (tab !== "all") return;
    if (!allDocHasMore && !allReqHasMore && allDocPage > 1) return;
    let alive = true;
    const load = async () => {
      setAllLoading(true);
      setError(null);
      try {
        const [docRes, reqRes] = await Promise.all([
          allDocHasMore
            ? listDocumentsPage({
                page: allDocPage,
                perPage: 25,
                q: qDebounced.trim() || undefined,
                status: "Distributed",
                doctype: typeFilter !== "ALL" ? typeFilter : undefined,
                scope: "all",
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
              })
            : null,
          allReqHasMore
            ? listDocumentRequestIndividual({
                status: "accepted",
                q: qDebounced.trim() || undefined,
                per_page: 25,
                page: allReqPage,
              })
            : null,
        ]);
        if (!alive) return;
        if (docRes) {
          const inc = docRes.data ?? [];
          setAllDocRows((prev) => (allDocPage === 1 ? inc : [...prev, ...inc]));
          setAllDocHasMore(
            (docRes.meta?.current_page ?? 0) < (docRes.meta?.last_page ?? 0),
          );
        }
        if (reqRes) {
          const inc = Array.isArray(reqRes.data) ? reqRes.data : [];
          setAllReqRows((prev) => (allReqPage === 1 ? inc : [...prev, ...inc]));
          setAllReqHasMore(
            reqRes.current_page != null &&
              reqRes.last_page != null &&
              reqRes.current_page < reqRes.last_page,
          );
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load.");
      } finally {
        if (!alive) return;
        setAllLoading(false);
        setAllInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, allDocPage, allReqPage, qDebounced, typeFilter, dateFrom, dateTo]);

  // Merged + sorted All tab rows
  const merged = useMemo((): LibraryItem[] => {
    const docItems = allDocRows.map((d) => {
      const source: "created" | "shared" =
        isAdmin || !myOfficeId || (d as any).owner_office_id === myOfficeId
          ? "created"
          : "shared";
      return docToLibraryItem(d, source);
    });
    const reqItems = allReqRows.map(reqToLibraryItem);
    return [...docItems, ...reqItems].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [allDocRows, allReqRows, myOfficeId, isAdmin]);

  // Reload (for refresh button)
  const reloadLibrary = () => {
    setDocRows([]); setDocPage(1); setDocHasMore(true); setDocInitialLoading(true);
    setReqRows([]); setReqPage(1); setReqHasMore(true); setReqInitialLoading(true);
    setAllDocRows([]); setAllDocPage(1); setAllDocHasMore(true);
    setAllReqRows([]); setAllReqPage(1); setAllReqHasMore(true); setAllInitialLoading(true);
    setError(null);
  };

  const { refresh, refreshing } = usePageBurstRefresh(reloadLibrary);

  // ── Table columns ─────────────────────────────────────────────────────────

  const baseDocColumns: TableColumn<Document>[] = useMemo(
    () => [
      {
        key: "type",
        header: "Type",
        render: (doc) => <TypeBadge type={doc.doctype} />,
      },
      {
        key: "document",
        header: "Document",
        render: (doc) => <DocTitle doc={doc} />,
      },
      {
        key: "version",
        header: "Ver.",
        align: "center" as const,
        render: (doc) => (
          <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
            v{doc.version_number}
          </span>
        ),
      },
      {
        key: "created",
        header: "Created",
        render: (doc) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {formatDate(doc.created_at)}
          </span>
        ),
      },
    ],
    [],
  );

  const sharedColumns: TableColumn<Document>[] = useMemo(() => {
    if (!canShare) return baseDocColumns;
    return [
      ...baseDocColumns,
      {
        key: "actions",
        header: "",
        align: "right" as const,
        render: (doc) => (
          <ShareCell
            doc={doc}
            canShare={canShare}
            onShare={(id) => {
              setShareDocId(id);
              setShareOpen(true);
            }}
          />
        ),
      },
    ];
  }, [baseDocColumns, canShare]);

  const requestedColumns: TableColumn<any>[] = useMemo(() => {
    const cols: TableColumn<any>[] = [
      {
        key: "mode",
        header: "Type",
        render: (r) => <ModeBadge mode={r.batch_mode} />,
      },
      {
        key: "request",
        header: "Request",
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
        render: () => (
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
            ACCEPTED
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        render: (r) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {formatDate(r.created_at)}
          </span>
        ),
      },
    );

    return cols;
  }, [isQaAdmin]);

  const allColumns: TableColumn<LibraryItem>[] = useMemo(
    () => [
      {
        key: "source",
        header: "Source",
        render: (item) => <SourceBadge source={item.source} />,
      },
      {
        key: "title",
        header: "Title",
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
        render: (item) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
            {item.office ?? "—"}
          </span>
        ),
      },
      {
        key: "meta",
        header: "Ver. / Status",
        render: (item) =>
          item.version != null ? (
            <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
              v{item.version}
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400">
              ACCEPTED
            </span>
          ),
      },
      {
        key: "date",
        header: "Date",
        render: (item) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {formatDate(item.date)}
          </span>
        ),
      },
    ],
    [],
  );

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleDocClick = (doc: Document) =>
    navigate(`/documents/${doc.id}/view`, { state: { from: "/documents" } });

  const handleReqRowClick = (row: any) => {
    if (row.row_type === "item") {
      navigate(`/document-requests/${row.request_id}/items/${row.item_id}`);
    } else {
      navigate(
        `/document-requests/${row.request_id}/recipients/${row.recipient_id}`,
      );
    }
  };

  const handleAllItemClick = (item: LibraryItem) => {
    if (item.docId) {
      navigate(`/documents/${item.docId}/view`, { state: { from: "/documents" } });
    } else if (item.itemId) {
      navigate(`/document-requests/${item.reqId}/items/${item.itemId}`);
    } else if (item.reqId && item.recipId) {
      navigate(`/document-requests/${item.reqId}/recipients/${item.recipId}`);
    }
  };

  // ── Grid templates ────────────────────────────────────────────────────────
  const createdGrid   = "80px 1fr 60px 110px";
  const sharedGrid    = canShare ? "80px 1fr 60px 110px 80px" : "80px 1fr 60px 110px";
  const requestedGrid = isQaAdmin ? "110px 1fr 160px 120px 110px" : "110px 1fr 120px 110px";
  const allGrid       = "90px 1fr 110px 150px 80px 110px";

  const emptyMessages: Record<LibTab, string> = {
    all: "No documents in your library yet.",
    created: "No distributed documents created by your office.",
    requested: "No accepted document request submissions found.",
    shared: "No documents have been shared with your office.",
  };

  return (
    <PageFrame
      title="Document Library"
      right={
        <div className="flex items-center gap-2">
          <RefreshButton
            onClick={refresh}
            loading={refreshing}
            title="Refresh library"
          />
          {canCreate && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", { state: { fromWorkQueue: true } });
              }}
            >
              + Create document
            </Button>
          )}
        </div>
      }
      contentClassName="flex flex-col min-h-0 gap-4 h-full"
    >
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0">
        {(["all", "created", "requested", "shared"] as LibTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
            ].join(" ")}
          >
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              tab === "requested" ? "Search requests…" : "Search title, code…"
            }
            className={`${inputCls} pl-9 pr-8`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Type filter — not applicable for Requested tab */}
        {tab !== "requested" && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className={selectCls}
          >
            <option value="ALL">All types</option>
            <option value="internal">Internal</option>
            <option value="external">External</option>
            <option value="forms">Forms</option>
          </select>
        )}

        {/* Date filter — only for doc-based tabs */}
        {(tab === "created" || tab === "shared") && (
          <DateRangeInput
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
          />
        )}

        {(q || typeFilter !== "ALL" || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTypeFilter("ALL");
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}

        {error && <Alert variant="danger">{error}</Alert>}
      </div>

      {/* Created tab */}
      {tab === "created" && (
        <Table<Document>
          columns={baseDocColumns}
          rows={docRows}
          loading={docLoading}
          initialLoading={docInitialLoading}
          emptyMessage={emptyMessages.created}
          rowKey={(doc) => doc.id}
          onRowClick={handleDocClick}
          hasMore={docHasMore}
          onLoadMore={() => setDocPage((p) => p + 1)}
          gridTemplateColumns={createdGrid}
          className="flex-1 min-h-0"
        />
      )}

      {/* Shared tab */}
      {tab === "shared" && (
        <Table<Document>
          columns={sharedColumns}
          rows={docRows}
          loading={docLoading}
          initialLoading={docInitialLoading}
          emptyMessage={emptyMessages.shared}
          rowKey={(doc) => doc.id}
          onRowClick={handleDocClick}
          hasMore={docHasMore}
          onLoadMore={() => setDocPage((p) => p + 1)}
          gridTemplateColumns={sharedGrid}
          className="flex-1 min-h-0"
        />
      )}

      {/* Requested tab */}
      {tab === "requested" && (
        <Table<any>
          columns={requestedColumns}
          rows={reqRows}
          loading={reqLoading}
          initialLoading={reqInitialLoading}
          emptyMessage={emptyMessages.requested}
          rowKey={(r) => `${r.request_id}-${r.row_id ?? r.recipient_id}`}
          onRowClick={handleReqRowClick}
          hasMore={reqHasMore}
          onLoadMore={() => setReqPage((p) => p + 1)}
          gridTemplateColumns={requestedGrid}
          className="flex-1 min-h-0"
        />
      )}

      {/* All tab */}
      {tab === "all" && (
        <Table<LibraryItem>
          columns={allColumns}
          rows={merged}
          loading={allLoading}
          initialLoading={allInitialLoading}
          emptyMessage={emptyMessages.all}
          rowKey={(item) => item._key}
          onRowClick={handleAllItemClick}
          hasMore={allDocHasMore || allReqHasMore}
          onLoadMore={() => {
            if (allDocHasMore) setAllDocPage((p) => p + 1);
            if (allReqHasMore) setAllReqPage((p) => p + 1);
          }}
          gridTemplateColumns={allGrid}
          className="flex-1 min-h-0"
        />
      )}

      <ShareDocumentModal
        open={shareOpen}
        documentId={shareDocId}
        onClose={() => {
          setShareOpen(false);
          setShareDocId(null);
        }}
        onSaved={() => {}}
      />
    </PageFrame>
  );
}
