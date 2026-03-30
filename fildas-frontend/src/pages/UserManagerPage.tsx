import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { pageCache } from "../lib/pageCache";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import Button from "../components/ui/Button";
import {
  getAdminUsers,
  getAdminRoles,
  type AdminUser,
  type AdminRole,
} from "../services/admin";
import UserEditModal from "../components/admin/UserEditModal";
import Alert from "../components/ui/Alert";
import { inputCls, selectCls } from "../utils/formStyles";
import { X } from "lucide-react";
import { StatusBadge, TypePill } from "../components/ui/Badge";

const UserManagerPage: React.FC = () => {
  const me = getAuthUser();
  const isAdmin = me?.role === "admin" || me?.role === "sysadmin";

  const _uc = pageCache.get<AdminUser>("users", '{"q":"","status":"","role":""}', 5 * 60_000);
  const [rows, setRows] = useState<AdminUser[]>(_uc?.rows ?? []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(_uc?.hasMore ?? true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!_uc);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "disabled">(
    "",
  );
  const [roleFilter, setRoleFilter] = useState<number | "">("");
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [reloadTick, setReloadTick] = useState(0);
  const [sortBy, setSortBy] = useState<
    "first_name" | "last_name" | "email" | "created_at"
  >("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const location = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(
    () => (location.state as any)?.openModal === true,
  );
  const [editMode, setEditMode] = useState<"edit" | "create">(() =>
    (location.state as any)?.openModal === true ? "create" : "edit",
  );
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

  // Load roles once
  useEffect(() => {
    getAdminRoles().then(setRoles).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search), 400);
    return () => window.clearTimeout(t);
  }, [search]);

  // Reset on filter/reload change
  useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [searchDebounced, statusFilter, roleFilter, reloadTick, sortBy, sortDir]);

  useEffect(() => {
    let alive = true;
    const filterKey = JSON.stringify({ q: searchDebounced, status: statusFilter, role: String(roleFilter) });
    const load = async () => {
      if (!hasMore && page > 1) return;
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
        if (!alive) return;
        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? (res as any);
        const more =
          meta?.current_page != null &&
          meta?.last_page != null &&
          meta.current_page < meta.last_page;
        setHasMore(more);
        if (page === 1) pageCache.set("users", filterKey, incoming, more);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load users.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, searchDebounced, statusFilter, roleFilter, reloadTick]);

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
  const handleSaved = (_saved: AdminUser) => {
    setReloadTick((t) => t + 1);
  };

  const hasActiveFilters = !!search || !!statusFilter || !!roleFilter;
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setRoleFilter("");
    setPage(1);
  };

  const columns: TableColumn<AdminUser>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        sortKey: "last_name",
        render: (u) => (
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
            {u.full_name}
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
        sortKey: "email",
        render: (u) => (
          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {u.email}
          </div>
        ),
      },
      {
        key: "office",
        header: "Office",
        render: (u) => (
          <div className="text-sm text-slate-600 dark:text-slate-400 truncate">
            {u.office?.name ?? "—"}
          </div>
        ),
      },
      {
        key: "role",
        header: "Role",
        render: (u) => {
          const role = u.role?.name ?? "none";
          const label = role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
          return <TypePill label={label} />;
        },
      },
      {
        key: "status",
        header: "Status",
        render: (u) => <StatusBadge status={u.disabled_at ? "Disabled" : "Active"} />,
      },
    ],
    [],
  );

  if (!isAdmin) {
    return (
      <PageFrame title="User Manager">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Admin access required.
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame
      title="User Manager"
      contentClassName="flex flex-col min-h-0 gap-4 h-full overflow-hidden"
      right={
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          New user
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search with inline clear */}
        <div className="relative w-full sm:w-64">
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search name / email…"
            className={`${inputCls} pr-8`}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setPage(1);
              }}
              title="Clear"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className={selectCls}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>

        {/* Role filter */}
        <select
          value={roleFilter}
          onChange={(e) =>
            setRoleFilter(e.target.value === "" ? "" : Number(e.target.value))
          }
          className={selectCls}
        >
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label || r.name}
            </option>
          ))}
        </select>

        {/* Clear — only when filters are active */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}

        {error && <Alert variant="danger">{error}</Alert>}
      </div>

      {/* Table — flex-1 so it fills remaining space and scrolls internally */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<AdminUser>
          bare
          className="h-full"
          columns={columns}
          rows={rows}
          rowKey={(u) => u.id}
          onRowClick={openEdit}
          loading={loading}
          initialLoading={initialLoading}
          error={error}
          emptyMessage="No users found."
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns="1fr 1fr 1fr 8rem 7rem"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
        />
      </div>

      <UserEditModal
        open={isEditOpen}
        mode={editMode}
        user={selectedUser}
        onClose={() => {
          setIsEditOpen(false);
          setSelectedUser(null);
        }}
        onSaved={handleSaved}
      />
    </PageFrame>
  );
};

export default UserManagerPage;
