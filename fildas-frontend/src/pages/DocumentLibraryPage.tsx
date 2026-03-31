import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { pageCache } from "../lib/pageCache";
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
  isAuditor,
} from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import ShareDocumentModal from "../components/documents/ShareDocumentModal";
import { Search, X, Archive, PlusCircle } from "lucide-react";
import { inputCls, selectCls } from "../utils/formStyles";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import RefreshButton from "../components/ui/RefreshButton";

import {
  type LibTab,
  TAB_LABELS,
  TAB_ICONS,
  type LibraryItem,
  docToLibraryItem,
  reqToLibraryItem,
} from "./documentLibrary/documentLibraryTypes";
import {
  buildBaseDocColumns,
  buildSharedColumns,
  buildRequestedColumns,
  buildAllColumns,
} from "./documentLibrary/DocumentLibraryColumns";

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
  const [sourceFilter, setSourceFilter] = useState<"all" | "doc" | "req">(
    "all",
  );
  const [sortBy, setSortBy] = useState<"title" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── State: Created / Shared tabs ──────────────────────────────────────────
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
  const _libKey0 = '{"q":"","type":"ALL","dateFrom":"","dateTo":""}';
  const _ladc = pageCache.get<Document>(
    "library-all-doc",
    _libKey0,
    3 * 60_000,
  );
  const _larc = pageCache.get<any>("library-all-req", _libKey0, 3 * 60_000);
  const [allDocRows, setAllDocRows] = useState<Document[]>(_ladc?.rows ?? []);
  const [allDocPage, setAllDocPage] = useState(1);
  const [allDocHasMore, setAllDocHasMore] = useState(_ladc?.hasMore ?? true);
  const [allReqRows, setAllReqRows] = useState<any[]>(_larc?.rows ?? []);
  const [allReqPage, setAllReqPage] = useState(1);
  const [allReqHasMore, setAllReqHasMore] = useState(_larc?.hasMore ?? true);
  const [allLoading, setAllLoading] = useState(false);
  const [allInitialLoading, setAllInitialLoading] = useState(!_ladc && !_larc);
  const [fetchKey, setFetchKey] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

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
    setDocRows([]);
    setDocPage(1);
    setDocHasMore(true);
    setDocInitialLoading(true);
    setDocLoading(false);
    setReqRows([]);
    setReqPage(1);
    setReqHasMore(true);
    setReqInitialLoading(true);
    setReqLoading(false);
    setAllDocRows([]);
    setAllDocPage(1);
    setAllDocHasMore(true);
    setAllReqRows([]);
    setAllReqPage(1);
    setAllReqHasMore(true);
    setAllInitialLoading(true);
    setAllLoading(false);
    setError(null);
    setFetchKey((k) => k + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir]);

  // Reset "all" tab-only filters when leaving that tab
  useEffect(() => {
    if (tab !== "all") {
      setSourceFilter("all");
      setSortBy("created_at");
      setSortDir("desc");
    }
  }, [tab]);

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
          perPage: 10,
          q: qDebounced.trim() || undefined,
          status: "Distributed",
          doctype: typeFilter !== "ALL" ? typeFilter : undefined,
          scope,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        if (!alive) return;
        const incoming = res.data ?? [];
        setDocRows((prev) =>
          docPage === 1 ? incoming : [...prev, ...incoming],
        );
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
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    docPage,
    qDebounced,
    typeFilter,
    dateFrom,
    dateTo,
    isAdmin,
    reloadKey,
    sortBy,
    sortDir,
    fetchKey,
  ]);

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
          per_page: 10,
          page: reqPage,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        if (!alive) return;
        const incoming = Array.isArray(res.data) ? res.data : [];
        setReqRows((prev) =>
          reqPage === 1 ? incoming : [...prev, ...incoming],
        );
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
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, reqPage, qDebounced, reloadKey, sortBy, sortDir]);

  // ── Load: All tab (parallel fetch) ───────────────────────────────────────
  useEffect(() => {
    if (tab !== "all") return;
    // Only block on genuine "load more" exhaustion — not on fresh loads triggered by fetchKey
    if (!allDocHasMore && !allReqHasMore && allDocPage > 1 && allReqPage > 1)
      return;
    let alive = true;
    const load = async () => {
      setAllLoading(true);
      setError(null);
      try {
        const [docRes, reqRes] = await Promise.all([
          allDocHasMore
            ? listDocumentsPage({
                page: allDocPage,
                perPage: 10,
                q: qDebounced.trim() || undefined,
                status: "Distributed",
                doctype: typeFilter !== "ALL" ? typeFilter : undefined,
                scope: "all",
                date_from: dateFrom || undefined,
                date_to: dateTo || undefined,
                sort_by: sortBy,
                sort_dir: sortDir,
              })
            : null,
          allReqHasMore && !isAuditor(role)
            ? listDocumentRequestIndividual({
                status: "accepted",
                q: qDebounced.trim() || undefined,
                per_page: 10,
                page: allReqPage,
              })
            : null,
        ]);
        if (!alive) return;
        const libFilterKey = JSON.stringify({
          q: qDebounced.trim(),
          type: typeFilter,
          dateFrom,
          dateTo,
        });
        if (docRes) {
          const inc = docRes.data ?? [];
          const docMore =
            (docRes.meta?.current_page ?? 0) < (docRes.meta?.last_page ?? 0);
          setAllDocRows((prev) => (allDocPage === 1 ? inc : [...prev, ...inc]));
          setAllDocHasMore(docMore);
          if (allDocPage === 1)
            pageCache.set("library-all-doc", libFilterKey, inc, docMore);
        }
        if (reqRes) {
          const inc = Array.isArray(reqRes.data) ? reqRes.data : [];
          const reqMore =
            reqRes.current_page != null &&
            reqRes.last_page != null &&
            reqRes.current_page < reqRes.last_page;
          setAllReqRows((prev) => (allReqPage === 1 ? inc : [...prev, ...inc]));
          setAllReqHasMore(reqMore);
          if (allReqPage === 1)
            pageCache.set("library-all-req", libFilterKey, inc, reqMore);
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
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    tab,
    allDocPage,
    allReqPage,
    qDebounced,
    typeFilter,
    dateFrom,
    dateTo,
    reloadKey,
    sortBy,
    sortDir,
    fetchKey,
  ]);

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
    return sourceFilter === "doc"
      ? docItems
      : sourceFilter === "req"
        ? reqItems
        : [...docItems, ...reqItems];
  }, [allDocRows, allReqRows, myOfficeId, isAdmin, sourceFilter]);

  // Reload (for burst refresh / filter changes)
  const reloadLibrary = () => {
    setDocRows([]);
    setDocPage(1);
    setDocHasMore(true);
    setDocInitialLoading(true);
    setReqRows([]);
    setReqPage(1);
    setReqHasMore(true);
    setReqInitialLoading(true);
    setReloadKey((k) => k + 1);
    setAllDocRows([]);
    setAllDocPage(1);
    setAllDocHasMore(true);
    setAllReqRows([]);
    setAllReqPage(1);
    setAllReqHasMore(true);
    setAllInitialLoading(true);
    setError(null);
  };

  const { refreshing } = usePageBurstRefresh(reloadLibrary);

  // Manual refresh — fetches page 1 and compares first item id
  const firstDocIdRef = useRef<number | null>(null);
  const handleLibraryRefresh = useCallback(async (): Promise<
    string | false
  > => {
    const prevFirstId = firstDocIdRef.current;
    reloadLibrary();
    // Give state resets a tick, then fetch page 1 directly
    await new Promise((r) => setTimeout(r, 50));
    try {
      const scope =
        tab === "created" ? "owned" : tab === "shared" ? "shared" : "all";
      const res = await listDocumentsPage({
        page: 1,
        perPage: 10,
        q: qDebounced.trim() || undefined,
        status: "Distributed",
        doctype: typeFilter !== "ALL" ? typeFilter : undefined,
        scope,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      const incoming = res.data ?? [];
      firstDocIdRef.current = incoming[0]?.id ?? null;
      if (prevFirstId === null) return false;
      return incoming[0]?.id !== prevFirstId
        ? "Library updated with new documents."
        : "Already up to date.";
    } catch {
      return false;
    }
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir]);

  // ── Column definitions ────────────────────────────────────────────────────
  const handleShare = (id: number) => {
    setShareDocId(id);
    setShareOpen(true);
  };

  const baseDocColumns = useMemo(() => buildBaseDocColumns(), []);
  const sharedColumns = useMemo(
    () => buildSharedColumns(canShare, handleShare),
    [canShare],
  );
  const requestedColumns = useMemo(
    () => buildRequestedColumns(isQaAdmin),
    [isQaAdmin],
  );
  const allColumns = useMemo(() => buildAllColumns(), []);

  // ── Navigation ────────────────────────────────────────────────────────────
  const libCrumbs = [{ label: "Library", to: "/documents" }];

  const handleDocClick = (doc: Document) =>
    navigate(`/documents/${doc.id}/view`, {
      state: { from: "/documents", breadcrumbs: libCrumbs },
    });

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
      navigate(`/documents/${item.docId}/view`, {
        state: { from: "/documents", breadcrumbs: libCrumbs },
      });
    } else if (item.itemId) {
      navigate(`/document-requests/${item.reqId}/items/${item.itemId}`);
    } else if (item.reqId && item.recipId) {
      navigate(`/document-requests/${item.reqId}/recipients/${item.recipId}`);
    }
  };

  // ── Mobile Card Renderers ────────────────────────────────────────────────
  const renderDocCard = (doc: Document) => (
    <div className="p-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-surface-400">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
          {doc.title}
        </p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          <span className="font-semibold">{doc.code ?? "—"}</span> · v{doc.version_number}
          {doc.ownerOffice?.code && ` · ${doc.ownerOffice.code}`}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5">
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 uppercase tracking-tight">
          Distributed
        </span>
        <span className="text-[9px] font-medium text-slate-400 tabular-nums">
          {doc.effective_date ? new Date(doc.effective_date).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'2-digit'}) : ""}
        </span>
      </div>
    </div>
  );

  const renderReqCard = (r: any) => (
    <div className="p-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-surface-400">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
          {r.document_title || r.title || "Untitled Request"}
        </p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate italic">
          {r.source_office_code ?? "—"} · v{r.version_number ?? 1}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5 text-right">
        <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 uppercase tracking-tight">
          {r.status || "Accepted"}
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          {r.row_type === "item" ? "Submission" : "Recipient"}
        </span>
      </div>
    </div>
  );

  const renderLibraryCard = (item: LibraryItem) => (
    <div className="p-4 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-surface-400">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-slate-900 dark:text-slate-100 truncate leading-tight">
          {item.title}
        </p>
        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
          <span className="font-semibold">{item.code ?? "—"}</span> · v{item.version}
          {item.office && ` · ${item.office}`}
        </p>
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1.5 text-right">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight ${
          item.source === "requested" 
            ? "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
        }`}>
          {item.status || (item.source === "requested" ? "Accepted" : "Distributed")}
        </span>
        <span className="text-[10px] font-medium text-slate-400 capitalize">
          {item.source}
        </span>
      </div>
    </div>
  );

  // ── Grid templates ────────────────────────────────────────────────────────
  const createdGrid = "80px 1fr 60px 100px 110px";
  const sharedGrid = canShare
    ? "80px 1fr 60px 100px 110px 80px"
    : "80px 1fr 60px 100px 110px";
  const requestedGrid = isQaAdmin
    ? "110px 1fr 160px 120px 110px"
    : "110px 1fr 120px 110px";
  const allGrid = "90px 1fr 110px 150px 80px 110px";

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
            onRefresh={handleLibraryRefresh}
            loading={refreshing}
            title="Refresh library"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            responsive
            onClick={() => navigate("/archive")}
            className="flex items-center gap-1.5 px-3"
          >
            <Archive className="h-4 w-4" />
            <span>Archive</span>
          </Button>
          {canCreate && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              responsive
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", {
                  state: { fromWorkQueue: true },
                });
              }}
            >
              <PlusCircle size={14} className="sm:hidden" />
              <span>+ Create document</span>
            </Button>
          )}
        </div>
      }
      contentClassName="flex flex-col min-h-0 gap-4 h-full"
    >
      {/* Tabs — Scrollable on mobile, no vertical scroll leakage */}
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto overflow-y-hidden hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        {(isAuditor(role)
          ? (["all"] as LibTab[])
          : (["all", "created", "requested", "shared"] as LibTab[])
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-[11px] sm:text-xs font-bold border-b-2 transition-all shrink-0 -mb-px",
              tab === t
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
            ].join(" ")}
          >
            <span className="scale-90 sm:scale-100">{TAB_ICONS[t]}</span>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filters — Stacking on mobile */}
      <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 shrink-0">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              tab === "requested" ? "Search requests…" : "Search documents…"
            }
            className={`${inputCls} pl-9 pr-8 text-sm`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              title="Clear"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
          {tab !== "requested" && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className={`${selectCls} text-sm w-full sm:w-auto`}
            >
              <option value="ALL">All types</option>
              <option value="internal">Internal</option>
              <option value="external">External</option>
              <option value="forms">Forms</option>
            </select>
          )}

          {tab === "all" && !isAuditor(role) && (
            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as "all" | "doc" | "req")
              }
              className={`${selectCls} text-sm w-full sm:w-auto`}
            >
              <option value="all">All sources</option>
              <option value="doc">Docs only</option>
              <option value="req">Reqs only</option>
            </select>
          )}
        </div>

        {tab !== "requested" && (
          <div className="w-full sm:w-auto overflow-x-auto hide-scrollbar">
            <DateRangeInput
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />
          </div>
        )}

        {(q ||
          typeFilter !== "ALL" ||
          dateFrom ||
          dateTo ||
          sourceFilter !== "all") && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTypeFilter("ALL");
              setDateFrom("");
              setDateTo("");
              setSourceFilter("all");
            }}
            className="w-full sm:w-auto rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear filters
          </button>
        )}

        {error && <div className="w-full"><Alert variant="danger">{error}</Alert></div>}
      </div>

      {tab === "created" && (
        <Table<Document>
          columns={baseDocColumns}
          rows={docRows}
          loading={docLoading}
          initialLoading={
            docInitialLoading || (docLoading && docRows.length === 0)
          }
          emptyMessage={emptyMessages.created}
          rowKey={(doc) => doc.id}
          onRowClick={handleDocClick}
          hasMore={docHasMore}
          onLoadMore={() => setDocPage((p) => p + 1)}
          gridTemplateColumns={createdGrid}
          className="flex-1 min-h-0"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
          mobileRender={renderDocCard}
        />
      )}

      {tab === "shared" && (
        <Table<Document>
          columns={sharedColumns}
          rows={docRows}
          loading={docLoading}
          initialLoading={
            docInitialLoading || (docLoading && docRows.length === 0)
          }
          emptyMessage={emptyMessages.shared}
          rowKey={(doc) => doc.id}
          onRowClick={handleDocClick}
          hasMore={docHasMore}
          onLoadMore={() => setDocPage((p) => p + 1)}
          gridTemplateColumns={sharedGrid}
          className="flex-1 min-h-0"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
          mobileRender={renderDocCard}
        />
      )}

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
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
          mobileRender={renderReqCard}
        />
      )}

      {tab === "all" && (
        <Table<LibraryItem>
          columns={allColumns}
          rows={merged}
          loading={allLoading}
          initialLoading={
            allInitialLoading || (allLoading && merged.length === 0)
          }
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
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
          mobileRender={renderLibraryCard}
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
