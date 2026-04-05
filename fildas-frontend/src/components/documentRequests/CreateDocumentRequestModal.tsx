import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal";
import { listOffices } from "../../services/documents";
import type { Office } from "../../services/documents";
import type { RequestMode } from "../../services/documentRequests";
import OfficeCheckList from "../ui/OfficeCheckList";
import { getAuthUser } from "../../lib/auth";

type Props = {
  open: boolean;
  onClose: () => void;
};

import { inputCls, labelCls, choiceCardCls } from "../../utils/formStyles";

export default function CreateDocumentRequestModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const me = getAuthUser();
  const myOffId = me?.office_id ? Number(me.office_id) : null;

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

  const filteredOffices = useMemo(() => {
    if (!myOffId) return offices;
    return offices.filter((o) => Number(o.id) !== myOffId);
  }, [offices, myOffId]);

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
        className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        className="rounded-md bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
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
      <div className="flex flex-col gap-4">
        {/* Mode selector */}
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              {
                value: "multi_office" as const,
                label: "Multiple Offices",
                desc: "One document requested from multiple offices",
              },
              {
                value: "multi_doc" as const,
                label: "Multiple Documents",
                desc: "Multiple documents requested from one office",
              },
            ] as const
          ).map((opt) => {
            const active = mode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setMode(opt.value);
                  setError(null);
                }}
                className={[choiceCardCls(active), "p-3.5"].join(" ")}
              >
                <div className="flex items-center gap-2 mb-1 pt-0.5">
                  <p
                    className={`text-xs font-bold uppercase tracking-wide ${active ? "text-neutral-900 dark:text-neutral-50" : "text-neutral-600 dark:text-neutral-400"}`}
                  >
                    {opt.label}
                  </p>
                </div>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed font-medium">
                  {opt.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Title */}
        <div className="space-y-1.5">
          <label className={labelCls}>
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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className={labelCls}>
                Recipient Offices{" "}
                <span className="text-rose-500 normal-case">*</span>
              </label>
              {selectedOfficeIds.length > 0 && (
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {selectedOfficeIds.length} selected
                </span>
              )}
            </div>
            <OfficeCheckList
              offices={filteredOffices}
              loading={officesLoading}
              selectedIds={selectedOfficeIds}
              onToggle={toggleOffice}
              multi={true}
              maxHeight="max-h-[200px]"
            />
            {selectedOffices.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-0.5">
                {selectedOffices.map((o) => (
                  <span
                    key={o.id}
                    className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-surface-300 bg-slate-50 dark:bg-surface-400/50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200"
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
          <div className="space-y-1.5">
            <label className={labelCls}>
              Recipient Office{" "}
              <span className="text-rose-500 normal-case">*</span>
            </label>
            <OfficeCheckList
              offices={filteredOffices}
              loading={officesLoading}
              selectedIds={selectedOfficeId ? [selectedOfficeId] : []}
              onToggle={selectSingleOffice}
              multi={false}
              maxHeight="max-h-[200px]"
            />
            {selectedOffice && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 rounded border border-slate-200 dark:border-surface-300 bg-slate-50 dark:bg-surface-400/50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-200">
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
          <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-400">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
