// ============================================================
// NOTE: Three separate files combined here for delivery.
// Split them back into their own files when applying.
// ============================================================

// ============================================================
// OfficeManagerPage.tsx
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import PageFrame from "../components/layout/PageFrame";
import { Card } from "../components/ui/Card";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import InlineSpinner from "../components/ui/loader/InlineSpinner";

import { getAdminOffices, type AdminOffice } from "../services/admin";
import OfficeEditModal from "../components/admin/OfficeEditModal";

export function OfficeManagerPage() {
  const [q, setQ] = useState("");
  const [showDisabled, setShowDisabled] = useState(false);

  const [items, setItems] = useState<AdminOffice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<AdminOffice | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAdminOffices({
        q: q.trim() || undefined,
        disabled: showDisabled,
      });
      setItems(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load offices");
    } finally {
      setLoading(false);
    }
  }, [q, showDisabled]);

  useEffect(() => {
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
  const visible = useMemo(() => items, [items]);

  return (
    <PageFrame title="Office manager">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Search
              </label>
              <input
                className="w-72 max-w-full rounded-md border border-slate-300 dark:border-surface-400 bg-white dark:bg-surface-400 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 dark:placeholder-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-200 outline-none"
                placeholder="Name or code…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <div className="pt-6">
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={showDisabled}
                  onChange={(e) => setShowDisabled(e.target.checked)}
                />
                Show disabled
              </label>
            </div>

            <div className="pt-6">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={load}
                disabled={loading}
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <InlineSpinner className="h-4 w-4 border-2" />
                    Refreshing
                  </span>
                ) : (
                  "Refresh"
                )}
              </Button>
            </div>
          </div>

          <div className="pt-6">
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openCreate}
            >
              New office
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-3">
            <Alert variant="danger">{error}</Alert>
          </div>
        )}

        <div className="mt-4">
          <Table<AdminOffice>
            columns={[
              {
                key: "code",
                header: "Code",
                render: (o) => (
                  <span className="font-mono text-xs">{o.code}</span>
                ),
              },
              {
                key: "name",
                header: "Name",
                render: (o) => (
                  <span className="font-medium text-slate-900 dark:text-slate-100">
                    {o.name}
                  </span>
                ),
              },
              {
                key: "type",
                header: "Type",
                render: (o) => (
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {o.type ?? "office"}
                  </span>
                ),
              },
              {
                key: "cluster_kind",
                header: "Cluster",
                render: (o) => (
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {o.cluster_kind ?? "-"}
                  </span>
                ),
              },
              {
                key: "parent",
                header: "Parent",
                render: (o) => (
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    {o.parentOffice
                      ? `${o.parentOffice.name} (${o.parentOffice.code})`
                      : "-"}
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
                      className={`text-xs font-medium ${isDisabled ? "text-rose-700 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-400"}`}
                    >
                      {isDisabled ? "Disabled" : "Active"}
                    </span>
                  );
                },
              },
              {
                key: "actions",
                header: "Actions",
                render: (o) => (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEdit(o);
                      }}
                    >
                      Edit
                    </Button>
                  </div>
                ),
              },
            ]}
            rows={visible}
            loading={loading}
            error={error}
            emptyMessage={loading ? "Loading offices…" : "No offices found."}
            rowKey={(o) => o.id}
          />
        </div>
      </Card>

      <OfficeEditModal
        open={modalOpen}
        mode={modalMode}
        office={selected}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          load();
        }}
      />
    </PageFrame>
  );
}

export default OfficeManagerPage;
