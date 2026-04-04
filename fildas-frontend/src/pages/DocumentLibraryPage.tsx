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
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { LayoutGrid, List, Share2, ClipboardList, Archive } from "lucide-react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { formatDate } from "../utils/formatters";
import { tabCls } from "../utils/formStyles";
import { useSmartRefresh } from "../hooks/useSmartRefresh";

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
  created: "Created",
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
  const [officeFilter, setOfficeFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tab-specific paging states
  const [allDocPage, setAllDocPage] = useState(1);
  const [allReqPage, setAllReqPage] = useState(1);
  const [allDocHasMore, setAllDocHasMore] = useState(true);
  const [allReqHasMore, setAllReqHasMore] = useState(true);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadData = useCallback(async (isNextPage = false, silent = false) => {
    const targetPage = isNextPage ? page + 1 : 1;
    if (!isNextPage && !silent) {
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
          owner_office_id: officeFilter ? Number(officeFilter) : undefined,
        });
        const incoming = res.data ?? [];
        setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
        setHasMore(res.meta.current_page < res.meta.last_page);
        setPage(targetPage);
        return incoming;
      } else if (tab === "requested") {
        const res = await listDocumentRequestIndividual({
          status: "accepted",
          q: qDebounced.trim() || undefined,
          per_page: 12,
          page: targetPage,
          sort_by: sortBy,
          sort_dir: sortDir,
          office_id: officeFilter ? Number(officeFilter) : undefined,
          batch_id: batchFilter ? Number(batchFilter) : undefined,
        });
        const incoming = Array.isArray(res.data) ? res.data : [];
        setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
        setHasMore(res.current_page < res.last_page);
        setPage(targetPage);
        return incoming;
      } else if (tab === "all") {
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
            owner_office_id: officeFilter ? Number(officeFilter) : undefined,
          }) : Promise.resolve(null),
          (!isNextPage || allReqHasMore) && !isAuditor(role) ? listDocumentRequestIndividual({
            status: "accepted",
            q: qDebounced.trim() || undefined,
            per_page: 8,
            page: isNextPage ? allReqPage + 1 : 1,
            sort_by: sortBy,
            sort_dir: sortDir,
            office_id: officeFilter ? Number(officeFilter) : undefined,
            batch_id: batchFilter ? Number(batchFilter) : undefined,
          }) : Promise.resolve(null)
        ]);

        const docIn = docRes?.data ?? [];
        const reqIn = Array.isArray(reqRes?.data) ? reqRes.data : [];
        const docMore = docRes ? (docRes.meta.current_page < docRes.meta.last_page) : allDocHasMore;
        const reqMore = reqRes ? (reqRes.current_page < reqRes.last_page) : allReqHasMore;

        setAllDocHasMore(docMore);
        setAllReqHasMore(reqMore);
        setHasMore(docMore || reqMore);

        const items = [
          ...docIn.map((d: any) => docToLibraryItem(d, (isAdmin || !myOfficeId || d.owner_office_id === myOfficeId) ? "created" : "shared")),
          ...reqIn.map((r: any) => reqToLibraryItem(r))
        ];

        if (!isNextPage) {
          setRows(items);
          setAllDocPage(1);
          setAllReqPage(1);
        } else {
          setRows(prev => [...prev, ...items]);
          if (docRes) setAllDocPage(p => p + 1);
          if (reqRes) setAllReqPage(p => p + 1);
        }
        return items;
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load library.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, isAdmin, page, allDocPage, allReqPage, allDocHasMore, allReqHasMore, myOfficeId, role]);

  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    await loadData(false, true);
    return { changed: true }; 
  });

  useEffect(() => {
    loadData(false);
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, loadData]);

  const { refreshing: remoteRefreshing } = usePageBurstRefresh(() => loadData(false, true));

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "ALL") count++;
    if (sourceFilter !== "all" && tab === "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (officeFilter) count++;
    if (batchFilter) count++;
    return count;
  }, [typeFilter, sourceFilter, dateFrom, dateTo, officeFilter, batchFilter, tab]);

  const availableOffices = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
        const off = row.office || row.ownerOffice || row.office_name; 
        if (off) {
            const id = off.id || (tab === "requested" ? row.office_id : null);
            const code = off.code || off.name || row.office_code || row.office_name;
            if (id && code) map.set(id, code);
        }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ value: String(id), label }));
  }, [rows, tab]);

  const availableBatches = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
        if (row.request_id || row.batch_id) {
            map.set(row.request_id || row.batch_id, row.batch_title || `Batch #${row.request_id || row.batch_id}`);
        }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const baseDocColumns = useMemo(() => buildBaseDocColumns(), []);
  const sharedColumns = useMemo(() => buildSharedColumns(), []);
  const requestedColumns = useMemo(() => buildRequestedColumns(isAdmin || isQA(role)), [isAdmin, role]);
  const allColumns = useMemo(() => buildAllColumns(), []);

  const handleRowClick = (row: any) => {
    const libCrumbs = [{ label: "Library", to: "/documents" }];
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

  return (
    <PageFrame
      title="Document Library"
      right={
        <PageActions>
          <RefreshAction onRefresh={refresh} loading={isRefreshing || remoteRefreshing} />
          <button
            type="button"
            onClick={() => navigate("/archive")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-300 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Archive library</span>
          </button>
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
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto hide-scrollbar">
        {(isAuditor(role) ? (["all"] as LibTab[]) : (["all", "created", "requested", "shared"] as LibTab[])).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)} className={tabCls(tab === t)}>
            {TAB_ICONS[t]}
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => { setQ(val); setPage(1); }}
        placeholder="Search library..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => { setQ(""); setTypeFilter("ALL"); setDateFrom(""); setDateTo(""); setSourceFilter("all"); setPage(1); }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                <SelectDropdown
                  value={typeFilter}
                  onChange={(val) => setTypeFilter((val as string) || "ALL")}
                  className="w-full"
                  options={[{ value: "ALL", label: "All Types" }, { value: "INTERNAL", label: "Internal" }, { value: "EXTERNAL", label: "External" }, { value: "FORMS", label: "Forms" }]}
                />
              </div>
              {tab === "all" && !isAuditor(role) && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Source</label>
                  <SelectDropdown
                    value={sourceFilter}
                    onChange={(val) => setSourceFilter((val as any) || "all")}
                    className="w-full"
                    options={[{ value: "all", label: "All Sources" }, { value: "doc", label: "Docs only" }, { value: "req", label: "Reqs only" }]}
                  />
                </div>
              )}
            </div>
            <DateRangeInput from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
        }
      >
        {tab !== "requested" && (
          <SelectDropdown
            value={typeFilter}
            onChange={(val) => setTypeFilter((val as string) || "ALL")}
            className="w-32"
            options={[{ value: "ALL", label: "All Types" }, { value: "INTERNAL", label: "Internal" }, { value: "EXTERNAL", label: "External" }, { value: "FORMS", label: "Forms" }]}
          />
        )}
        {tab === "all" && !isAuditor(role) && (
          <SelectDropdown
            value={sourceFilter}
            onChange={(val) => setSourceFilter((val as any) || "all")}
            className="w-36"
            options={[{ value: "all", label: "All Sources" }, { value: "doc", label: "Docs only" }, { value: "req", label: "Reqs only" }]}
          />
        )}
        {(tab === "all" || tab === "created" || tab === "shared" || (tab === "requested" && (isAdmin || isQA(role)))) && (
          <SelectDropdown
            value={officeFilter}
            onChange={(val) => { setOfficeFilter(val as string); setPage(1); }}
            className="w-40"
            placeholder="Office"
            options={[{ value: "", label: "All Offices" }, ...availableOffices]}
          />
        )}
        {tab === "requested" && (
          <SelectDropdown
            value={batchFilter}
            onChange={(val) => { setBatchFilter(val as string); setPage(1); }}
            className="w-40"
            placeholder="Batch"
            options={[{ value: "", label: "All Batches" }, ...availableBatches]}
          />
        )}
        <DateRangeInput from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </SearchFilterBar>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<any>
          bare
          className="h-full"
          columns={tab === "created" ? baseDocColumns : tab === "shared" ? sharedColumns : tab === "requested" ? requestedColumns : allColumns}
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
          gridTemplateColumns={tab === "created" ? "120px minmax(200px, 1fr) 110px 100px 100px 70px 120px" : tab === "shared" ? "120px minmax(200px, 1fr) 110px 90px 100px 70px 110px" : tab === "requested" ? "minmax(250px, 1fr) 130px 110px" : "110px minmax(200px, 1fr) 100px 100px 100px 110px 110px"}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => { setSortBy(key as any); setSortDir(dir); }}
          mobileRender={(r) => {
            const isAllTab = tab === "all";
            const isReqTab = tab === "requested";
            const title = isAllTab ? r.title : (isReqTab ? (r.item_title ?? r.batch_title) : r.title);
            const code = isAllTab ? r.code : (!isReqTab ? r.code : null);
            const office = isAllTab ? (typeof r.office === "object" ? r.office?.code : r.office) : (isReqTab ? r.office_code : (r.office?.code || r.ownerOffice?.code));
            const date = isAllTab ? (r.dateDistributed || r.date) : (isReqTab ? r.created_at : (r.effective_date || r.created_at));
            const type = isAllTab ? (r.doctype || r.mode) : (isReqTab ? (r.batch_mode || "REQUEST") : r.doctype);
            const version = !isReqTab ? r.version_number : null;
            return (
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">{type}</span>
                    {version && <span className="text-[10px] font-medium text-slate-400">v{version}</span>}
                  </div>
                  <span className="text-[10px] text-slate-400 tabular-nums">{formatDate(date)}</span>
                </div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">{title}</p>
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                  <div className="flex items-center gap-2 truncate">
                    {code && <span className="text-[10px] font-mono text-slate-400 shrink-0">{code}</span>}
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{office || "—"}</span>
                  </div>
                  {isAllTab && r.source && <span className="text-[9px] font-bold uppercase text-brand-600 dark:text-brand-400 shrink-0">{r.source}</span>}
                </div>
              </div>
            );
          }}
          emptyMessage={tab === "requested" ? "No accepted requests found." : "No documents found in this section."}
        />
      </div>
    </PageFrame>
  );
}
