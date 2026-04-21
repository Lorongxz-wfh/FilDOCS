import { useEffect, useMemo, useState } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import {
  listOffices,
  getDocumentShares,
  setDocumentShares,
  type Office,
} from "../../../services/documents";
import { Search, X, Users, Check } from "lucide-react";

type Props = {
  open: boolean;
  documentId: number | null;
  onClose: () => void;
  onSaved?: () => void;
};

export default function WorkflowShareModal({ open, documentId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [offices, setOffices] = useState<Office[]>([]);
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const filteredOffices = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return offices;
    return offices.filter(
      (o) => o.name.toLowerCase().includes(s) || o.code.toLowerCase().includes(s),
    );
  }, [offices, q]);

  useEffect(() => {
    if (!open || !documentId) return;
    let alive = true;
    setError(null);
    setSuccess(false);
    setLoadingOffices(true);
    Promise.all([listOffices(), getDocumentShares(documentId as number)])
      .then(([all, shares]) => {
        if (!alive) return;
        setOffices(all.sort((a, b) => a.name.localeCompare(b.name)));
        setSelectedIds(shares.office_ids ?? []);
      })
      .catch((e: Error | any) => { if (alive) setError(e?.message ?? "Failed to load share settings."); })
      .finally(() => { if (alive) setLoadingOffices(false); });
    return () => { alive = false; };
  }, [open, documentId]);

  const toggle = (id: number) => {
    setSelectedIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const save = async () => {
    if (!documentId) return;
    setLoading(true);
    setError(null);
    try {
      await setDocumentShares(documentId, selectedIds);
      setSuccess(true);
      onSaved?.();
      setTimeout(() => { onClose(); setSuccess(false); }, 800);
    } catch (e: Error | any) {
      setError(e?.message ?? "Failed to save.");
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = selectedIds.length;

  return (
    <Modal
      open={open}
      title="Share document"
      onClose={() => { if (loading) return; onClose(); }}
      widthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-4">

        {/* Error */}
        {error && (
          <div className="flex items-start gap-2.5 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 px-3 py-2.5">
            <X className="h-3.5 w-3.5 text-rose-500 dark:text-rose-400 shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700 dark:text-rose-400">{error}</p>
          </div>
        )}

        {/* Summary bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <Users className="h-3.5 w-3.5" />
            {selectedCount === 0
              ? "No offices selected"
              : `${selectedCount} office${selectedCount !== 1 ? "s" : ""} selected`}
          </div>
          {selectedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              disabled={loading}
              className="text-xs font-medium text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search office name or code…"
            disabled={loadingOffices || loading}
            className="w-full rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 pl-9 pr-9 py-2 text-xs outline-none transition focus:border-brand-400 disabled:opacity-50 dark:text-slate-200 dark:placeholder-slate-500"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Office list */}
        <div className="rounded-md border border-slate-200 dark:border-surface-400 overflow-y-auto" style={{ height: "280px" }}>
            {loadingOffices ? (
              <div className="flex items-center justify-center gap-2 py-10">
                <div className="h-4 w-4 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
                <span className="text-xs text-slate-400">Loading offices…</span>
              </div>
            ) : filteredOffices.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <Users className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {q ? "No offices match your search." : "No offices found."}
                </p>
              </div>
            ) : (
              filteredOffices.map((o, i) => {
                const checked = selectedIds.includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => !loading && toggle(o.id)}
                    disabled={loading}
                    className={[
                      "w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left transition",
                      i > 0 ? "border-t border-slate-100 dark:border-surface-400" : "",
                      checked
                        ? "bg-brand-50 dark:bg-brand-500/15"
                        : "hover:bg-slate-50 dark:hover:bg-surface-400",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <p className={`text-xs font-medium truncate ${checked ? "text-brand-500 dark:text-brand-200" : "text-slate-800 dark:text-slate-200"}`}>
                        {o.name}
                      </p>
                      <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5">
                        {o.code}
                      </p>
                    </div>
                    <div className={[
                      "h-4 w-4 shrink-0 rounded flex items-center justify-center border transition",
                      checked
                        ? "bg-brand-500 border-brand-500"
                        : "border-slate-300 dark:border-surface-300",
                    ].join(" ")}>
                      {checked && <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />}
                    </div>
                  </button>
                );
              })
            )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {selectedCount > 0
              ? `Sharing to ${selectedCount} office${selectedCount !== 1 ? "s" : ""}`
              : "Document will be unshared from all offices"}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={loading} onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              loading={loading}
              onClick={save}
            >
              {success ? (
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5" /> Saved
                </span>
              ) : "Save shares"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
