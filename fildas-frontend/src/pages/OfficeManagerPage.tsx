import { useCallback, useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { pageCache } from "../lib/pageCache";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import { getAdminOffices, type AdminOffice } from "../services/admin";
import OfficeEditModal from "../components/admin/OfficeEditModal";
import Alert from "../components/ui/Alert";
import SelectDropdown from "../components/ui/SelectDropdown";
import MiddleTruncate from "../components/ui/MiddleTruncate";
import { formatDate } from "../utils/formatters";
import { StatusBadge } from "../components/ui/Badge";
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import { getUserRole } from "../lib/roleFilters";
import { TabBar } from "../components/documentRequests/shared";
import DeletedItemsView from "../components/admin/DeletedItemsView";
import { Building2, Trash2, CheckSquare } from "lucide-react";
import { useBulkActions } from "../hooks/useBulkActions";
import BulkActionBar from "../components/ui/BulkActionBar";
import axios from "../services/api";
import Button from "../components/ui/Button";
import { useToast } from "../components/ui/toast/ToastContext";

const OFFICE_TYPES = ["office", "vp", "president", "committee", "unit"];

export function OfficeManagerPage() {
  const { push } = useToast();
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "disabled" | "all">("active");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "code" | "type" | "created_at">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");

  const role = getUserRole();
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const adminDebugMode = useAdminDebugMode();

  const _oc = pageCache.get<AdminOffice>("offices", '{"q":"","status":"active","type":""}', 10 * 60_000);
  const [items, setItems] = useState<AdminOffice[]>(_oc?.rows ?? []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(_oc?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!_oc);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(() => (location.state as any)?.openModal === true);
  const [modalMode, setModalMode] = useState<"create" | "edit">(() => (location.state as any)?.openModal === true ? "create" : "edit");
  const [selected, setSelected] = useState<AdminOffice | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== "active") count++;
    if (typeFilter) count++;
    return count;
  }, [statusFilter, typeFilter]);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 400);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (pageNum: number, silent = false) => {
      const filterKey = JSON.stringify({ q: qDebounced.trim(), status: statusFilter, type: typeFilter });
      try {
        if (!silent) setInitialLoading(true);
        setLoading(true);
        setError(null);
        const res = await getAdminOffices({
          q: qDebounced.trim() || undefined,
          status: statusFilter,
          type: typeFilter || undefined,
          page: pageNum,
          per_page: 10,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        const more = res.meta.current_page < res.meta.last_page;
        setItems((prev) => (pageNum === 1 ? res.data : [...prev, ...res.data]));
        setHasMore(more);
        if (pageNum === 1) pageCache.set("offices", filterKey, res.data, more);
        return res.data;
      } catch (e: any) {
        setError(e?.message ?? "Failed to load offices");
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [qDebounced, statusFilter, typeFilter, sortBy, sortDir],
  );

  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    const prevItems = [...items];
    const data = await load(1, true);
    if (!data) return { changed: false };
    const changed = JSON.stringify(data) !== JSON.stringify(prevItems.slice(0, data.length));
    return { changed };
  });

  // Reset on filter change
  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
    setInitialLoading(true);
    load(1);
  }, [qDebounced, statusFilter, typeFilter, sortBy, sortDir, load]);

  // Load next page
  useEffect(() => {
    if (page === 1) return;
    load(page);
  }, [page, load]);

  const openCreate = () => {
    setSelected(null);
    setModalMode("create");
    setModalOpen(true);
  };
  const openEdit = (office: AdminOffice) => {
    setSelected(office);
    setModalMode("edit");
    setModalOpen(true);
  };

  const clearFilters = () => {
    setQ("");
    setStatusFilter("active");
    setTypeFilter("");
  };

  const {
    selectedIds,
    isSelectMode,
    setIsSelectMode,
    toggleRow,
    toggleAll,
    clearSelection,
    selectionCount,
  } = useBulkActions<AdminOffice>(
    items,
    (o) => o.id,
    () => true
  );

  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${ids.length} offices?`)) return;

    setIsBulkProcessing(true);
    try {
      const res = await axios.post("/bulk/offices/delete", { ids });
      push({ type: "success", title: "Bulk Delete", message: res.data.message });
      setItems(prev => prev.filter(o => !ids.includes(o.id)));
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Action Failed", message: e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const columns: TableColumn<AdminOffice>[] = useMemo(() => [
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      skeletonShape: "narrow",
      render: (o) => <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">{o.code}</span>,
    },
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      skeletonShape: "text",
      render: (o) => <MiddleTruncate text={o.name} className="font-semibold text-slate-900 dark:text-slate-100 placeholder:block" />,
    },
    {
      key: "parent",
      header: "Parent",
      skeletonShape: "text",
      render: (o) => {
        const text = o.parent_office ? `${o.parent_office.name} (${o.parent_office.code})` : "—";
        return <MiddleTruncate text={text} className="text-sm text-slate-600 dark:text-slate-400" />;
      },
    },
    {
      key: "type",
      header: "Type",
      sortKey: "type",
      skeletonShape: "narrow",
      render: (o) => {
        const raw = o.type ?? "office";
        const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
        return <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>;
      }
    },
    {
      key: "status",
      header: "Status",
      skeletonShape: "badge",
      render: (o) => <StatusBadge status={o.deleted_at ? "Disabled" : "Active"} />,
    },
    {
      key: "created",
      header: "Created",
      sortKey: "created_at",
      skeletonShape: "narrow",
      render: (o) => <span className="text-xs text-slate-500 dark:text-slate-400">{(o as any).created_at ? formatDate((o as any).created_at) : "—"}</span>,
    },
  ], []);

  return (
    <PageFrame
      title="Office Manager"
      contentClassName="flex flex-col min-h-0 h-full"
      right={
        <PageActions>
          <RefreshAction onRefresh={refresh} loading={isRefreshing} />
          <CreateAction label="New office" onClick={openCreate} />
        </PageActions>
      }
    >
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-1 mb-px pr-4">
        <div className="flex items-center">
          {isAdmin && adminDebugMode && (
            <TabBar
              tabs={[
                { value: "active", label: "Active Offices", icon: <Building2 size={12} /> },
                { value: "deleted", label: "Deleted", icon: <Trash2 size={12} /> },
              ]}
              active={activeTab}
              onChange={(val: any) => setActiveTab(val)}
            />
          )}
        </div>
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

      {activeTab === "deleted" ? (
        <div className="flex-1 min-h-0">
          <DeletedItemsView type="offices" onRestored={() => setActiveTab("active")} />
        </div>
      ) : (
        <>
          <SearchFilterBar
        search={q}
        setSearch={(val) => { setQ(val); setPage(1); }}
        placeholder="Search name or code…"
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
        mobileFilters={
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
              <SelectDropdown
                value={statusFilter}
                onChange={(val) => setStatusFilter((val as any) || "active")}
                className="w-full"
                options={[{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }, { value: "all", label: "All" }]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
              <SelectDropdown
                value={typeFilter}
                onChange={(val) => setTypeFilter((val as string) || "")}
                className="w-full"
                options={[{ value: "", label: "All types" }, ...OFFICE_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))]}
              />
            </div>
          </div>
        }
      >
        <SelectDropdown
          value={statusFilter}
          onChange={(val) => setStatusFilter((val as any) || "active")}
          className="w-28"
          options={[{ value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }, { value: "all", label: "All" }]}
        />
        <SelectDropdown
          value={typeFilter}
          onChange={(val) => setTypeFilter((val as string) || "")}
          className="w-32"
          options={[{ value: "", label: "All types" }, ...OFFICE_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))]}
        />
      </SearchFilterBar>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<AdminOffice>
          bare
          className="h-full"
          columns={columns}
          rows={items}
          rowKey={(o) => o.id}
          onRowClick={openEdit}
          loading={loading}
          initialLoading={initialLoading}
          emptyMessage={q || statusFilter !== "active" || typeFilter ? "No offices match your filters." : "No offices found."}
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns="minmax(80px, 6rem) minmax(140px, 1.2fr) minmax(140px, 1.2fr) 8rem 7rem 8rem"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => { setSortBy(key as typeof sortBy); setSortDir(dir); }}
          selectable={isSelectMode}
          selectedIds={selectedIds}
          onToggleRow={toggleRow}
          onToggleAll={toggleAll}
        />
      </div>

      <BulkActionBar 
        selectedCount={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: "Delete",
            icon: <Trash2 size={14} />,
            onClick: handleBulkDelete,
            variant: "danger",
            count: selectionCount,
            loading: isBulkProcessing
          }
        ]}
      />
      </>
      )}

      <OfficeEditModal
        open={modalOpen}
        mode={modalMode}
        office={selected}
        onClose={() => setModalOpen(false)}
        onSaved={() => load(1, true)}
      />
    </PageFrame>
  );
}

export default OfficeManagerPage;
