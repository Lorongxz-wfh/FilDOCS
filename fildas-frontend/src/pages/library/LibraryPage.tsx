import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import {
  getUserRole,
  isQA,
  isAuditor,
} from "../../lib/roleFilters";
import { getAuthUser } from "../../lib/auth";
import { useAdminDebugMode } from "../../hooks/useAdminDebugMode";
import Table from "../../components/ui/Table";
import SelectDropdown from "../../components/ui/SelectDropdown";
import Alert from "../../components/ui/Alert";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { PageActions, CreateAction } from "../../components/ui/PageActions";
import SearchFilterBar from "../../components/ui/SearchFilterBar";
import { markWorkQueueSession } from "../../lib/guards/RequireFromWorkQueue";
import { Archive, Library, Trash2, CheckSquare, Download } from "lucide-react";
import { Tabs } from "../../components/ui/Tabs";
import { TabBar as SubTabBar } from "../../components/documentRequests/shared";
import DeletedItemsView from "../../components/admin/DeletedItemsView";
import { useSmartRefresh } from "../../hooks/useSmartRefresh";
import { motion, AnimatePresence } from "framer-motion";
import { useBulkActions } from "../../hooks/useBulkActions";
import BulkActionBar from "../../components/ui/BulkActionBar";
import BulkDownloadModal from "../../components/ui/BulkDownloadModal";
import axios from "../../services/api";


import {
  type LibTab,
  type LibraryItem,
  docToLibraryItem,
  reqToLibraryItem,
  TAB_LABELS,
  TAB_ICONS,
} from "../../components/library/documentLibraryTypes";
import {
  listDocumentsPage,
  deleteDocument,
  listOffices,
} from "../../services/documents";
import {
  listDocumentRequestIndividual,
  deleteDocumentRequest,
} from "../../services/documentRequests";
import { useToast } from "../../components/ui/toast/ToastContext";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import { buildCreatedColumns, buildSharedColumns, buildRequestedColumns, buildAllColumns } from "../../components/library/DocumentLibraryColumns";

