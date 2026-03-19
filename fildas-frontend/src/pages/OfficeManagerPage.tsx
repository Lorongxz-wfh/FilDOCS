import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import Table, { type TableColumn } from "../components/ui/Table";
import { getAdminOffices, type AdminOffice } from "../services/admin";
import OfficeEditModal from "../components/admin/OfficeEditModal";
import Alert from "../components/ui/Alert";
import { inputCls, selectCls } from "../utils/formStyles";
import { X } from "lucide-react";

const OFFICE_TYPES = ["office", "vp", "president", "committee", "unit"];

export function OfficeManagerPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "disabled" | "all">("active");
  const [typeFilter, setTypeFilter] = useState("");

  const [items, setItems] = useState<AdminOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminOffices({
        q: qDebounced.trim() || undefined,
        status: statusFilter,
        type: typeFilter || undefined,
      });
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load offices");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, statusFilter, typeFilter]);

  useEffect(() => {
    setInitialLoading(true);
    load();
  }, [load]);

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
      render: (o) => (
        <span className="font-mono text-xs font-medium text-slate-700 dark:text-slate-300">
          {o.code}
        </span>
      ),
    },
    {
      key: "name",
      header: "Name",
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
          {o.parentOffice
            ? `${o.parentOffice.name} (${o.parentOffice.code})`
            : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (o) => {
        const isDisabled = !!o.deleted_at;
        return (
          <span
            className={[
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
              isDisabled
                ? "border border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                : "border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400",
            ].join(" ")}
          >
            {isDisabled ? "Disabled" : "Active"}
          </span>
        );
      },
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
        <div className="relative w-64">
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
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
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
          gridTemplateColumns="6rem 1fr 7rem 1fr 7rem"
        />
      </div>

      <OfficeEditModal
        open={modalOpen}
        mode={modalMode}
        office={selected}
        onClose={() => setModalOpen(false)}
        onSaved={() => load()}
      />
    </PageFrame>
  );
}

export default OfficeManagerPage;
