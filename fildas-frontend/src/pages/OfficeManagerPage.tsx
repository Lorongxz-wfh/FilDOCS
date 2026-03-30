import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { pageCache } from "../lib/pageCache";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import Table, { type TableColumn } from "../components/ui/Table";
import { getAdminOffices, type AdminOffice } from "../services/admin";
import OfficeEditModal from "../components/admin/OfficeEditModal";
import Alert from "../components/ui/Alert";
import { inputCls, selectCls } from "../utils/formStyles";
import { X } from "lucide-react";
import { StatusBadge } from "../components/ui/Badge";

const OFFICE_TYPES = ["office", "vp", "president", "committee", "unit"];

export function OfficeManagerPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "active" | "disabled" | "all"
  >("active");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "code" | "type">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const _oc = pageCache.get<AdminOffice>("offices", '{"q":"","status":"active","type":""}', 10 * 60_000);
  const [items, setItems] = useState<AdminOffice[]>(_oc?.rows ?? []);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(_oc?.hasMore ?? true);
  const [loading, setLoading] = useState(!_oc);
  const [initialLoading, setInitialLoading] = useState(!_oc);
  const [error, setError] = useState<string | null>(null);

  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(
    () => (location.state as any)?.openModal === true,
  );
  const [modalMode, setModalMode] = useState<"create" | "edit">(() =>
    (location.state as any)?.openModal === true ? "create" : "edit",
  );
  const [selected, setSelected] = useState<AdminOffice | null>(null);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 400);
    return () => window.clearTimeout(t);
  }, [q]);

  const load = useCallback(
    async (pageNum: number) => {
      const filterKey = JSON.stringify({
        q: qDebounced.trim(),
        status: statusFilter,
        type: typeFilter,
      });
      try {
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
      } catch (e: any) {
        setError(e?.message ?? "Failed to load offices");
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [qDebounced, statusFilter, typeFilter, sortBy, sortDir],
  );

  // Reset on filter change
  useEffect(() => {
    setPage(1);
    setItems([]);
    setHasMore(true);
    setInitialLoading(true);
    load(1);
  }, [load]);

  // Load next page when page increments beyond 1
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

  const hasActiveFilters = !!q || statusFilter !== "active" || !!typeFilter;
  const clearFilters = () => {
    setQ("");
    setStatusFilter("active");
    setTypeFilter("");
  };

  const columns: TableColumn<AdminOffice>[] = [
    {
      key: "code",
      header: "Code",
      sortKey: "code",
      render: (o) => (
        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
          {o.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
      sortKey: "name",
      render: (o) => (
        <span className="font-medium text-slate-900 dark:text-slate-100 truncate block">
          {o.name}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (o) => (
        <span className="text-sm text-slate-500 dark:text-slate-400 capitalize">
          {o.type ?? "office"}
        </span>
      ),
    },
    {
      key: "parent",
      header: "Parent",
      render: (o) => (
        <span className="text-sm text-slate-500 dark:text-slate-400 truncate block">
          {o.parent_office
            ? `${o.parent_office.name} (${o.parent_office.code})`
            : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => <StatusBadge status={o.deleted_at ? "Disabled" : "Active"} />,
    },
  ];

  return (
    <PageFrame
      title="Office Manager"
      contentClassName="flex flex-col min-h-0 gap-4 h-full overflow-hidden"
      right={
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          New office
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search with inline clear */}
        <div className="relative w-full sm:w-64">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or code…"
            className={`${inputCls} pr-8`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
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
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
          <option value="all">All</option>
        </select>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={selectCls}
        >
          <option value="">All types</option>
          {OFFICE_TYPES.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        {/* Clear — only when non-default filters active */}
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
        <Table<AdminOffice>
          bare
          className="h-full"
          columns={columns}
          rows={items}
          rowKey={(o) => o.id}
          onRowClick={openEdit}
          loading={loading}
          initialLoading={initialLoading}
          error={error}
          emptyMessage="No offices found."
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns="6rem 1fr 7rem 1fr 7rem"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
        />
      </div>

      <OfficeEditModal
        open={modalOpen}
        mode={modalMode}
        office={selected}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setPage(1);
          setItems([]);
          setHasMore(true);
          setInitialLoading(true);
          load(1);
        }}
      />
    </PageFrame>
  );
}

export default OfficeManagerPage;
