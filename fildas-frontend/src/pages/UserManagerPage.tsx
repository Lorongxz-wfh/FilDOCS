import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { pageCache } from "../lib/pageCache";
import { getUserRole } from "../lib/roleFilters";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import {
  getAdminUsers,
  getAdminRoles,
  type AdminUser,
  type AdminRole,
} from "../services/admin";
import UserEditModal from "../components/admin/UserEditModal";
import Alert from "../components/ui/Alert";
import SelectDropdown from "../components/ui/SelectDropdown";
import MiddleTruncate from "../components/ui/MiddleTruncate";
import { formatDate } from "../utils/formatters";
import { StatusBadge } from "../components/ui/Badge";
import RoleBadge from "../components/ui/RoleBadge";
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import DeletedItemsView from "../components/admin/DeletedItemsView";
import { TabBar } from "../components/documentRequests/shared";
import { Users, Trash2, CheckSquare, ShieldCheck, ShieldAlert } from "lucide-react";
import { useBulkActions } from "../hooks/useBulkActions";
import BulkActionBar from "../components/ui/BulkActionBar";
import axios from "../services/api";
import Button from "../components/ui/Button";
import { getAuthUser } from "../lib/auth";
import { useToast } from "../components/ui/toast/ToastContext";

const UserManagerPage: React.FC = () => {
  const { push } = useToast();
  const role = getUserRole();
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const adminDebugMode = useAdminDebugMode();
  const [activeTab, setActiveTab] = useState<"active" | "deleted">("active");

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

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disabled">("");
  const [roleFilter, setRoleFilter] = useState<number | "">("");
  const [roles, setRoles] = useState<AdminRole[]>([]);
  
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
    getAdminRoles().then(setRoles).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  // Data fetching logic
  const loadRef = useCallback(
    async (silent = false) => {
      if (page > 1 && !hasMore) return;
      if (!silent) setInitialLoading(true);
      setLoading(true);
      setError(null);
      try {
        const res = await getAdminUsers({
          page,
          per_page: 10,
          q: searchDebounced || undefined,
          status: statusFilter || undefined,
          role_id: roleFilter || undefined,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? (res as any);
        const more = meta?.current_page != null && meta?.last_page != null && meta.current_page < meta.last_page;
        setHasMore(more);
        
        if (page === 1) {
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
    [page, searchDebounced, statusFilter, roleFilter, sortBy, sortDir, hasMore]
  );

  // Background refresh logic
  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    const prevRows = [...rows];
    const res = await getAdminUsers({
      page: 1,
      per_page: 10,
      q: searchDebounced || undefined,
      status: statusFilter || undefined,
      role_id: roleFilter || undefined,
      sort_by: sortBy,
      sort_dir: sortDir,
    });
    
    const incoming = res.data ?? [];
    const changed = JSON.stringify(incoming) !== JSON.stringify(prevRows.slice(0, incoming.length));
    
    setRows((prev) => {
      const remaining = prev.slice(incoming.length);
      return [...incoming, ...remaining];
    });
    
    return { changed };
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
    let alive = true;
    if (alive) loadRef(rows.length > 0); 
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchDebounced, statusFilter, roleFilter, sortBy, sortDir]);

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
    loadRef(true); 
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
                className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50' : 'bg-slate-300 dark:bg-surface-400'}`}
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
          <RefreshAction onRefresh={refresh} loading={isRefreshing} />
          <CreateAction label="New user" onClick={openCreate} />
        </PageActions>
      }
    >
      <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-1 mb-px pr-4">
        <div className="flex items-center">
          {isAdmin && adminDebugMode && (
            <TabBar
              tabs={[
                { value: "active", label: "Active Users", icon: <Users size={12} /> },
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
          <DeletedItemsView type="users" onRestored={() => setActiveTab("active")} />
        </div>
      ) : (
        <>
          <SearchFilterBar
        search={search}
        setSearch={(val) => { setSearch(val); setPage(1); }}
        placeholder="Search name / email…"
        activeFiltersCount={activeFiltersCount}
        onClear={clearFilters}
        mobileFilters={
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
              <SelectDropdown
                value={statusFilter}
                onChange={(val) => setStatusFilter((val as any) || "")}
                className="w-full"
                options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Role</label>
              <SelectDropdown
                value={roleFilter}
                onChange={(val) => setRoleFilter(val === null || val === "" ? "" : Number(val))}
                className="w-full"
                options={[{ value: "", label: "All roles" }, ...roles.map((r) => ({ value: r.id, label: r.label || r.name }))]}
              />
            </div>
          </div>
        }
      >
        <SelectDropdown
          value={statusFilter}
          onChange={(val) => setStatusFilter((val as any) || "")}
          className="w-32"
          options={[{ value: "", label: "All statuses" }, { value: "active", label: "Active" }, { value: "disabled", label: "Disabled" }]}
        />
        <SelectDropdown
          value={roleFilter}
          onChange={(val) => setRoleFilter(val === null || val === "" ? "" : Number(val))}
          className="w-40"
          options={[{ value: "", label: "All roles" }, ...roles.map((r) => ({ value: r.id, label: r.label || r.name }))]}
        />
      </SearchFilterBar>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<AdminUser>
          bare
          className="h-full"
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          onRowClick={openEdit}
          loading={loading}
          initialLoading={initialLoading}
          emptyMessage={search || statusFilter || roleFilter ? "No users match your filters." : "No users found."}
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns="3rem minmax(140px, 0.8fr) minmax(180px, 0.8fr) minmax(220px, 1.6fr) 8rem 7rem 8rem"
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
