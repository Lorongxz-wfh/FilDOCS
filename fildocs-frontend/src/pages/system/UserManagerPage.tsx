import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { pageCache } from "../../lib/pageCache";
import { getUserRole } from "../../lib/roleFilters";
import { useSmartRefresh } from "../../hooks/useSmartRefresh";
import PageFrame from "../../components/layout/PageFrame";
import Table, { type TableColumn } from "../../components/ui/Table";
import {
  getAdminUsers,
  getAdminRoles,
  type AdminUser,
  type AdminRole,
} from "../../services/admin";
import UserEditModal from "../../components/admin/UserEditModal";
import Alert from "../../components/ui/Alert";
import SelectDropdown from "../../components/ui/SelectDropdown";
import MiddleTruncate from "../../components/ui/MiddleTruncate";
import { formatDate } from "../../utils/formatters";
import { StatusBadge } from "../../components/ui/Badge";
import RoleBadge from "../../components/ui/RoleBadge";
import { PageActions, CreateAction } from "../../components/ui/PageActions";
import { motion, AnimatePresence } from "framer-motion";
import DeletedItemsView from "../../components/admin/DeletedItemsView";
import AdminSessionsTab from "../../components/admin/AdminSessionsTab";
import { TabBar } from "../../components/documentRequests/shared";
import { Users, Trash2, CheckSquare, ShieldCheck, ShieldAlert, Activity, SlidersHorizontal, Search, X } from "lucide-react";
import { useBulkActions } from "../../hooks/useBulkActions";
import BulkActionBar from "../../components/ui/BulkActionBar";
import axios from "../../services/api";
import Button from "../../components/ui/Button";
import { getAuthUser } from "../../lib/auth";
import { useToast } from "../../components/ui/toast/ToastContext";

