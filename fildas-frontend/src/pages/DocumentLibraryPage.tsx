import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { 
  getUserRole, 
  isQA, 
  isAuditor,
} from "../lib/roleFilters";
import { getAuthUser } from "../lib/auth";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import Table from "../components/ui/Table";
import SelectDropdown from "../components/ui/SelectDropdown";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import { PageActions, CreateAction, RefreshAction, ArchiveAction } from "../components/ui/PageActions";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { LayoutGrid, List, Share2, ClipboardList } from "lucide-react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { formatDate } from "../utils/formatters";
import { tabCls } from "../utils/formStyles";

import {
  type LibTab,
  type LibraryItem,
  docToLibraryItem,
  reqToLibraryItem,
} from "./documentLibrary/documentLibraryTypes";
import {
  listDocumentsPage,
} from "../services/documents";
import { listDocumentRequestIndividual } from "../services/documentRequests";
import { buildBaseDocColumns, buildSharedColumns, buildRequestedColumns, buildAllColumns } from "./documentLibrary/DocumentLibraryColumns";

const TAB_LABELS: Record<LibTab, string> = {
  all: "All Documents",
  created: "My Documents",
  requested: "Requested",
  shared: "Shared with Me",
};

const TAB_ICONS: Record<LibTab, React.ReactNode> = {
  all: <LayoutGrid className="h-4 w-4" />,
  created: <List className="h-4 w-4" />,
  requested: <ClipboardList className="h-4 w-4" />,
  shared: <Share2 className="h-4 w-4" />,
};

export default function DocumentLibraryPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  const user = getAuthUser();
  const myOfficeId = user?.office_id;
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [sourceFilter, setSourceFilter] = useState<"all" | "doc" | "req">("all");

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
            ...docIn.map((d: any) => docToLibraryItem(d, (isAdmin || !myOfficeId || (d as any).owner_office_id === myOfficeId) ? "created" : "shared")),
            ...reqIn.map((r: any) => reqToLibraryItem(r))
          ];
          setRows(items);
          setAllDocPage(1);
          setAllReqPage(1);
        } else {
          const items = [
            ...docIn.map((d: any) => docToLibraryItem(d, (isAdmin || !myOfficeId || (d as any).owner_office_id === myOfficeId) ? "created" : "shared")),
            ...reqIn.map((r: any) => reqToLibraryItem(r))
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
        <PageActions>
          <RefreshAction
            onRefresh={async () => { await loadData(false); }}
            loading={refreshing || loading}
          />

          <ArchiveAction onClick={() => navigate("/archive")} />

          {canCreate && (
            <CreateAction
              label="Create document"
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", { state: { fromWorkQueue: true } });
              }}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto hide-scrollbar">
        {(isAuditor(role)
          ? (["all"] as LibTab[])
          : (["all", "created", "requested", "shared"] as LibTab[])
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
          className={tabCls(tab === t)}
          >
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search library..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setQ("");
          setTypeFilter("ALL");
          setDateFrom("");
          setDateTo("");
          setSourceFilter("all");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                <SelectDropdown
                  value={typeFilter}
                  onChange={(val) => setTypeFilter((val as string) || "ALL")}
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
                  <SelectDropdown
                    value={sourceFilter}
                    onChange={(val) => setSourceFilter((val as "all" | "doc" | "req") || "all")}
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
          </div>
        }
      >
        <SelectDropdown
          value={typeFilter}
          onChange={(val) => setTypeFilter((val as string) || "ALL")}
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
          <SelectDropdown
            value={sourceFilter}
            onChange={(val) => setSourceFilter((val as "all" | "doc" | "req") || "all")}
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
      </SearchFilterBar>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Table Container */}
      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
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
