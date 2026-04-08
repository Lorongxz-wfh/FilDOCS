import React, { useState, useEffect, useMemo, useCallback } from "react";
import Table, { type TableColumn } from "../ui/Table";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { getTrashItems, restoreTrashItem, purgeTrashItem, type TrashType, type TrashItem } from "../../services/trashApi";
import SecurityVerificationModal from "./SecurityVerificationModal";
import { useToast } from "../ui/toast/ToastContext";
import { formatDate } from "../../utils/formatters";
import MiddleTruncate from "../ui/MiddleTruncate";
import { inputCls } from "../../utils/formStyles";

// Correct icons from lucide-react
import { 
  RotateCw, 
  Trash2 as TrashIcon, 
  Search as SearchIcon, 
  History as HistoryIcon, 
  RefreshCcw as RefreshIcon,
  CheckSquare
} from "lucide-react";
import { useBulkActions } from "../../hooks/useBulkActions";
import BulkActionBar from "../ui/BulkActionBar";
import axios from "../../services/api";

interface DeletedItemsViewProps {
  type: TrashType;
  onRestored?: () => void;
}

const DeletedItemsView: React.FC<DeletedItemsViewProps> = ({ type, onRestored }) => {
  const [rows, setRows] = useState<TrashItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  
  const toast = useToast();

  // Security Verification State
  const [securityModal, setSecurityModal] = useState<{
    open: boolean;
    action: "restore" | "purge" | "bulk-restore" | "bulk-purge";
    itemId?: number;
    itemName?: string;
  } | null>(null);

  const {
    selectedIds,
    isSelectMode,
    setIsSelectMode,
    toggleRow,
    toggleAll,
    clearSelection,
    selectionCount,
  } = useBulkActions<TrashItem>(
    rows,
    (r) => r.id,
    () => true // All items in trash are actionable by an admin
  );

  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setInitialLoading(true);
    setLoading(true);
    setError(null);
    try {
      const res = await getTrashItems(type, isInitial ? 1 : page, searchDebounced || undefined);
      const incoming = res.data ?? [];
      setRows((prev) => (isInitial ? incoming : [...prev, ...incoming]));
      setHasMore(res.current_page < res.last_page);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Failed to load deleted items.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [type, page, searchDebounced]);

  useEffect(() => {
    load(true);
  }, [type, searchDebounced]);

  const handleAction = async () => {
    if (!securityModal) return;
    const { action, itemId } = securityModal;
    
    try {
      if (action === "restore" && itemId) {
        await restoreTrashItem(type, itemId);
        toast.push({ type: "success", message: "Item restored successfully." });
        onRestored?.();
      } else if (action === "purge" && itemId) {
        await purgeTrashItem(type, itemId);
        toast.push({ type: "success", message: "Item permanently deleted." });
      } else if (action === "bulk-restore") {
        setIsBulkProcessing(true);
        const res = await axios.post(`/bulk/trash/${type}/restore`, { ids: Array.from(selectedIds) });
        toast.push({ type: "success", message: res.data.message });
        clearSelection();
        setIsSelectMode(false);
        onRestored?.();
      } else if (action === "bulk-purge") {
        setIsBulkProcessing(true);
        const res = await axios.post(`/bulk/trash/${type}/purge`, { ids: Array.from(selectedIds) });
        toast.push({ type: "success", message: res.data.message });
        clearSelection();
        setIsSelectMode(false);
      }
      // Reload the list
      load(true);
    } catch (err: any) {
      toast.push({ type: "error", message: err?.response?.data?.message ?? "Action failed." });
    } finally {
      setIsBulkProcessing(false);
      setSecurityModal(null);
    }
  };

  const columns: TableColumn<TrashItem>[] = useMemo(() => {
    const baseCols: TableColumn<TrashItem>[] = [
      {
        key: "id",
        header: "ID",
        skeletonShape: "narrow",
        render: (item) => <span className="text-xs font-mono text-slate-400">#{item.id}</span>
      },
      {
        key: "display",
        header: "Entity Info",
        render: (item) => {
          let main = item.title || item.name || item.full_name || item.email || "—";
          let sub = "";
          if (type === "users") {
            main = item.full_name;
            sub = item.email;
          } else if (type === "offices") {
            sub = `Code: ${item.code}`;
          } else if (type === "requests") {
            sub = item.office_name || "";
          }
          return (
            <div className="flex flex-col">
              <MiddleTruncate text={main} className="font-medium text-slate-900 dark:text-slate-100" />
              {sub && <span className="text-[10px] text-slate-500 dark:text-slate-400">{sub}</span>}
            </div>
          );
        }
      },
      {
        key: "deleted_at",
        header: "Deleted At",
        render: (item) => (
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <HistoryIcon size={12} className="shrink-0" />
            {formatDate(item.deleted_at)}
          </div>
        )
      },
      {
        key: "actions",
        header: "High-Impact Actions",
        align: "right",
        render: (item) => (
          <div className="flex items-center justify-end gap-2 pr-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 group hover:bg-emerald-50 dark:hover:bg-emerald-900/10 hover:text-emerald-600 dark:hover:text-emerald-400"
              onClick={(e) => {
                e.stopPropagation();
                setSecurityModal({
                  open: true,
                  action: "restore",
                  itemId: item.id,
                  itemName: item.title || item.name || item.full_name || "this item"
                });
              }}
            >
              <RotateCw size={14} className="mr-2 group-hover:scale-110 transition-transform" />
              Restore
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 group hover:bg-rose-50 dark:hover:bg-rose-900/10 hover:text-rose-600 dark:hover:text-rose-400"
              onClick={(e) => {
                e.stopPropagation();
                setSecurityModal({
                  open: true,
                  action: "purge",
                  itemId: item.id,
                  itemName: item.title || item.name || item.full_name || "this item"
                });
              }}
            >
              <TrashIcon size={14} className="mr-2 group-hover:scale-110 transition-transform" />
              Purge
            </Button>
          </div>
        )
      }
    ];
    return baseCols;
  }, [type, onRestored]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-surface-500 overflow-hidden">
      <div className="p-3 border-b border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/30 flex items-center justify-between">
        <div className="relative w-64 lg:w-80">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon size={14} />
          </div>
          <input
            placeholder="Search deleted records…"
            className={`${inputCls} pl-9 h-9 text-sm`}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          {rows.length > 0 && (
            <button
               onClick={() => {
                 setIsSelectMode(!isSelectMode);
                 if (isSelectMode) clearSelection();
               }}
               className={`flex items-center gap-2 px-3 h-9 rounded-lg border text-xs font-bold transition-all shadow-xs ${
                 isSelectMode 
                   ? "bg-brand-600 border-brand-600 text-white" 
                   : "bg-white dark:bg-surface-500 border-slate-200 dark:border-surface-400 text-slate-700 dark:text-slate-300 hover:bg-slate-50"
               }`}
             >
               <CheckSquare size={16} className={isSelectMode ? "text-white" : "text-brand-600"} />
               {isSelectMode ? "Cancel Select" : "Select"}
             </button>
          )}
          <Button variant="ghost" size="sm" onClick={() => load(true)} loading={loading}>
            <RefreshIcon size={14} className="mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger" className="m-3">{error}</Alert>}

      <div className="flex-1 min-h-0">
        <Table<TrashItem>
          bare
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          loading={loading}
          initialLoading={initialLoading}
          emptyMessage="No deleted records found."
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns="4rem minmax(200px, 1fr) 10rem 14rem"
          selectable={isSelectMode}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
        />
      </div>

      {securityModal && (
        <SecurityVerificationModal
          open={securityModal.open}
          onClose={() => setSecurityModal(null)}
          onVerified={handleAction}
          title={
            securityModal.action.includes("restore") 
              ? "Confirm Restoration" 
              : "Confirm Permanent Deletion"
          }
          description={
            securityModal.action === "restore"
              ? `Are you sure you want to restore "${securityModal.itemName}"? It will be immediately visible in all active workspaces.`
              : securityModal.action === "purge"
              ? `CAUTION: You are about to permanently delete "${securityModal.itemName}". This action cannot be undone.`
              : securityModal.action === "bulk-restore"
              ? `Are you sure you want to restore ${selectionCount} items? They will be immediately visible in active workspaces.`
              : `CAUTION: You are about to permanently delete ${selectionCount} items. This action is IRREVERSIBLE.`
          }
          actionLabel={securityModal.action.includes("restore") ? "Restore Item(s)" : "Permanently Purge"}
        />
      )}

      <BulkActionBar 
        selectedCount={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: "Restore",
            icon: <RotateCw size={14} />,
            onClick: () => setSecurityModal({ open: true, action: "bulk-restore" }),
            variant: "secondary",
            count: selectionCount,
            loading: isBulkProcessing
          },
          {
            label: "Purge",
            icon: <TrashIcon size={14} />,
            onClick: () => setSecurityModal({ open: true, action: "bulk-purge" }),
            variant: "danger",
            count: selectionCount,
            loading: isBulkProcessing
          }
        ]}
      />
    </div>
  );
};

export default DeletedItemsView;