const UserManagerPage: React.FC = () => {
  const { push } = useToast();
  const role = getUserRole();
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const [activeTab, setActiveTab] = useState<"active" | "sessions" | "deleted">("active");

  const _uc = pageCache.get<AdminUser>(
    "users",
    '{"q":"","status":"","role":""}',
    5 * 60_000,
  );

  const [rows, setRows] = useState<AdminUser[]>(_uc?.rows ?? []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(_uc?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!_uc);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disabled">("");
  const [roleFilter, setRoleFilter] = useState<number | "">("");
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [trashRefreshTrigger, setTrashRefreshTrigger] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const [sortBy, setSortBy] = useState<"first_name" | "last_name" | "email" | "created_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const location = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(() => (location.state as any)?.openModal === true);
  const [editMode, setEditMode] = useState<"edit" | "create">(() => (location.state as any)?.openModal === true ? "create" : "edit");
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (statusFilter) count++;
    if (roleFilter) count++;
    return count;
  }, [statusFilter, roleFilter]);

  // Load roles once
  useEffect(() => {
    getAdminRoles().then(setRoles).catch(() => { });
  }, []);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  // Data fetching logic
  const load = useCallback(
    async (pageNum: number, silent = false) => {
      if (pageNum > 1 && !hasMore) return;
      if (pageNum === 1 && !silent) {
        setInitialLoading(true);
        setRows([]);
        setTotal(null);
      }
      setLoading(true);
      setError(null);
      try {
        const res = await getAdminUsers({
          page: pageNum,
          per_page: 10,
          q: searchDebounced || undefined,
          status: statusFilter || undefined,
          role_id: roleFilter || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        const incoming = res.data ?? [];
        setRows((prev) => (pageNum === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? (res as any);
        const more = meta?.current_page != null && meta?.last_page != null && meta.current_page < meta.last_page;
        setHasMore(more);
        if (meta?.total !== undefined) setTotal(meta.total);
        if (pageNum === 1) {
          const filterKey = JSON.stringify({ q: searchDebounced, status: statusFilter, role: String(roleFilter) });
          pageCache.set("users", filterKey, incoming, more);
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load users.");
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [searchDebounced, statusFilter, roleFilter, sortBy, sortDir, hasMore]
  );

  // Background refresh logic
  useSmartRefresh(async () => {
    const prevRows = [...rows];
    
    const [res] = await Promise.all([
      getAdminUsers({
        page: 1,
        per_page: 10,
        q: searchDebounced || undefined,
        status: statusFilter || undefined,
        role_id: roleFilter || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      }),
      // Synchronize roles as well
      getAdminRoles().then(setRoles).catch(() => {})
    ]);

    const incoming = res.data ?? [];
    const changed = JSON.stringify(incoming) !== JSON.stringify(prevRows.slice(0, incoming.length));

    setRows((prev) => {
      const remaining = prev.slice(incoming.length);
      return [...incoming, ...remaining];
    });

    // If on deleted tab, trigger its child refresh
    if (activeTab === "deleted") {
      setTrashRefreshTrigger(prev => prev + 1);
    }

    return { 
      changed,
      message: changed ? "User list synchronized." : "User list is up to date."
    };
  });

  // Reset on filter change
  useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [searchDebounced, statusFilter, roleFilter, sortBy, sortDir]);

  // Trigger load on change
  useEffect(() => {
    load(1, rows.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDebounced, statusFilter, roleFilter, sortBy, sortDir]);

  const openEdit = (u: AdminUser) => {
    setEditMode("edit");
    setSelectedUser(u);
    setIsEditOpen(true);
  };

  const openCreate = () => {
    setEditMode("create");
    setSelectedUser(null);
    setIsEditOpen(true);
  };

  const handleSaved = () => {
    load(1, true);
  };

  const {
    selectedIds,
    isSelectMode,
    setIsSelectMode,
    toggleRow,
    toggleAll,
    clearSelection,
    selectionCount,
  } = useBulkActions<AdminUser>(
    rows,
    (u) => u.id,
    (u, _action) => {
      // Cannot bulk action yourself
      if (u.id === getAuthUser()?.id) return false;
      return true;
    }
  );

  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleBulkStatus = async (disabled: boolean) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setIsBulkProcessing(true);
    try {
      const res = await axios.post("/bulk/users/toggle-status", { ids, disabled });
      push({ type: "success", title: "Bulk Status Update", message: res.data.message });
      setRows(prev => prev.map(u => ids.includes(u.id) ? { ...u, disabled_at: disabled ? new Date().toISOString() : null } : u));
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Action Failed", message: e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${ids.length} users?`)) return;

    setIsBulkProcessing(true);
    try {
      const res = await axios.post("/bulk/users/delete", { ids });
      push({ type: "success", title: "Bulk Delete", message: res.data.message });
      setRows(prev => prev.filter(u => !ids.includes(u.id)));
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Action Failed", message: e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setRoleFilter("");
    setPage(1);
  };

  const columns: TableColumn<AdminUser>[] = useMemo(
    () => [
      {
        key: "activity",
        header: "",
        skeletonShape: "circle",
        render: (u) => {
          const isEnabled = !u.disabled_at;
          const lastActive = u.last_active_at ? new Date(u.last_active_at) : null;
          const isOnline = isEnabled && lastActive && (Date.now() - lastActive.getTime() < 30 * 60 * 1000);
          return (
            <div className="flex justify-center">
              <div
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500  shadow-emerald-500/50' : 'bg-slate-300 dark:bg-surface-400'}`}
                title={isOnline ? 'Online' : u.disabled_at ? 'Disabled' : 'Offline'}
              />
            </div>
          );
        },
      },
      {
        key: "name",
        header: "Name",
        sortKey: "last_name",
        skeletonShape: "text",
        render: (u) => <MiddleTruncate text={u.full_name} className="font-semibold text-slate-900 dark:text-slate-100" />,
      },
      {
        key: "email",
        header: "Email",
        sortKey: "email",
        skeletonShape: "text",
        render: (u) => <MiddleTruncate text={u.email} className="text-sm text-slate-600 dark:text-slate-400" />,
      },
      {
        key: "office",
        header: "Office",
        skeletonShape: "text",
        render: (u) => <MiddleTruncate text={u.office?.name ?? "—"} className="text-sm text-slate-600 dark:text-slate-400" />,
      },
      {
        key: "role",
        header: "Role",
        skeletonShape: "text",
        render: (u) => <RoleBadge role={u.role?.name ?? "none"} />,
      },
      {
        key: "status",
        header: "Account",
        skeletonShape: "badge",
        render: (u) => <StatusBadge status={u.disabled_at ? "Disabled" : "Active"} />,
      },
      {
        key: "created",
        header: "Joined",
        sortKey: "created_at",
        align: "right",
        skeletonShape: "narrow",
        render: (u) => <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(u.created_at)}</div>,
      },
    ],
    [],
  );

  if (!isAdmin) {
    return (
      <PageFrame title="User Manager">
        <div className="text-sm text-slate-500 dark:text-slate-400">Admin access required.</div>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      title="User Manager"
      contentClassName="flex flex-col min-h-0 h-full"
      right={
        <PageActions>
          <CreateAction label="New user" onClick={openCreate} />
        </PageActions>
      }
    >
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-transparent px-1 mb-4 pr-4 gap-4">
        <div className="flex items-center">
            <TabBar
              tabs={[
                { value: "active", label: "Active Users", icon: <Users size={14} /> },
                { value: "sessions", label: "Sessions", icon: <Activity size={14} /> },
                { value: "deleted", label: "Trash", icon: <Trash2 size={14} /> },
              ]}
              active={activeTab}
              onChange={(val: any) => {
                setActiveTab(val);
                setShowFilters(false);
              }}
            />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {activeTab === "active" && (
            <>
              <div className="hidden lg:flex items-center relative w-64 h-8">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Filter users..."
                  className="w-full pl-9 pr-8 h-8 text-[12px] font-medium bg-slate-50/50 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-brand-500/20 focus:border-brand-500 dark:bg-surface-600/50 dark:border-surface-400 dark:text-slate-200 transition-all"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setPage(1); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <Button
                variant={showFilters || activeFiltersCount > 0 ? "secondary" : "outline"}
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="h-8 text-[11px] font-bold uppercase tracking-widest"
              >
                <SlidersHorizontal size={14} />
                <span>Filters</span>
                {activeFiltersCount > 0 && !showFilters && (
                  <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-500 text-[9px] font-bold text-white ring-2 ring-white dark:ring-surface-500">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>

              <div className="w-px h-4 bg-slate-200 dark:bg-surface-400 mx-1" />

              <Button
                variant={isSelectMode ? "primary" : "outline"}
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) clearSelection();
                }}
                className="h-8 text-[11px] font-bold uppercase tracking-widest"
              >
                <CheckSquare size={14} />
                <span>{isSelectMode ? "Cancel" : "Select"}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      <AnimatePresence>
        {activeTab === "active" && showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] as const }}
            className="overflow-hidden bg-slate-50 dark:bg-surface-600 border-b border-slate-200 dark:border-surface-400"
          >
            <div className="px-4 py-3 flex flex-wrap items-center gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Account Status</span>
                <SelectDropdown
                  value={statusFilter}
                  onChange={(val) => { setStatusFilter((val as any) || ""); setPage(1); }}
                  className="w-40"
                  options={[
                    { value: "", label: "All Statuses" },
                    { value: "active", label: "Active Only" },
                    { value: "disabled", label: "Disabled Only" }
                  ]}
                />
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Assigned Role</span>
                <SelectDropdown
                  value={roleFilter}
                  onChange={(val) => { setRoleFilter(val === null || val === "" ? "" : Number(val)); setPage(1); }}
                  className="w-48"
                  options={[
                    { value: "", label: "All Roles" },
                    ...roles.map((r) => ({ value: r.id, label: r.label || r.name }))
                  ]}
                />
              </div>
              
              <div className="mt-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-rose-500 transition-colors h-8"
                >
                  <Trash2 size={14} />
                  <span>Clear all</span>
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeTab === "deleted" ? (
        <div className="flex-1 min-h-0">
          <DeletedItemsView 
            type="users" 
            onRestored={() => setActiveTab("active")} 
            refreshTrigger={trashRefreshTrigger}
          />
        </div>
      ) : activeTab === "sessions" ? (
        <div className="flex-1 min-h-0">
          <AdminSessionsTab />
        </div>
      ) : (
        <>
          {error && <Alert variant="danger">{error}</Alert>}

          <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
            <Table<AdminUser>
              bare
              className="h-full"
              columns={columns}
              rows={rows}
              total={total ?? undefined}
              rowKey={(u) => u.id}
              onRowClick={openEdit}
              loading={loading}
              initialLoading={initialLoading}
              emptyMessage={search || statusFilter || roleFilter ? "No users match your filters." : "No users found."}
              hasMore={hasMore}
              onLoadMore={() => {
                const next = page + 1;
                setPage(next);
                load(next, true);
              }}
              gridTemplateColumns="40px 1.6fr 1.3fr 1.8fr 7.5rem 4.5rem 4rem"
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
                label: "Enable",
                icon: <ShieldCheck size={14} />,
                onClick: () => handleBulkStatus(false),
                variant: "secondary",
                count: selectionCount,
                loading: isBulkProcessing
              },
              {
                label: "Disable",
                icon: <ShieldAlert size={14} />,
                onClick: () => handleBulkStatus(true),
                variant: "warning",
                count: selectionCount,
                loading: isBulkProcessing
              },
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

      <UserEditModal
        open={isEditOpen}
        mode={editMode}
        user={selectedUser}
        onClose={() => { setIsEditOpen(false); setSelectedUser(null); }}
        onSaved={handleSaved}
      />
    </PageFrame>
  );
};

export default UserManagerPage;
