import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDocumentsPage,
  getCurrentUserOfficeId,
} from "../services/documents";
import { listDocumentRequestIndividual } from "../services/documentRequests";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import {
  getUserRole,
  isQA,
  isAuditor,
} from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Select from "../components/ui/Select";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { Search, X, PlusCircle, SlidersHorizontal, Archive } from "lucide-react";
import { inputCls } from "../utils/formStyles";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import RefreshButton from "../components/ui/RefreshButton";
import { formatDate } from "../utils/formatters";

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
  const adminDebugMode = useAdminDebugMode();
  const canCreate =
    isQA(role) ||
    getUserRole() === "OFFICE_STAFF" ||
    getUserRole() === "OFFICE_HEAD" ||
    (isAdmin && adminDebugMode);

  const [tab, setTab] = useState<LibTab>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState<"all" | "doc" | "req">(
    "all",
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "ALL") count++;
    if (sourceFilter !== "all" && tab === "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [typeFilter, sourceFilter, dateFrom, dateTo, tab]);

  const [error, setError] = useState<string | null>(null);

  // ── Unified Tables States ───────────────────────────────────────────────
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Tab-specific paging states (for All tab dual-loading)
  const [allDocPage, setAllDocPage] = useState(1);
  const [allReqPage, setAllReqPage] = useState(1);
  const [allDocHasMore, setAllDocHasMore] = useState(true);
  const [allReqHasMore, setAllReqHasMore] = useState(true);

  // ── Share modal ───────────────────────────────────────────────────────────

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // Main Loader
  const loadData = useCallback(async (isNextPage = false) => {
    const targetPage = isNextPage ? page + 1 : 1;
    if (!isNextPage) {
      setInitialLoading(true);
      setRows([]);
    }

    setLoading(true);
    setError(null);

    try {
      if (tab === "created" || tab === "shared") {
        const scope = isAdmin ? "all" : tab === "created" ? "owned" : "shared";
        const res = await listDocumentsPage({
          page: targetPage,
          perPage: 12,
          q: qDebounced.trim() || undefined,
          space: "library",
          status: "Distributed",
          doctype: typeFilter !== "ALL" ? typeFilter : undefined,
          scope,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        const incoming = res.data ?? [];
        setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
        const more = (res.meta?.current_page ?? 0) < (res.meta?.last_page ?? 0);
        setHasMore(more);
        setPage(targetPage);
      } else if (tab === "requested") {
        const res = await listDocumentRequestIndividual({
          status: "accepted",
          q: qDebounced.trim() || undefined,
          per_page: 12,
          page: targetPage,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        const incoming = Array.isArray(res.data) ? res.data : [];
        setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
        const more = res.current_page != null && res.last_page != null && res.current_page < res.last_page;
        setHasMore(more);
        setPage(targetPage);
        setHasMore(more);
        setPage(targetPage);
      } else if (tab === "all") {
        // Parallel load for All tab
        const [docRes, reqRes] = await Promise.all([
          (!isNextPage || allDocHasMore) ? listDocumentsPage({
            page: isNextPage ? allDocPage + 1 : 1,
            perPage: 8,
            q: qDebounced.trim() || undefined,
            space: "library",
            status: "Distributed",
            doctype: typeFilter !== "ALL" ? typeFilter : undefined,
            scope: "all",
            date_from: dateFrom || undefined,
            date_to: dateTo || undefined,
            sort_by: sortBy,
            sort_dir: sortDir,
          }) : Promise.resolve(null),
          (!isNextPage || allReqHasMore) && !isAuditor(role) ? listDocumentRequestIndividual({
            status: "accepted",
            q: qDebounced.trim() || undefined,
            per_page: 8,
            page: isNextPage ? allReqPage + 1 : 1,
            sort_by: sortBy,
            sort_dir: sortDir,
          }) : Promise.resolve(null)
        ]);

        const docIn = docRes?.data ?? [];
        const reqIn = Array.isArray(reqRes?.data) ? reqRes.data : [];

        const docMore = docRes ? (docRes.meta?.current_page ?? 0) < (docRes.meta?.last_page ?? 0) : allDocHasMore;
        const reqMore = reqRes ? (reqRes.current_page < reqRes.last_page) : allReqHasMore;

        setAllDocHasMore(docMore);
        setAllReqHasMore(reqMore);

        if (!isNextPage) {
          const items = [
            ...docIn.map(d => docToLibraryItem(d, (isAdmin || !myOfficeId || (d as any).owner_office_id === myOfficeId) ? "created" : "shared")),
            ...reqIn.map(reqToLibraryItem)
          ];
          setRows(items);
          setAllDocPage(1);
          setAllReqPage(1);
        } else {
          const items = [
            ...docIn.map(d => docToLibraryItem(d, (isAdmin || !myOfficeId || (d as any).owner_office_id === myOfficeId) ? "created" : "shared")),
            ...reqIn.map(reqToLibraryItem)
          ];
          setRows(prev => [...prev, ...items]);
          if (docRes) setAllDocPage(p => p + 1);
          if (reqRes) setAllReqPage(p => p + 1);
        }
        setHasMore(docMore || reqMore);
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load library.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, isAdmin, page, allDocPage, allReqPage, allDocHasMore, allReqHasMore, myOfficeId, role]);

  // Effect to handle state resets and initial load
  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir]);

  const { refreshing } = usePageBurstRefresh(() => loadData(false));


  // ── Column Definitions ──────────────────────────────────────────────────
  const baseDocColumns = useMemo(() => buildBaseDocColumns(), []);
  const sharedColumns = useMemo(() => buildSharedColumns(), []);
  const requestedColumns = useMemo(() => buildRequestedColumns(isAdmin || isQA(role)), [isAdmin, role]);
  const allColumns = useMemo(() => buildAllColumns(), []);

  // ── Navigation ──────────────────────────────────────────────────────────
  const libCrumbs = [{ label: "Library", to: "/documents" }];

  const handleRowClick = (row: any) => {
    if (tab === "created" || tab === "shared") {
      navigate(`/documents/${row.id}/view`, { state: { from: "/documents", breadcrumbs: libCrumbs } });
    } else if (tab === "requested") {
      if (row.row_type === "item") {
        navigate(`/document-requests/${row.request_id}/items/${row.item_id}`);
      } else {
        navigate(`/document-requests/${row.request_id}/recipients/${row.recipient_id}`);
      }
    } else {
      const item = row as LibraryItem;
      if (item.docId) {
        navigate(`/documents/${item.docId}/view`, { state: { from: "/documents", breadcrumbs: libCrumbs } });
      } else if (item.itemId) {
        navigate(`/document-requests/${item.reqId}/items/${item.itemId}`);
      } else if (item.reqId && item.recipId) {
        navigate(`/document-requests/${item.reqId}/recipients/${item.recipId}`);
      }
    }
  };

  // ── Grid templates ────────────────────────────────────────────────────────
  const unifiedGrid = "130px minmax(120px, 1fr) 100px 110px 70px 140px";
  const sharedGrid = "130px minmax(120px, 1fr) 100px 110px 70px 140px 140px";
  const requestedGrid = (isAdmin || isQA(role)) ? "100px minmax(120px, 1fr) 130px 120px 140px" : "100px minmax(120px, 1fr) 120px 140px";
  const allGrid = "100px minmax(120px, 1fr) 100px 110px 100px 140px 140px";

  return (
    <PageFrame
      title="Document Library"
      right={
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Refresh Icon Button */}
          <RefreshButton
            onRefresh={async () => { await loadData(false); }}
            loading={refreshing || loading}
            title="Refresh library"
          />



          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/archive")}
            className="hidden sm:flex"
          >
            <Archive size={15} />
            <span className="font-bold">Archive</span>
          </Button>

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
              <PlusCircle size={15} />
              <span className="hidden sm:inline font-bold">Create document</span>
            </Button>
          )}
        </div>
      }
      contentClassName="flex flex-col min-h-0 h-full"
    >
      {/* Tabs */}
      <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400 overflow-x-auto overflow-y-hidden hide-scrollbar">
        {(isAuditor(role)
          ? (["all"] as LibTab[])
          : (["all", "created", "requested", "shared"] as LibTab[])
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all shrink-0 -mb-px",
              tab === t
                ? "border-brand-500 text-brand-600 dark:text-brand-400"
                : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
            ].join(" ")}
          >
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="shrink-0 py-3 flex flex-col gap-3 sm:gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search library..."
              className={`${inputCls} pl-9 pr-8 text-sm`}
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

          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`sm:hidden flex items-center gap-2 px-3 h-9 rounded-lg border transition-all ${isFiltersOpen || activeFiltersCount > 0
                ? "bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400 shadow-xs"
                : "bg-white border-slate-200 text-slate-600 dark:bg-surface-500 dark:border-surface-400 dark:text-slate-400"
              }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-brand-500 text-white rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="hidden sm:flex flex-wrap items-center gap-2 flex-1">
            <Select
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as string)}
              placeholder="All Types"
              className="w-32"
              options={[
                { value: "ALL", label: "All Types" },
                { value: "INTERNAL", label: "Internal" },
                { value: "EXTERNAL", label: "External" },
                { value: "FORMS", label: "Forms" },
              ]}
            />

            {tab === "all" && !isAuditor(role) && (
              <Select
                value={sourceFilter}
                onChange={(val) => setSourceFilter(val as "all" | "doc" | "req")}
                placeholder="All Sources"
                className="w-36"
                options={[
                  { value: "all", label: "All Sources" },
                  { value: "doc", label: "Docs only" },
                  { value: "req", label: "Reqs only" },
                ]}
              />
            )}

            <DateRangeInput
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />

            {(q || typeFilter !== "ALL" || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setTypeFilter("ALL");
                  setDateFrom("");
                  setDateTo("");
                  setSourceFilter("all");
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile secondary filters collapsible */}
        {isFiltersOpen && (
          <div className="sm:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                <Select
                  value={typeFilter}
                  onChange={(val) => setTypeFilter(val as string)}
                  placeholder="All Types"
                  className="w-full"
                  options={[
                    { value: "ALL", label: "All Types" },
                    { value: "INTERNAL", label: "Internal" },
                    { value: "EXTERNAL", label: "External" },
                    { value: "FORMS", label: "Forms" },
                  ]}
                />
              </div>

              {tab === "all" && !isAuditor(role) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Source</label>
                  <Select
                    value={sourceFilter}
                    onChange={(val) => setSourceFilter(val as "all" | "doc" | "req")}
                    placeholder="All Sources"
                    className="w-full"
                    options={[
                      { value: "all", label: "All Sources" },
                      { value: "doc", label: "Docs only" },
                      { value: "req", label: "Reqs only" },
                    ]}
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
              <DateRangeInput
                from={dateFrom}
                to={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
              />
            </div>

            {(q || typeFilter !== "ALL" || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setTypeFilter("ALL");
                  setDateFrom("");
                  setDateTo("");
                  setSourceFilter("all");
                }}
                className="w-full py-2.5 text-xs font-bold text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10 rounded-lg transition"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Table Container */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<any>
          bare
          className="h-full"
          columns={
            tab === "created" ? baseDocColumns :
              tab === "shared" ? sharedColumns :
                tab === "requested" ? requestedColumns : allColumns
          }
          rows={rows}
          rowKey={(r: any, idx) => {
            if (tab === "all") return r._key || `item-${idx}-${r.id || r.docId || r.reqId}`;
            if (tab === "requested") return `req-${r.request_id || r.batch_id || "raw"}-${r.id || r.recipient_id || r.row_id || idx}`;
            return `doc-${r.id || idx}`;
          }}
          loading={loading}
          initialLoading={initialLoading}
          onRowClick={handleRowClick}
          hasMore={hasMore}
          onLoadMore={() => loadData(true)}
          gridTemplateColumns={
            tab === "created" ? unifiedGrid :
              tab === "shared" ? sharedGrid :
                tab === "requested" ? requestedGrid : allGrid
          }
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as any);
            setSortDir(dir);
          }}
          mobileRender={(r) => {
            const isAllTab = tab === "all";
            const isReqTab = tab === "requested";

            // Extract common display fields
            const title = isAllTab ? r.title : (isReqTab ? (r.item_title ?? r.batch_title) : r.title);
            const code = isAllTab ? r.code : (!isReqTab ? r.code : null);
            const office = isAllTab ? (typeof r.office === "object" ? r.office?.code : r.office) :
              (isReqTab ? r.office_code : (r.office?.code || r.ownerOffice?.code));
            const date = isAllTab ? (r.dateDistributed || r.date) :
              (isReqTab ? r.created_at : (r.effective_date || r.created_at));
            const type = isAllTab ? (r.doctype || r.mode) :
              (isReqTab ? (r.batch_mode || "REQUEST") : r.doctype);
            const version = !isReqTab ? r.version_number : null;

            return (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                      {type}
                    </span>
                    {version && (
                      <span className="text-[10px] font-medium text-slate-400">v{version}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums">
                    {formatDate(date)}
                  </span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                  {title}
                </p>
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                  <div className="flex items-center gap-2 truncate">
                    {code && <span className="text-[10px] font-mono text-slate-400 shrink-0">{code}</span>}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{office || "—"}</span>
                  </div>
                  {isAllTab && r.source && (
                    <span className="text-[9px] font-bold uppercase text-brand-600 dark:text-brand-400 shrink-0">
                      {r.source}
                    </span>
                  )}
                </div>
              </div>
            );
          }}
          emptyMessage={
            tab === "requested" ? "No accepted requests found." : "No documents found in this section."
          }
        />
      </div>

    </PageFrame>
  );
}
