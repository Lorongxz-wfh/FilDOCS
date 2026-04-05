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
import { Tabs } from "../components/ui/Tabs";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { motion, AnimatePresence } from "framer-motion";

import {
  type LibTab,
  type LibraryItem,
  docToLibraryItem,
  reqToLibraryItem,
} from "./documentLibrary/documentLibraryTypes";
import { 
  listDocumentsPage,
  deleteDocument,
} from "../services/documents";
import { 
  listDocumentRequestIndividual,
  deleteDocumentRequest,
} from "../services/documentRequests";
import { useToast } from "../components/ui/toast/ToastContext";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { buildCreatedColumns, buildSharedColumns, buildRequestedColumns, buildAllColumns } from "./documentLibrary/DocumentLibraryColumns";

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
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [officeFilter, setOfficeFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");

  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { push } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingType, setDeletingType] = useState<"doc" | "req" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deletingId || !deletingType) return;
    setIsDeleting(true);
    try {
      if (deletingType === "doc") {
        await deleteDocument(deletingId);
      } else {
        await deleteDocumentRequest(deletingId);
      }
      push({ type: "success", title: "Deleted", message: "Record has been soft-deleted." });
      setRows(prev => prev.filter(r => {
        const id = r.docId || r.reqId || r.request_id || r.id;
        return id !== deletingId;
      }));
      setDeletingId(null);
    } catch (e: any) {
      push({ type: "error", title: "Delete failed", message: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

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
        const params: any = {
          page: targetPage,
          perPage: 12,
          q: qDebounced.trim() || undefined,
          space: "library",
          status: "Distributed",
          scope,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
          owner_office_id: officeFilter ? Number(officeFilter) : undefined,
        };

        if (typeFilter !== "all") {
          params.doctype = typeFilter;
        }

        const res = await listDocumentsPage(params);
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
            doctype: typeFilter !== "all" ? typeFilter : undefined,
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
    if (typeFilter !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (officeFilter) count++;
    if (batchFilter) count++;
    return count;
  }, [typeFilter, dateFrom, dateTo, officeFilter, batchFilter]);

  const availableOffices = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
        // Doc items have ownerOffice or office. Req items have office_id/office_code.
        const offId = row.owner_office_id || row.office_id || row.ownerOffice?.id || row.office?.id;
        const offCode = row.office_code || row.ownerOffice?.code || row.office?.code || row.ownerOffice?.name;
        
        if (offId && offCode) {
            map.set(Number(offId), String(offCode));
        }
    });
    return Array.from(map.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const availableBatches = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
        if (row.request_id || row.batch_id) {
            map.set(row.request_id || row.batch_id, row.batch_title || `Batch #${row.request_id || row.batch_id}`);
        }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  const columns = useMemo(() => {
    const delDoc = adminDebugMode ? (id: number) => { setDeletingId(id); setDeletingType("doc"); } : undefined;
    const delReq = adminDebugMode ? (id: number) => { setDeletingId(id); setDeletingType("req"); } : undefined;
    const delAll = adminDebugMode ? (id: number) => { 
        setDeletingId(id);
        const row = rows.find(r => (r.docId || r.reqId || r.id || r.request_id) === id);
        setDeletingType(row?.docId ? "doc" : "req");
    } : undefined;

    if (tab === "created") return buildCreatedColumns(delDoc);
    if (tab === "shared") return buildSharedColumns(delDoc);
    if (tab === "requested") return buildRequestedColumns(!!isAdmin || isQA(role), delReq);
    return buildAllColumns(delAll);
  }, [tab, isAdmin, role, adminDebugMode, rows]);

  const handleRowClick = (row: any) => {
    const libCrumbs = [{ label: "Library", to: "/documents" }];
    if (tab === "created" || tab === "shared") {
      navigate(`/documents/${row.id}/view`, { state: { from: "/documents", breadcrumbs: libCrumbs } });
    } else if (tab === "requested") {
      if (row.row_type === "item") {
        navigate(`/documents/view/request/${row.request_id}/items/${row.item_id}`);
      } else {
        navigate(`/documents/view/request/${row.request_id}/recipients/${row.recipient_id}`);
      }
    } else {
      const item = row as LibraryItem;
      if (item.docId) {
        navigate(`/documents/${item.docId}/view`, { state: { from: "/documents", breadcrumbs: libCrumbs } });
      } else if (item.itemId) {
        navigate(`/documents/view/request/${item.reqId}/items/${item.itemId}`);
      } else if (item.reqId && item.recipId) {
        navigate(`/documents/view/request/${item.reqId}/recipients/${item.recipId}`);
      }
    }
  };

  const TABS = useMemo(() => {
    const base: LibTab[] = isAuditor(role) ? ["all"] : ["all", "created", "requested", "shared"];
    return base.map(t => ({
      key: t,
      label: TAB_LABELS[t],
      icon: <span className="shrink-0">{TAB_ICONS[t]}</span>
    }));
  }, [role]);

  return (
    <PageFrame
      title="Document Library"
      right={
        <PageActions>
          <RefreshAction onRefresh={refresh} loading={isRefreshing || remoteRefreshing} />
          <button
            type="button"
            onClick={() => navigate("/archive")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-300 transition-colors cursor-pointer"
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
        <Tabs 
          tabs={TABS} 
          activeTab={tab} 
          onChange={(key) => setTab(key as LibTab)} 
          id="library" 
          className="border-none"
        />
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => { setQ(val); setPage(1); }}
        placeholder="Search library..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => { setQ(""); setTypeFilter("all"); setDateFrom(""); setDateTo(""); setPage(1); }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
                <SelectDropdown
                  value={typeFilter}
                  onChange={(val) => setTypeFilter((val as string) || "all")}
                  className="w-full"
                  options={[{ value: "all", label: "All Types" }, { value: "internal", label: "Internal" }, { value: "external", label: "External" }, { value: "forms", label: "Forms" }]}
                />
              </div>
            </div>
            <DateRangeInput from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
          </div>
        }
      >
        {tab !== "requested" && (
          <SelectDropdown
            value={typeFilter}
            onChange={(val) => setTypeFilter((val as string) || "all")}
            className="w-32"
            options={[{ value: "all", label: "All Types" }, { value: "internal", label: "Internal" }, { value: "external", label: "External" }, { value: "forms", label: "Forms" }]}
          />
        )}
        {(tab === "all" || tab === "created" || tab === "shared" || (tab === "requested" && (isAdmin || isQA(role)))) && (
          <SelectDropdown
            searchable
            value={officeFilter}
            onChange={(val) => { setOfficeFilter(val as string); setPage(1); }}
            className="w-40"
            placeholder="Office"
            options={[{ value: "", label: "All Offices" }, ...availableOffices]}
          />
        )}
        {tab === "requested" && (
          <SelectDropdown
            searchable
            value={batchFilter}
            onChange={(val) => { setBatchFilter(val as string); setPage(1); }}
            className="w-40"
            placeholder="Batch"
            options={[{ value: "", label: "All Batches" }, ...availableBatches]}
          />
        )}
        <DateRangeInput from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />
      </SearchFilterBar>

      {error && <Alert variant="danger" className="mb-4 mx-4">{error}</Alert>}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + qDebounced + typeFilter + dateFrom + dateTo + officeFilter + batchFilter}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden"
          >
            <Table<any>
              bare
              className="h-full"
              columns={columns}
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
                (tab === "created" 
                  ? "50px 90px 95px minmax(200px, 1fr) 90px 80px 80px 50px 100px" 
                  : tab === "shared" 
                    ? "50px 90px 95px minmax(200px, 1fr) 90px 80px 80px 50px 100px" 
                    : tab === "requested" 
                      ? (isAdmin || isQA(role) ? "50px minmax(250px, 1fr) 110px 110px" : "50px minmax(250px, 1fr) 110px")
                      : "50px 90px 95px minmax(180px, 1fr) 80px 80px 80px 90px 100px") 
                + (adminDebugMode ? " 50px" : "")
              }
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
          </motion.div>
        </AnimatePresence>
      </div>

      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirm Deletion"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="danger" loading={isDeleting} onClick={handleDelete}>Delete Record</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to delete this {deletingType === "doc" ? "document" : "document request"}? 
          This will soft-delete the record, removing it from the active library.
        </p>
      </Modal>
    </PageFrame>
  );
}
