import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmartRefresh } from "../../hooks/useSmartRefresh";
import { useNavigate } from "react-router-dom";
import { listDocumentsPage, deleteDocument, listOffices, type Document } from "../../services/documents";
import { getUserRole, isQA, isSysAdmin } from "../../lib/roleFilters";
import type { Office } from "../../services/types";
import { useAdminDebugMode } from "../../hooks/useAdminDebugMode";
import { useToast } from "../../components/ui/toast/ToastContext";
import { CheckSquare, Download, Trash2, LayoutList, CheckCircle2, SlidersHorizontal, Search, X } from "lucide-react";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import PageFrame from "../../components/layout/PageFrame";
import Table, { type TableColumn } from "../../components/ui/Table";
import Alert from "../../components/ui/Alert";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import { formatDate } from "../../utils/formatters";
import SelectDropdown from "../../components/ui/SelectDropdown";
import { Tabs } from "../../components/ui/Tabs";
import { PageActions, CreateAction } from "../../components/ui/PageActions";
import { StatusBadge } from "../../components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import { useBulkActions } from "../../hooks/useBulkActions";
import BulkActionBar from "../../components/ui/BulkActionBar";
import BulkDownloadModal from "../../components/ui/BulkDownloadModal";
import axios from "../../services/api";

type WFTab = "all" | "distributed";

const TABS: { key: WFTab; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <LayoutList className="h-3.5 w-3.5" /> },
  { key: "distributed", label: "Distributed", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];



