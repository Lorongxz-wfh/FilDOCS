import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { useNavigate } from "react-router-dom";
import { listDocumentsPage, deleteDocument, listOffices, type Document } from "../services/documents";
import { getUserRole, isQA, isSysAdmin } from "../lib/roleFilters";
import type { Office } from "../services/types";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import { useToast } from "../components/ui/toast/ToastContext";
import { CheckSquare, Download, Trash2, LayoutList, Activity, CheckCircle2 } from "lucide-react";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import { DateRangePicker } from "../components/ui/DateRangePicker";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { formatDate } from "../utils/formatters";
import SelectDropdown from "../components/ui/SelectDropdown";
import { Tabs } from "../components/ui/Tabs";
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";
import { StatusBadge } from "../components/ui/Badge";
import { motion, AnimatePresence } from "framer-motion";
import { useBulkActions } from "../hooks/useBulkActions";
import BulkActionBar from "../components/ui/BulkActionBar";
import BulkDownloadModal from "../components/ui/BulkDownloadModal";
import axios from "../services/api";

type WFTab = "all" | "active" | "distributed";

const TABS: { key: WFTab; label: string; icon: React.ReactNode }[] = [
  { key: "all", label: "All", icon: <LayoutList className="h-3.5 w-3.5" /> },
  { key: "active", label: "Active", icon: <Activity className="h-3.5 w-3.5" /> },
  { key: "distributed", label: "Distributed", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const TERMINAL_STATUSES = new Set(["distributed", "cancelled", "superseded"]);

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

  const [allOffices, setAllOffices] = useState<Office[]>([]);
  const hasMoreRef = useRef(true);
  const firstDocIdRef = useRef<number | null>(null);

  const { push } = useToast();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkConfirmDelete, setBulkConfirmDelete] = useState<number[] | null>(null);

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
    }

    if (!hasMoreRef.current && isNextPage) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const res = await listDocumentsPage({
        page: targetPage,
        perPage: 12,
        q: qDebounced.trim() || undefined,
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
      return { data: incoming };
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, statusParam, phaseFilter, officeFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    const prevFirstId = firstDocIdRef.current;
    const result = await loadData(false, true);
    const newFirstId = result?.data?.[0]?.id ?? null;
    return { changed: newFirstId !== prevFirstId };
  });
  useEffect(() => {
    loadData(false);
    // Explicitly exclude page to prevent reload loop on pagination
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, phaseFilter, officeFilter, dateFrom, dateTo, sortBy, sortDir]);

  const displayRows = useMemo(() => {
    if (tab === "active") {
      return rows.filter((d) => !TERMINAL_STATUSES.has(d.status?.toLowerCase() ?? ""));
    }
    return rows;
  }, [rows, tab]);

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
          <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
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
      {
        key: "code",
        header: "Code",
        sortKey: "code",
        render: (doc) => <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-surface-400/30 px-1.5 py-0.5 rounded-sm border border-slate-100 dark:border-surface-400/50">{doc.code || "—"}</span>,
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
        render: (doc: any) => <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{doc.office?.code || doc.ownerOffice?.code || "—"}</span>,
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
    // Base columns: ID, Activity/Dist, Name, Code
    let parts = ["50px", isDistributed ? "120px" : "110px", "minmax(200px, 1fr)", "100px"];

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
      title="Workflows"
      onBack={() => navigate("/work-queue")}
      breadcrumbs={[{ label: "Work Queue", to: "/work-queue" }]}
      right={
        <PageActions>
          <RefreshAction onRefresh={refresh} loading={isRefreshing} />
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
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shrink-0 pr-4">
        <Tabs
          tabs={TABS}
          activeTab={tab}
          onChange={(key) => { setTab(key as WFTab); setPage(1); }}
          id="workflows"
          className="border-none"
        />
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
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => { setQ(val); setPage(1); }}
        placeholder="Search title, code, office..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => { setQ(""); setPhaseFilter(""); setOfficeFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <SelectDropdown
                value={phaseFilter}
                onChange={(val) => { setPhaseFilter((val as string) || ""); setPage(1); }}
                options={[{ value: "", label: "All Phases" }, { value: "draft", label: "Draft" }, { value: "review", label: "Review" }, { value: "approval", label: "Approval" }, { value: "finalization", label: "Finalization" }, { value: "distributed", label: "Distributed" }]}
              />
              <SelectDropdown
                value={officeFilter}
                onChange={(val) => { setOfficeFilter((val as string) || ""); setPage(1); }}
                searchable={true}
                options={[{ value: "", label: "All Offices" }, ...officeOptions]}
              />
            </div>
            <DateRangePicker from={dateFrom} to={dateTo} onSelect={(r: any) => { setDateFrom(r.from); setDateTo(r.to); setPage(1); }} />
          </div>
        }
      >
        <SelectDropdown value={phaseFilter} onChange={(val) => { setPhaseFilter((val as string) || ""); setPage(1); }} className="w-32" options={[{ value: "", label: "All Phases" }, { value: "draft", label: "Draft" }, { value: "review", label: "Review" }, { value: "approval", label: "Approval" }, { value: "finalization", label: "Finalization" }, { value: "distributed", label: "Distributed" }]} />
        <SelectDropdown value={officeFilter} onChange={(val) => { setOfficeFilter((val as string) || ""); setPage(1); }} searchable={true} className="w-40" options={[{ value: "", label: "All Offices" }, ...officeOptions]} />
        <DateRangePicker from={dateFrom} to={dateTo} onSelect={(r: any) => { setDateFrom(r.from); setDateTo(r.to); setPage(1); }} />
      </SearchFilterBar>

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
              hasMore={tab !== "active" && hasMore}
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