export default function LibraryPage() {
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

  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");
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
  const [, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { push } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingType, setDeletingType] = useState<"doc" | "req" | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [trashRefreshTrigger, setTrashRefreshTrigger] = useState(0);

  const {
    selectedIds,
    isSelectMode,
    setIsSelectMode,
    toggleRow,
    toggleAll,
    clearSelection,
    selectionCount,
    getActionableCount,
    getActionableItems,
  } = useBulkActions<any>(
    rows,
    (r) => r.id || r.docId || r.reqId,
    (r, _action) => {
      if (_action === "download") return true;
      if (_action === "delete") return r.can_delete;
      if (_action === "archive") return r.can_archive;
      return true;
    }
  );

  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{
    type: "archive" | "delete";
    actionableIds: (string | number)[];
    skippedCount: number;
  } | null>(null);

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

  const handleBulkDelete = () => {
    const actionable = getActionableItems("delete");
    const totalSelected = selectionCount;
    const actionableIds = actionable.map(r => r.id || r.docId || r.reqId);

    if (actionableIds.length === 0) {
      push({ type: "warning", title: "No Actionable Items", message: "None of the selected items can be deleted." });
      return;
    }

    setBulkConfirm({
      type: "delete",
      actionableIds,
      skippedCount: totalSelected - actionableIds.length
    });
  };

  const handleBulkArchive = () => {
    const actionable = getActionableItems("archive");
    const totalSelected = selectionCount;
    const actionableIds = actionable.map(r => r.id || r.docId || r.reqId);

    if (actionableIds.length === 0) {
      push({ type: "warning", title: "No Actionable Items", message: "None of the selected items can be archived." });
      return;
    }

    setBulkConfirm({
      type: "archive",
      actionableIds,
      skippedCount: totalSelected - actionableIds.length
    });
  };

  const executeBulkAction = async () => {
    if (!bulkConfirm) return;
    const { type, actionableIds } = bulkConfirm;

    setIsBulkProcessing(true);
    setBulkConfirm(null);
    try {
      const endpoint = type === "archive" ? "/bulk/documents/archive" : "/bulk/documents/delete";
      const res = await axios.post(endpoint, { ids: actionableIds });

      push({
        type: "success",
        title: `Bulk ${type === "archive" ? "Archive" : "Delete"}`,
        message: res.data.message
      });

      setRows(prev => prev.filter(r => !actionableIds.includes(r.id || r.docId || r.reqId)));
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({
        type: "error",
        title: `Bulk ${type === "archive" ? "Archive" : "Delete"} Failed`,
        message: e.response?.data?.message || e.message
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDownload = async (filename: string) => {
    const ids = Array.from(selectedIds).join(",");
    setBulkDownloadOpen(false);
    const url = `/api/bulk/documents/download?ids=${ids}&filename=${filename}`;

    try {
      const res = await axios.get(url, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', filename.endsWith('.zip') ? filename : `${filename}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      push({ type: "success", title: "Download Started", message: "Your ZIP archive is being downloaded." });
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Download Failed", message: "Failed to generate ZIP archive." });
    }
  };

  const [allDocPage, setAllDocPage] = useState(1);
  const [allReqPage, setAllReqPage] = useState(1);
  const [allDocHasMore, setAllDocHasMore] = useState(true);
  const [allReqHasMore, setAllReqHasMore] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const [offices, setOffices] = useState<any[]>([]);

  useEffect(() => {
    listOffices().then(data => {
      const formatted = data.map(o => ({ value: String(o.id), label: o.code || o.name }));
      setOffices(formatted);
    });
  }, []);

  const loadData = useCallback(async (isNextPage = false, silent = false) => {
    let targetPage = 1;
    setPage(prev => {
      targetPage = isNextPage ? prev + 1 : 1;
      return targetPage;
    });
    if (!isNextPage && !silent) {
      setInitialLoading(true);
      setRows([]);
    }
    if (!silent) setLoading(true);
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
        setHasMore(!!res.meta && res.meta.current_page < res.meta.last_page);
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
          batch_type: (batchFilter === "multi_office" || batchFilter === "multi_doc") ? batchFilter : undefined,
        });
        const incoming = Array.isArray(res.data) ? res.data : [];
        setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
        setHasMore((res.current_page ?? 0) < (res.last_page ?? 0));
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
            batch_type: (batchFilter === "multi_office" || batchFilter === "multi_doc") ? batchFilter : undefined,
          }) : Promise.resolve(null)
        ]);

        const docIn = docRes?.data ?? [];
        const reqIn = Array.isArray(reqRes?.data) ? reqRes.data : [];
        const docMore = docRes && docRes.meta ? (docRes.meta.current_page < docRes.meta.last_page) : allDocHasMore;
        const reqMore = reqRes ? ((reqRes.current_page ?? 0) < (reqRes.last_page ?? 0)) : allReqHasMore;

        setAllDocHasMore(docMore);
        setAllReqHasMore(reqMore);
        setHasMore(!!(docMore || reqMore));

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
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, isAdmin, myOfficeId, role]);

  useSmartRefresh(async () => {
    await loadData(false, true);

    if (activeTab === "deleted") {
      setTrashRefreshTrigger(prev => prev + 1);
    }
    
    return { changed: true };
  });

  useEffect(() => {
    if (activeTab === "active") {
      loadData(false);
    }
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, loadData, activeTab]);


  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "all") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (officeFilter) count++;
    if (batchFilter) count++;
    return count;
  }, [typeFilter, dateFrom, dateTo, officeFilter, batchFilter]);

  const columns = useMemo(() => {
    const delDoc = adminDebugMode ? (id: number) => { setDeletingId(id); setDeletingType("doc"); } : undefined;
    const delReq = adminDebugMode ? (id: number) => { setDeletingId(id); setDeletingType("req"); } : undefined;
    const delAll = adminDebugMode ? (id: number) => {
      setDeletingId(id);
      const row = rows.find(r => (r.docId || r.reqId || r.id || r.request_id) === id);
      setDeletingType(row?.docId ? "doc" : "req");
    } : undefined;

    const baseCols = tab === "created" ? buildCreatedColumns(delDoc) : 
                     tab === "shared" ? buildSharedColumns(delDoc) : 
                     tab === "requested" ? buildRequestedColumns(!!isAdmin || isQA(role), delReq) : 
                     buildAllColumns(delAll);
    
    return baseCols;
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
      {isAdmin && adminDebugMode && (
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-1 mb-px">
          <SubTabBar
            tabs={[
              { value: "active", label: "Active Library", icon: <Library size={12} /> },
              { value: "deleted", label: "Deleted", icon: <Trash2 size={12} /> },
            ]}
            active={activeTab}
            onChange={(val: any) => setActiveTab(val)}
          />
        </div>
      )}

      {activeTab === "deleted" ? (
        <div className="flex-1 min-h-0">
          <DeletedItemsView 
            type="documents" 
            onRestored={() => setActiveTab("active")} 
            refreshTrigger={trashRefreshTrigger}
          />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shrink-0 pr-4">
            <Tabs
              tabs={TABS}
              activeTab={tab}
              onChange={(key) => setTab(key as LibTab)}
              id="library"
              className="border-none"
            />
            {activeTab === "active" && (
              <Button
                variant={isSelectMode ? "primary" : "ghost"}
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) clearSelection();
                }}
                className="flex items-center gap-2 h-8"
              >
                <CheckSquare size={14} />
                <span>{isSelectMode ? "Cancel" : "Select"}</span>
              </Button>
            )}
          </div>

          <SearchFilterBar
            search={q}
            setSearch={(val) => { setQ(val); setPage(1); }}
            placeholder="Search library..."
            activeFiltersCount={activeFiltersCount}
            onClear={() => { 
              setQ(""); 
              setTypeFilter("all"); 
              setDateFrom(""); 
              setDateTo(""); 
              setOfficeFilter("");
              setBatchFilter("");
              setPage(1); 
            }}
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
                <DateRangePicker from={dateFrom} to={dateTo} onSelect={(r: any) => { setDateFrom(r.from); setDateTo(r.to); }} />
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
                options={[{ value: "", label: "All Offices" }, ...offices]}
              />
            )}
            {tab === "requested" && (
              <SelectDropdown
                searchable
                value={batchFilter}
                onChange={(val) => { setBatchFilter(val as string); setPage(1); }}
                className="w-40"
                placeholder="Batch"
                options={[{ value: "multi_office", label: "Multi-Office" }, { value: "multi_doc", label: "Multi-Doc" }]}
              />
            )}
            <DateRangePicker from={dateFrom} to={dateTo} onSelect={(r: any) => { setDateFrom(r.from); setDateTo(r.to); }} />
          </SearchFilterBar>

          {error && <Alert variant="danger" className="mb-4 mx-4">{error}</Alert>}

          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            <AnimatePresence mode="popLayout">
              <motion.div
                key={tab + qDebounced + typeFilter + dateFrom + dateTo + officeFilter + batchFilter}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
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
                  onLoadMore={() => setPage(p => p + 1)}
                  renderRowDetails={undefined}
                  gridTemplateColumns={
                    tab === "created"
                      ? "45px 100px 90px minmax(160px, 1.2fr) 150px 80px 110px 50px 120px 40px"
                      : tab === "shared"
                      ? "45px 100px 90px minmax(160px, 1.2fr) 150px 80px 110px 50px 120px"
                      : tab === "requested"
                      ? "45px minmax(200px, 1fr) 100px 100px" + (isAdmin || isQA(role) ? " 40px" : "")
                      : "45px minmax(160px, 1.2fr) 150px 140px 110px 50px" + (adminDebugMode ? " 40px" : "")
                  }
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onSortChange={(key, dir) => { setSortBy(key as any); setSortDir(dir); setPage(1); }}
                  selectable={isSelectMode}
                  selectedIds={selectedIds}
                  onToggleRow={toggleRow}
                  onToggleAll={toggleAll}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

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
      <BulkActionBar
        selectedCount={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: "Download",
            icon: <Download size={14} />,
            onClick: () => setBulkDownloadOpen(true),
            variant: "secondary",
            count: selectionCount
          },
          {
            label: "Archive",
            icon: <Archive size={14} />,
            onClick: handleBulkArchive,
            variant: "secondary",
            count: getActionableCount("archive"),
            loading: isBulkProcessing
          },
          {
            label: "Delete",
            icon: <Trash2 size={14} />,
            onClick: handleBulkDelete,
            variant: "danger",
            count: getActionableCount("delete"),
            loading: isBulkProcessing
          }
        ]}
      />

      <BulkDownloadModal
        open={bulkDownloadOpen}
        onClose={() => setBulkDownloadOpen(false)}
        selectedCount={selectionCount}
        onConfirm={handleBulkDownload}
        defaultPrefix="Document_Library_Export"
      />

      <Modal
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        title={bulkConfirm?.type === "archive" ? "Confirm Bulk Archive" : "Confirm Bulk Deletion"}
        widthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkConfirm(null)}>Cancel</Button>
            <Button
              variant={bulkConfirm?.type === "delete" ? "danger" : "primary"}
              loading={isBulkProcessing}
              onClick={executeBulkAction}
            >
              Confirm {bulkConfirm?.type === "archive" ? "Archive" : "Delete"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className={`p-4 rounded-xl border ${bulkConfirm?.type === "delete"
              ? "bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20"
              : "bg-brand-50 border-brand-100 dark:bg-brand-900/10 dark:border-brand-900/20"
            }`}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {bulkConfirm?.actionableIds.length} items will be {bulkConfirm?.type === "archive" ? "archived" : "deleted"}.
            </p>
            {bulkConfirm && bulkConfirm.skippedCount > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {bulkConfirm.skippedCount} items were skipped as they are not in a valid state for this action.
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {bulkConfirm?.type === "delete"
              ? "This will soft-delete the records. They will be removed from the active library but can be restored by an administrator."
              : "Archived documents will be moved to the Archive section and will no longer be visible in the active library."
            }
          </p>
        </div>
      </Modal>
    </PageFrame>
  );
}
