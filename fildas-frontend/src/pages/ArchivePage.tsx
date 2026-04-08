import { useCallback, useEffect, useMemo, useState } from "react";
import { 
  listDocumentsPage,
  deleteDocument
} from "../services/documents";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Table from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import { formatDate } from "../utils/formatters";
import { buildArchiveColumns } from "./documentLibrary/DocumentLibraryColumns";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import { useToast } from "../components/ui/toast/ToastContext";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import SelectDropdown from "../components/ui/SelectDropdown";
import DateRangeInput from "../components/ui/DateRangeInput";
import { useBulkActions } from "../hooks/useBulkActions";
import BulkActionBar from "../components/ui/BulkActionBar";
import BulkDownloadModal from "../components/ui/BulkDownloadModal";
import axios from "../services/api";
import { Trash2, Download, RotateCcw, CheckSquare } from "lucide-react";

export default function ArchivePage() {
  const navigate = useNavigate();
  const adminDebugMode = useAdminDebugMode();
  const { push } = useToast();

  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [bulkConfirm, setBulkConfirm] = useState<{
    type: "restore" | "delete";
    itemIds: (string | number)[];
    skippedCount: number;
  } | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteDocument(deletingId);
      push({ type: "success", title: "Deleted", message: "Archived document has been soft-deleted." });
      setRows(prev => prev.filter(r => r.id !== deletingId));
      setDeletingId(null);
    } catch (e: any) {
      push({ type: "error", title: "Delete failed", message: e.message });
    } finally {
      setIsDeleting(false);
    }
  };
  
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "title">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [officeFilter, setOfficeFilter] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");

  const [rows, setRows] = useState<any[]>([]);

  const {
    selectedIds,
    selectionCount,
    toggleRow,
    toggleAll,
    clearSelection,
    getActionableItems,
  } = useBulkActions<any>(rows, (r) => r.id, (r, action) => {
    if (action === "restore") {
      const status = r.latestVersion?.status;
      return !["Cancelled", "Superseded"].includes(status);
    }
    return true;
  });

  const handleBulkRestore = () => {
    const actionable = getActionableItems("restore");
    const totalSelected = selectionCount;
    const actionableIds = actionable.map(r => r.id);
    
    if (actionableIds.length === 0) {
      push({ type: "warning", title: "No Actionable Items", message: "Cancelled or Superseded documents cannot be restored." });
      return;
    }

    setBulkConfirm({ 
      type: "restore", 
      itemIds: actionableIds,
      skippedCount: totalSelected - actionableIds.length
    });
  };

  const handleBulkDelete = () => {
    const itemIds = Array.from(selectedIds);
    setBulkConfirm({ 
      type: "delete", 
      itemIds,
      skippedCount: 0 
    });
  };

  const executeBulkAction = async () => {
    if (!bulkConfirm) return;
    const { type, itemIds } = bulkConfirm;
    setIsBulkProcessing(true);
    try {
      const endpoint = type === "restore" ? "/bulk/documents/unarchive" : "/bulk/documents/delete";
      const res = await axios.post(endpoint, { ids: itemIds });
      push({ type: "success", title: `Bulk ${type === "restore" ? "Restore" : "Delete"}`, message: res.data.message });
      setRows(prev => prev.filter(r => !itemIds.includes(r.id)));
      clearSelection();
      setIsSelectMode(false);
      setBulkConfirm(null);
    } catch (e: any) {
      push({ type: "error", title: `Bulk ${type === "restore" ? "Restore" : "Delete"} Failed`, message: e.response?.data?.message || e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

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
      push({ type: "success", title: "Download Started", message: "Your batch export is being prepared." });
      setBulkDownloadOpen(false);
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Download Failed", message: e.message });
    }
  };

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "ALL") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    if (officeFilter) count++;
    if (reasonFilter) count++;
    return count;
  }, [typeFilter, dateFrom, dateTo, officeFilter, reasonFilter]);

  const availableOffices = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
      const off = row.office || row.ownerOffice || row.office_name;
      if (off) {
        const id = off.id ?? null;
        const code = off.code || off.name || "—";
        if (id && code) map.set(id, code);
      }
    });
    return Array.from(map.entries()).map(([id, label]) => ({ value: String(id), label }));
  }, [rows]);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadData = useCallback(async (isNextPage = false) => {
    const targetPage = isNextPage ? page + 1 : 1;
    if (!isNextPage) {
      setInitialLoading(true);
      setRows([]);
    }

    setLoading(true);
    setError(null);

    try {
      const res = await listDocumentsPage({
        page: targetPage,
        perPage: 15,
        q: qDebounced.trim() || undefined,
        space: "archive",
        doctype: typeFilter !== "ALL" ? typeFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy === "created_at" ? "created_at" : "title",
        sort_dir: sortDir,
        owner_office_id: officeFilter ? Number(officeFilter) : undefined,
        archive_reason: reasonFilter || undefined,
      });

      const incoming = res.data ?? [];
      setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
      setHasMore((res.meta?.current_page ?? 0) < (res.meta?.last_page ?? 0));
      setPage(targetPage);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load archive.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, page, officeFilter, reasonFilter]);

  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, officeFilter, reasonFilter]);

  const { refreshing } = usePageBurstRefresh(() => loadData(false));

  const columns = useMemo(() => {
    return buildArchiveColumns(adminDebugMode ? (id: number) => setDeletingId(id) : undefined);
  }, [adminDebugMode]);

  const handleRowClick = (row: any) => {
    navigate(`/documents/${row.id}/view`, { 
      state: { 
        from: "/archive",
        breadcrumbs: [{ label: "Archive", to: "/archive" }] 
      } 
    });
  };

  return (
    <PageFrame
      title="Archive"
      onBack={() => navigate("/documents")}
      right={
        <PageActions>
          <RefreshAction
            onRefresh={async () => { await loadData(false); }}
            loading={refreshing || loading}
          />
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 h-full"
    >
      <div className="flex items-center justify-end border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shrink-0 px-4 h-12">
        <Button
          variant={isSelectMode ? "primary" : "ghost"}
          size="sm"
          onClick={() => {
            setIsSelectMode(!isSelectMode);
            if (isSelectMode) clearSelection();
          }}
          className="flex items-center gap-2"
        >
          <CheckSquare size={14} />
          <span>{isSelectMode ? "Cancel" : "Select"}</span>
        </Button>
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search archive..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setQ("");
          setTypeFilter("ALL");
          setDateFrom("");
          setDateTo("");
          setOfficeFilter("");
          setReasonFilter("");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
             <div className="grid grid-cols-2 gap-2">
              <SelectDropdown
                value={officeFilter}
                onChange={(val) => { setOfficeFilter(val as string); setPage(1); }}
                placeholder="Office"
                options={[{ value: "", label: "All Offices" }, ...availableOffices]}
              />
              <SelectDropdown
                value={reasonFilter}
                onChange={(val) => { setReasonFilter(val as string); setPage(1); }}
                placeholder="Reason"
                options={[
                  { value: "", label: "All Reasons" },
                  { value: "Archived", label: "Archived" },
                  { value: "Superseded", label: "Superseded" },
                  { value: "Cancelled", label: "Cancelled" },
                ]}
              />
            </div>
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
          value={officeFilter}
          onChange={(val) => { setOfficeFilter(val as string); setPage(1); }}
          placeholder="Office"
          className="w-40"
          options={[{ value: "", label: "All Offices" }, ...availableOffices]}
        />
        <SelectDropdown
          value={reasonFilter}
          onChange={(val) => { setReasonFilter(val as string); setPage(1); }}
          placeholder="Reason"
          className="w-40"
          options={[
            { value: "", label: "All Reasons" },
            { value: "Archived", label: "Archived" },
            { value: "Superseded", label: "Superseded" },
            { value: "Cancelled", label: "Cancelled" },
          ]}
        />
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

        <DateRangeInput
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
      </SearchFilterBar>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<any>
          bare
          className="h-full"
          columns={columns}
          rows={rows}
          rowKey={(r, idx) => `archived-${r.id || idx}`}
          loading={loading}
          initialLoading={initialLoading}
          emptyMessage={q || typeFilter !== "ALL" || dateFrom || dateTo || officeFilter || reasonFilter ? "No archived documents match your filters." : "No archived documents found."}
          onRowClick={handleRowClick}
          hasMore={hasMore}
          onLoadMore={() => loadData(true)}
          gridTemplateColumns={adminDebugMode ? "50px 110px minmax(200px, 1fr) 90px 80px 70px 120px 40px" : "50px 110px minmax(200px, 1fr) 90px 80px 70px 120px"}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as any);
            setSortDir(dir);
          }}
          selectable={isSelectMode}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
          mobileRender={(r) => (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                  {r.doctype}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {formatDate(r.created_at)}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                {r.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">{r.code || "No Code"}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{r.ownerOffice?.code || "—"}</span>
              </div>
            </div>
          )}
        />
      </div>

      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirm Deletion"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="danger" loading={isDeleting} onClick={handleDelete}>Delete Permanently</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to delete this archived document? This action is reversible by system administrators but will remove the item from the archive list.
        </p>
      </Modal>

      <BulkActionBar 
        selectedCount={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: `Restore (${selectionCount})`,
            icon: <RotateCcw className="h-4 w-4" />,
            onClick: handleBulkRestore,
            variant: "primary"
          },
          {
            label: "Download",
            icon: <Download className="h-4 w-4" />,
            onClick: () => setBulkDownloadOpen(true),
            variant: "ghost"
          },
          {
            label: "Delete",
            icon: <Trash2 className="h-4 w-4" />,
            onClick: handleBulkDelete,
            variant: "danger"
          }
        ]}
      />

      <BulkDownloadModal 
        open={bulkDownloadOpen}
        onClose={() => setBulkDownloadOpen(false)}
        selectedCount={selectionCount}
        onConfirm={handleBulkDownload}
        defaultPrefix="Archived_Documents_Export"
      />

      <Modal
        open={!!bulkConfirm}
        onClose={() => setBulkConfirm(null)}
        title={bulkConfirm?.type === "restore" ? "Confirm Bulk Restore" : "Confirm Bulk Deletion"}
        widthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setBulkConfirm(null)}>Cancel</Button>
            <Button 
              variant={bulkConfirm?.type === "delete" ? "danger" : "primary"} 
              loading={isBulkProcessing} 
              onClick={executeBulkAction}
            >
              Confirm {bulkConfirm?.type === "restore" ? "Restore" : "Delete"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <div className={`p-4 rounded-xl border ${
            bulkConfirm?.type === "delete" 
              ? "bg-rose-50 border-rose-100 dark:bg-rose-900/10 dark:border-rose-900/20" 
              : "bg-brand-50 border-brand-100 dark:bg-brand-900/10 dark:border-brand-900/20"
          }`}>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {bulkConfirm?.itemIds.length} items will be {bulkConfirm?.type === "restore" ? "restored to library" : "soft-deleted"}.
            </p>
            {bulkConfirm && bulkConfirm.skippedCount > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {bulkConfirm.skippedCount} items were skipped as they cannot be restored (Cancelled/Superseded).
              </p>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {bulkConfirm?.type === "restore" 
              ? "Restored documents will move back from the archive to the active document library."
              : "Deleted documents will move to the trash and can only be accessed by system administrators."
            }
          </p>
        </div>
      </Modal>
    </PageFrame>
  );
}
