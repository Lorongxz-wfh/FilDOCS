import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import Table, { type TableColumn } from "../components/ui/Table";
import { getAdminOffices, type AdminOffice } from "../services/admin";
import OfficeEditModal from "../components/admin/OfficeEditModal";

export function OfficeManagerPage() {
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

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
        disabled: showDisabled,
      });
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load offices");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, showDisabled]);

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
      contentClassName="flex flex-col min-h-0 gap-4"
      right={
        <Button type="button" variant="primary" size="sm" onClick={openCreate}>
          New office
        </Button>
      }
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or code…"
          className="w-72 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500"
        />
        <label className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showDisabled}
            onChange={(e) => setShowDisabled(e.target.checked)}
            className="rounded border-slate-300 text-sky-500 focus:ring-sky-400"
          />
          Show disabled
        </label>
        <button
          type="button"
          onClick={() => {
            setQ("");
            setShowDisabled(false);
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
