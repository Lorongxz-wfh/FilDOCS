import React from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import OfficeDropdown from "../OfficeDropdown";
import TemplatesBrowserPanel from "../templates/TemplatesBrowserPanel";
import { createDocumentRequest } from "../../services/documentRequests";

const MAX_RECIPIENTS = 5;

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function CreateDocumentRequestModal({ open, onClose }: Props) {
  const navigate = useNavigate();

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [officeIds, setOfficeIds] = React.useState<number[]>([0]);
  const [exampleFile, setExampleFile] = React.useState<File | null>(null);
  const [templatesPanelOpen, setTemplatesPanelOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const selectedOfficeIds = React.useMemo(
    () => officeIds.filter((x) => x > 0),
    [officeIds],
  );

  const reset = () => {
    setTitle("");
    setDescription("");
    setDueAt("");
    setOfficeIds([0]);
    setExampleFile(null);
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const addRecipient = () => {
    setOfficeIds((prev) =>
      prev.length >= MAX_RECIPIENTS ? prev : [...prev, 0],
    );
  };

  const removeRecipient = (idx: number) => {
    setOfficeIds((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [0];
    });
  };

  const updateRecipient = (idx: number, officeId: number | null) => {
    setOfficeIds((prev) => {
      const next = [...prev];
      next[idx] = officeId ?? 0;
      const seen = new Set<number>();
      return next.map((id) => {
        if (!id) return 0;
        if (seen.has(id)) return 0;
        seen.add(id);
        return id;
      });
    });
  };

  const validate = (): string | null => {
    if (!title.trim()) return "Title is required.";
    if (officeIds.some((x) => x === 0))
      return "Please select an office for each recipient row.";
    if (selectedOfficeIds.length < 1)
      return "Please add at least 1 recipient office.";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setError(v);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await createDocumentRequest({
        title: title.trim(),
        description: description.trim() || null,
        due_at: dueAt || null,
        office_ids: selectedOfficeIds,
        example_file: exampleFile,
      });

      handleClose();
      navigate(`/document-requests/${result.id}`);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? e?.message ?? "Failed to create request.",
      );
    } finally {
      setLoading(false);
    }
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={handleClose}
        disabled={loading}
        className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50 transition"
      >
        Cancel
      </button>
      <button
        type="submit"
        form="create-doc-request-form"
        disabled={loading}
        className="rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 transition"
      >
        {loading ? "Creating…" : "Create request"}
      </button>
    </>
  );

  return (
    <>
      <Modal
        open={open}
        title="Create Document Request"
        onClose={handleClose}
        widthClassName="max-w-xl"
        headerActions={headerActions}
      >
        <form
          id="create-doc-request-form"
          onSubmit={handleSubmit}
          className="space-y-4"
        >
          {/* Title */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. QMS Evidence Request – ISO 9001 Clause 7.5"
              required
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What should offices submit? Add clear instructions."
              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>

          {/* Due date + example file */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Due date/time (optional)
              </label>
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Example file (optional)
              </label>
              <input
                type="file"
                disabled={loading}
                onChange={(e) => setExampleFile(e.target.files?.[0] ?? null)}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-2 file:rounded-md file:border-0 file:bg-sky-50 dark:file:bg-sky-950/40 file:px-2 file:py-1 file:text-xs file:font-medium file:text-sky-700 dark:file:text-sky-400 disabled:opacity-60"
              />
            </div>
          </div>

          {/* Recipients */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-surface-400 dark:bg-surface-600/60">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                  Recipient offices
                </div>
                <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                  At least 1 required.
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRecipient}
                disabled={loading || officeIds.length >= MAX_RECIPIENTS}
              >
                + Add office
              </Button>
            </div>

            <div className="space-y-2">
              {officeIds.map((val, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-surface-400 dark:bg-surface-500"
                >
                  <div className="mt-2 text-xs font-medium text-slate-500 w-5">
                    {idx + 1}.
                  </div>
                  <div className="flex-1 min-w-0">
                    <OfficeDropdown
                      value={val > 0 ? val : null}
                      onChange={(id) => updateRecipient(idx, id)}
                      excludeOfficeIds={selectedOfficeIds.filter(
                        (id) => id !== val,
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => removeRecipient(idx)}
                    disabled={loading}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Templates shortcut */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setTemplatesPanelOpen(true)}
              className="text-xs text-sky-600 hover:underline dark:text-sky-400"
            >
              Browse templates
            </button>
          </div>

          {error && (
            <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          )}
        </form>
      </Modal>

      <TemplatesBrowserPanel
        open={templatesPanelOpen}
        onClose={() => setTemplatesPanelOpen(false)}
      />
    </>
  );
}