export default function WorkflowListPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  const canSeeAll = isQA(role) || isSysAdmin(role) || role === "ADMIN";
  const isAdmin = role === "ADMIN" || isSysAdmin(role);
  const adminDebugMode = useAdminDebugMode();
  const canCreate = isQA(role) || role === "OFFICE_STAFF" || role === "OFFICE_HEAD" || (isAdmin && adminDebugMode);
  const showOffice = canSeeAll;

  const [tab, setTab] = useState<WFTab>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [phaseFilter, setPhaseFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "created_at" | "code" | "updated_at" | "distributed_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [rows, setRows] = useState<Document[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const [allOffices, setAllOffices] = useState<Office[]>([]);
  const hasMoreRef = useRef(true);
  const firstDocIdRef = useRef<number | null>(null);

  const { push } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState<number[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteDocument(deletingId);
      push({ type: "success", title: "Deleted", message: "Workflow record has been soft-deleted." });
      setRows(prev => prev.filter(r => r.id !== deletingId));
      setDeletingId(null);
    } catch (e: any) {
      push({ type: "error", title: "Delete failed", message: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const {
    selectedIds,
    isSelectMode,
    setIsSelectMode,
    selectionCount,
    toggleRow,
    toggleAll,
    clearSelection,
  } = useBulkActions<Document>(rows, (r) => r.id);

  const handleBulkDownload = async (filename: string) => {
    try {
      const ids = Array.from(selectedIds).join(",");
      const response = await axios.get(`/bulk/documents/download?ids=${ids}&filename=${filename}`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = window.document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename.endsWith(".zip") ? filename : `${filename}.zip`);
      window.document.body.appendChild(link);
      link.click();
      link.remove();
      push({ type: "success", title: "Download Started", message: "Batch export is processing." });
      setBulkDownloadOpen(false);
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Download Failed", message: e.message });
    }
  };

  const handleBulkDelete = async () => {
    if (!bulkConfirmDelete) return;
    setIsBulkProcessing(true);
    try {
      const res = await axios.post("/bulk/documents/delete", { ids: bulkConfirmDelete });
      push({ type: "success", title: "Bulk Delete", message: res.data.message });
      setRows(prev => prev.filter(r => !bulkConfirmDelete.includes(r.id)));
      clearSelection();
      setIsSelectMode(false);
      setBulkConfirmDelete(null);
    } catch (e: any) {
      push({ type: "error", title: "Bulk Delete Failed", message: e.response?.data?.message || e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  useEffect(() => {
    listOffices().then(setAllOffices).catch(() => { });
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const statusParam = tab === "distributed" ? "Distributed" : undefined;

  const loadData = useCallback(async (isNextPage = false, silent = false) => {
    const targetPage = isNextPage ? page + 1 : 1;

    // If we're resetting to page 1, clear state
    if (!isNextPage && !silent) {
      setInitialLoading(true);
      hasMoreRef.current = true;
      setRows([]);
      setTotal(null);
    }
    
    if (!hasMoreRef.current && isNextPage) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const res = await listDocumentsPage({
        page: targetPage,
        perPage: 12,
        q: qDebounced.trim() || undefined,
        space: tab === "all" ? "workqueue" : "library",
        status: statusParam,
        phase: phaseFilter || undefined,
        owner_office_id: officeFilter ? Number(officeFilter) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      const incoming = res.data ?? [];
      if (targetPage === 1) {
        setRows(incoming);
        firstDocIdRef.current = incoming[0]?.id ?? null;
      } else {
        setRows((prev) => [...prev, ...incoming]);
      }

      const more = res.meta?.current_page < res.meta?.last_page;
      hasMoreRef.current = more;
      setHasMore(more);
      setPage(targetPage);
      if (res.meta?.total !== undefined) setTotal(res.meta.total);
      return { data: incoming };
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, statusParam, phaseFilter, officeFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  useSmartRefresh(async () => {
    const prevFirstId = firstDocIdRef.current;
    const result = await loadData(false, true);
    const newFirstId = result?.data?.[0]?.id ?? null;
    const changed = newFirstId !== prevFirstId;
    return { 
      changed,
      message: changed ? "Workflows synchronized." : "Workflows are up to date."
    };
  });
  useEffect(() => {
    loadData(false);
    // Explicitly exclude page to prevent reload loop on pagination
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, phaseFilter, officeFilter, dateFrom, dateTo, sortBy, sortDir]);

  const displayRows = useMemo(() => {
    return rows;
  }, [rows]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (phaseFilter) count++;
    if (officeFilter) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [phaseFilter, officeFilter, dateFrom, dateTo]);

  const officeOptions = useMemo(() => {
    return allOffices.map(off => ({ value: off.id, label: off.code || off.name }));
  }, [allOffices]);

  const columns: TableColumn<Document>[] = useMemo(() => {
    const isDistributed = tab === "distributed";
    const cols: TableColumn<Document>[] = [
      {
        key: "id",
        header: "ID",
        skeletonShape: "narrow",
        render: (doc) => (
          <span className="text-[10px] font-semibold font-mono text-slate-400 dark:text-slate-500">
            #{doc.id}
          </span>
        ),
      },
      {
        key: isDistributed ? "distributed" : "updated",
        header: isDistributed ? "Distributed" : "Last Activity",
        sortKey: isDistributed ? "distributed_at" : "updated_at",
        align: "left",
        render: (doc) => (
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
            {formatDate(isDistributed ? doc.distributed_at : doc.updated_at)}
          </span>
        ),
      },
      {
        key: "title",
        header: "Name",
        sortKey: "title",
        render: (doc) => <p className="text-sm font-semibold truncate text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors">{doc.title}</p>,
      },
    ];
    if (!isDistributed) {
      cols.push({
        key: "status",
        header: "Status",
        render: (doc) => <StatusBadge status={doc.status} />,
      });
    }
    if (showOffice) {
      cols.push({
        key: "owner",
        header: "Office",
        render: (doc: any) => <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{doc.office?.code || doc.ownerOffice?.code || "—"}</span>,
      });
    }
    cols.push(
      {
        key: "version",
        header: "Ver.",
        align: "center",
        render: (doc) => <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">v{doc.version_number}</span>,
      },
      {
        key: "created",
        header: "Date Created",
        sortKey: "created_at",
        align: "right",
        render: (doc) => <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 tabular-nums">{formatDate(doc.created_at)}</span>,
      }
    );

    if (adminDebugMode) {
      cols.push({
        key: "actions",
        header: "Action",
        align: "right",
        render: (doc) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(doc.id);
            }}
            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Delete Document"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )
      });
    }

    return cols;
  }, [showOffice, tab, adminDebugMode]);

  const gridTemplateColumns = useMemo(() => {
    const isDistributed = tab === "distributed";
    // Base columns: ID, Activity/Dist, Name
    let parts = ["50px", isDistributed ? "120px" : "110px", "minmax(160px, 1fr)"];

    // Status column (only if not distributed)
    if (!isDistributed) parts.push("140px");

    // Office column (if shown)
    if (showOffice) parts.push(isDistributed ? "110px" : "80px");

    // Version and Created
    parts.push("40px", "110px");

    // Debug actions
    if (adminDebugMode) parts.push("40px");

    return parts.join(" ");
  }, [tab, showOffice, adminDebugMode]);

  return (
    <PageFrame
      title="Workflow List"
      onBack={() => navigate("/work-queue")}
      breadcrumbs={[{ label: "Work Queue", to: "/work-queue" }]}
      right={
        <PageActions>
          {canCreate && (
            <CreateAction
              label="Create document"
              onClick={() => {
                navigate("/documents/create", { state: { fromWorkQueue: true } });
              }}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-transparent shrink-0 pr-4 gap-4 mb-2">
        <div className="flex-1 flex items-center min-w-0">
          <Tabs
            tabs={TABS}
            activeTab={tab}
            onChange={(key) => { 
              setTab(key as WFTab); 
              setPage(1); 
              setShowFilters(false);
            }}
            id="workflows"
            className="border-none"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden lg:flex items-center relative w-72 h-8 ml-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search workflows..."
              className="w-full pl-9 pr-8 h-8 text-[13px] bg-slate-50/50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500 dark:bg-surface-500/50 dark:border-surface-400/50 dark:text-slate-200"
            />
            {q && (
              <button
                type="button"
                onClick={() => { setQ(""); setPage(1); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>

          <Button
            variant={showFilters || activeFiltersCount > 0 ? "primary" : "outline"}
            size="sm"
            reveal
            onClick={() => setShowFilters(!showFilters)}
            className="h-8"
          >
            <SlidersHorizontal size={14} />
            <span>Filters</span>
            {activeFiltersCount > 0 && !showFilters && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-semibold text-white  ring-2 ring-white dark:ring-surface-600">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <Button
            variant={isSelectMode ? "primary" : "outline"}
            size="sm"
            reveal
            onClick={() => {
              setIsSelectMode(!isSelectMode);
              if (isSelectMode) clearSelection();
            }}
            className="h-8"
          >
            <CheckSquare size={14} />
            <span>{isSelectMode ? "Cancel" : "Select"}</span>
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden bg-slate-50/50 dark:bg-surface-600/50 border-b border-slate-200 dark:border-surface-400"
          >
            <div className="px-4 py-2.5 flex flex-wrap items-center gap-2">
              <SelectDropdown
                value={phaseFilter}
                onChange={(val) => { setPhaseFilter((val as string) || ""); setPage(1); }}
                className="w-40"
                options={[
                  { value: "", label: "All Phases" },
                  { value: "draft", label: "Draft" },
                  { value: "review", label: "Review" },
                  { value: "approval", label: "Approval" },
                  { value: "finalization", label: "Finalization" },
                  { value: "distributed", label: "Distributed" }
                ]}
              />
              <SelectDropdown
                value={officeFilter}
                onChange={(val) => { setOfficeFilter((val as string) || ""); setPage(1); }}
                searchable={true}
                className="w-48"
                options={[{ value: "", label: "All Offices" }, ...officeOptions]}
              />
              <DateRangePicker 
                from={dateFrom} 
                to={dateTo} 
                onSelect={(r: any) => { setDateFrom(r.from); setDateTo(r.to); setPage(1); }} 
              />
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setQ("");
                  setPhaseFilter("");
                  setOfficeFilter("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                className="text-[11px] h-8"
              >
                Clear all
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + qDebounced + phaseFilter + officeFilter + dateFrom + dateTo}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden"
          >
            <Table<Document>
              bare
              columns={columns}
              rows={displayRows}
              total={total ?? undefined}
              rowKey={(doc) => doc.id}
              initialLoading={initialLoading}
              loading={loading}
              gridTemplateColumns={gridTemplateColumns}
              onRowClick={(doc) => {
                if (isSelectMode) {
                  toggleRow(doc.id);
                  return;
                }
                navigate(`/documents/${doc.id}`, { state: { from: "/workflows" } });
              }}
              hasMore={hasMore}
              onLoadMore={() => loadData(true)}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={(key, dir) => { setSortBy(key as any); setSortDir(dir); }}
              selectable={isSelectMode}
              selectedIds={selectedIds}
              onToggleRow={toggleRow}
              onToggleAll={toggleAll}
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
            <Button variant="danger" loading={isDeleting} onClick={handleDelete}>Delete Document</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to delete this document workflow? This will soft-delete the record and remove it from active work queues across all offices.
        </p>
      </Modal>

      <BulkActionBar
        selectedCount={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: "Download",
            icon: <Download className="h-4 w-4" />,
            onClick: () => setBulkDownloadOpen(true),
            variant: "primary"
          },
          ...(adminDebugMode ? [{
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            onClick: () => setBulkConfirmDelete(Array.from(selectedIds) as number[]),
            variant: "danger" as const
          }] : [])
        ]}
      />

      <BulkDownloadModal
        open={bulkDownloadOpen}
        onClose={() => setBulkDownloadOpen(false)}
        selectedCount={selectionCount}
        onConfirm={handleBulkDownload}
        defaultPrefix="Workflow_Queue_Export"
      />

      <Modal
        open={!!bulkConfirmDelete}
        onClose={() => setBulkConfirmDelete(null)}
        title="Confirm Bulk Deletion"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkConfirmDelete(null)}>Cancel</Button>
            <Button variant="danger" loading={isBulkProcessing} onClick={handleBulkDelete}>Delete Workflows</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to delete {bulkConfirmDelete?.length} selected workflows? This will soft-delete the records and remove them from active work queues.
        </p>
      </Modal>
    </PageFrame>
  );
}
