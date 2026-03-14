import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import Button from "../components/ui/Button";
import { getAdminUsers, type AdminUser } from "../services/admin";
import UserEditModal from "../components/admin/UserEditModal";

const UserManagerPage: React.FC = () => {
  const me = getAuthUser();
  const isAdmin = me?.role === "admin" || me?.role === "sysadmin";

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  const location = useLocation();
  const [isEditOpen, setIsEditOpen] = useState(
    () => (location.state as any)?.openModal === true,
  );
  const [editMode, setEditMode] = useState<"edit" | "create">(() =>
    (location.state as any)?.openModal === true ? "create" : "edit",
  );
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);

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
  }, [searchDebounced, reloadTick]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!hasMore && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const res = await getAdminUsers({
          page,
          q: searchDebounced || undefined,
        });
        if (!alive) return;
        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        const meta = res.meta ?? (res as any);
        setHasMore(
          meta?.current_page != null &&
            meta?.last_page != null &&
            meta.current_page < meta.last_page,
        );
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
    return () => {
      alive = false;
    };
  }, [page, searchDebounced, reloadTick]);

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

  const columns: TableColumn<AdminUser>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        render: (u) => (
          <div className="font-medium text-slate-900 dark:text-slate-100 truncate">
            {u.full_name}
          </div>
        ),
      },
      {
        key: "email",
        header: "Email",
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
          const isAdminRole = ["admin", "sysadmin"].includes(
            role.toLowerCase(),
          );
          return (
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                isAdminRole
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border border-slate-200 bg-slate-50 text-slate-700 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-300",
              ].join(" ")}
            >
              {role}
            </span>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        render: (u) => {
          const active = !u.disabled_at;
          return (
            <span
              className={[
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
                active
                  ? "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400"
                  : "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400",
              ].join(" ")}
            >
              {active ? "Active" : "Disabled"}
            </span>
          );
        },
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
      contentClassName="flex flex-col min-h-0 gap-4"
      right={
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          New user
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search name / email…"
          className="w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500"
        />
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setPage(1);
          }}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-300 dark:hover:bg-surface-400 transition-colors"
        >
          Clear
        </button>
        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      {/* Table */}
      <div
        className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden"
        style={{ height: "calc(100vh - 217px)" }}
      >
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
