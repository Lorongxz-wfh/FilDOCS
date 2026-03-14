import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal";
import { listOffices } from "../../services/documents";
import type { Office } from "../../services/documents";
import { Search, Check, Users, FileStack } from "lucide-react";
import type { RequestMode } from "../../services/documentRequests";

type Props = {
  open: boolean;
  onClose: () => void;
};

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition";

// ── Reusable office checkbox list ──────────────────────────────────────────
const OfficeCheckList: React.FC<{
  offices: Office[];
  loading: boolean;
  selectedIds: number[];
  onToggle: (id: number) => void;
  multi?: boolean; // false = single select (radio behavior)
}> = ({ offices, loading, selectedIds, onToggle, multi = true }) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return offices;
    return offices.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [offices, search]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 dark:border-surface-400 flex items-center gap-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offices…"
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>
      <ul className="max-h-48 overflow-y-auto py-1">
        {loading ? (
          <li className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
            Loading offices…
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
            No offices found.
          </li>
        ) : (
          filtered.map((office) => {
            const isSelected = selectedIds.includes(office.id);
            return (
              <li key={office.id}>
                <button
                  type="button"
                  onClick={() => onToggle(office.id)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2 text-sm transition",
                    isSelected
                      ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400",
                  ].join(" ")}
                >
                  {multi ? (
                    <span
                      className={[
                        "h-4 w-4 shrink-0 rounded border flex items-center justify-center transition",
                        isSelected
                          ? "bg-sky-500 border-sky-500"
                          : "border-slate-300 dark:border-surface-300 bg-white dark:bg-surface-600",
                      ].join(" ")}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </span>
                  ) : (
                    <span
                      className={[
                        "h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition",
                        isSelected
                          ? "border-sky-500"
                          : "border-slate-300 dark:border-surface-300",
                      ].join(" ")}
                    >
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                      )}
                    </span>
                  )}
                  <span className="flex-1 text-left font-medium truncate">
                    {office.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {office.code}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

export default function CreateDocumentRequestModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  const [mode, setMode] = useState<RequestMode>("multi_office");
  const [title, setTitle] = useState("");
  const [selectedOfficeIds, setSelectedOfficeIds] = useState<number[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOfficesLoading(true);
    listOffices()
      .then((data) =>
        setOffices(data.sort((a, b) => a.name.localeCompare(b.name))),
      )
      .catch(() => {})
      .finally(() => setOfficesLoading(false));
  }, [open]);

  const selectedOffices = useMemo(
    () => offices.filter((o) => selectedOfficeIds.includes(o.id)),
    [offices, selectedOfficeIds],
  );

  const selectedOffice = useMemo(
    () => offices.find((o) => o.id === selectedOfficeId) ?? null,
    [offices, selectedOfficeId],
  );

  const toggleOffice = (id: number) => {
    setSelectedOfficeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
    setError(null);
  };

  const selectSingleOffice = (id: number) => {
    setSelectedOfficeId((prev) => (prev === id ? null : id));
    setError(null);
  };

  const reset = () => {
    setMode("multi_office");
    setTitle("");
    setSelectedOfficeIds([]);
    setSelectedOfficeId(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleConfirm = () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }

    if (mode === "multi_office") {
      if (selectedOfficeIds.length === 0) {
        setError("Select at least 1 recipient office.");
        return;
      }
      handleClose();
      navigate("/document-requests/create", {
        state: {
          mode: "multi_office",
          title: title.trim(),
          officeIds: selectedOfficeIds,
          officeNames: selectedOffices.map((o) => o.name),
          officeCodes: selectedOffices.map((o) => o.code),
        },
      });
    } else {
      if (!selectedOfficeId) {
        setError("Select a recipient office.");
        return;
      }
      handleClose();
      navigate("/document-requests/create", {
        state: {
          mode: "multi_doc",
          title: title.trim(),
          officeId: selectedOfficeId,
          officeName: selectedOffice?.name ?? "",
          officeCode: selectedOffice?.code ?? "",
        },
      });
    }
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleClose}
        className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        className="rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
      >
        Continue
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      title="New Document Request"
      onClose={handleClose}
      widthClassName="max-w-lg"
      headerActions={headerActions}
    >
      <div className="flex flex-col gap-5">
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "multi_office" as const,
                icon: Users,
                label: "Multiple Offices",
                desc: "One document requested from multiple offices",
              },
              {
                value: "multi_doc" as const,
                icon: FileStack,
                label: "Multiple Documents",
                desc: "Multiple documents requested from one office",
              },
            ] as const
          ).map((opt) => {
            const Icon = opt.icon;
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setMode(opt.value);
                  setError(null);
                }}
                className={[
                  "rounded-xl border px-4 py-3 text-left transition",
                  active
                    ? "border-sky-400 bg-sky-50 dark:bg-sky-950/40 dark:border-sky-600"
                    : "border-slate-200 dark:border-surface-400 hover:bg-slate-50 dark:hover:bg-surface-400",
                ].join(" ")}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon
                    className={`h-3.5 w-3.5 ${active ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`}
                  />
                  <p
                    className={`text-xs font-semibold ${active ? "text-sky-700 dark:text-sky-400" : "text-slate-700 dark:text-slate-300"}`}
                  >
                    {opt.label}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
            Title <span className="text-rose-500 normal-case">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError(null);
            }}
            placeholder={
              mode === "multi_office"
                ? "e.g. QMS Evidence Request – ISO 9001 Clause 7.5"
                : "e.g. IT Office Document Compliance Checklist"
            }
            className={inputCls}
            autoFocus
          />
        </div>

        {/* Offices */}
        {mode === "multi_office" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                Recipient Offices{" "}
                <span className="text-rose-500 normal-case">*</span>
              </label>
              {selectedOfficeIds.length > 0 && (
                <span className="text-[11px] font-medium text-brand-500 dark:text-brand-400">
                  {selectedOfficeIds.length} selected
                </span>
              )}
            </div>
            <OfficeCheckList
              offices={offices}
              loading={officesLoading}
              selectedIds={selectedOfficeIds}
              onToggle={toggleOffice}
              multi={true}
            />
            {selectedOffices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {selectedOffices.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400"
                  >
                    {o.code}
                    <button
                      type="button"
                      onClick={() => toggleOffice(o.id)}
                      className="hover:text-sky-900 dark:hover:text-sky-200"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
              Recipient Office{" "}
              <span className="text-rose-500 normal-case">*</span>
            </label>
            <OfficeCheckList
              offices={offices}
              loading={officesLoading}
              selectedIds={selectedOfficeId ? [selectedOfficeId] : []}
              onToggle={selectSingleOffice}
              multi={false}
            />
            {selectedOffice && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-2.5 py-0.5 text-[11px] font-medium text-sky-700 dark:text-sky-400">
                  {selectedOffice.code} — {selectedOffice.name}
                  <button
                    type="button"
                    onClick={() => setSelectedOfficeId(null)}
                    className="hover:text-sky-900 dark:hover:text-sky-200"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
