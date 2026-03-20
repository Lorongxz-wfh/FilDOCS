import React, { useState, useEffect, useCallback } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import { createDocumentRequest, uploadDocumentRequestItemExample } from "../services/documentRequests";
import type { RequestMode } from "../services/documentRequests";
import {
  createTempPreview,
  deleteTempPreview,
  type TempPreview,
} from "../services/previews";
import PageFrame from "../components/layout/PageFrame";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { inputCls } from "../utils/formStyles";

const Field: React.FC<{
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, required, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
      {label} {required && <span className="text-rose-500 normal-case">*</span>}
    </label>
    {children}
    {hint && (
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
    )}
  </div>
);

type DocItem = {
  title: string;
  description: string;
  file: File | null;
  tempPreview: TempPreview | null;
  previewLoading: boolean;
  previewError: string | null;
};

const MAX_ITEMS = 10;

type MultiOfficeState = {
  mode: "multi_office";
  title: string;
  officeIds: number[];
  officeNames: string[];
  officeCodes: string[];
};

type MultiDocState = {
  mode: "multi_doc";
  title: string;
  officeId: number;
  officeName: string;
  officeCode: string;
};

type LocationState = MultiOfficeState | MultiDocState | null;

export default function CreateDocumentRequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const state = location.state as LocationState;
  if (!state?.title) return <Navigate to="/document-requests" replace />;

  const mode = state.mode as RequestMode;

  // Validate required fields per mode
  if (mode === "multi_office" && !(state as MultiOfficeState).officeIds?.length)
    return <Navigate to="/document-requests" replace />;
  if (mode === "multi_doc" && !(state as MultiDocState).officeId)
    return <Navigate to="/document-requests" replace />;

  const { title } = state;

  // ── Shared form state ──────────────────────────────────────────────────────
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Multi-office: single example file + preview ────────────────────────────
  const [exFile, setExFile] = useState<File | null>(null);
  const [exTempPreview, setExTempPreview] = useState<TempPreview | null>(null);
  const [exPreviewLoading, setExPreviewLoading] = useState(false);
  const [exPreviewError, setExPreviewError] = useState<string | null>(null);
  const exPreviewSeqRef = React.useRef(0);

  // ── Multi-doc: items accordion ─────────────────────────────────────────────
  const [items, setItems] = useState<DocItem[]>([
    {
      title: "",
      description: "",
      file: null,
      tempPreview: null,
      previewLoading: false,
      previewError: null,
    },
  ]);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);
  const itemPreviewSeqRefs = React.useRef<number[]>([0]);

  // Active preview for right panel
  // multi_office: exTempPreview
  // multi_doc: preview of currently expanded item
  const activePreview =
    mode === "multi_office"
      ? {
          url: exTempPreview?.url ?? null,
          loading: exPreviewLoading,
          error: exPreviewError,
        }
      : {
          url: items[expandedIdx]?.tempPreview?.url ?? null,
          loading: items[expandedIdx]?.previewLoading ?? false,
          error: items[expandedIdx]?.previewError ?? null,
        };

  // ── Temp preview helpers ───────────────────────────────────────────────────
  const cleanupPreview = useCallback((p: TempPreview | null) => {
    if (!p) return;
    deleteTempPreview(p.year, p.id).catch(() => {});
  }, []);

  // Multi-office example file preview
  useEffect(() => {
    if (!exFile) {
      setExPreviewLoading(false);
      setExPreviewError(null);
      setExTempPreview((prev) => {
        cleanupPreview(prev);
        return null;
      });
      return;
    }
    exPreviewSeqRef.current += 1;
    const seq = exPreviewSeqRef.current;
    setExTempPreview((prev) => {
      cleanupPreview(prev);
      return null;
    });
    setExPreviewLoading(true);
    setExPreviewError(null);
    (async () => {
      try {
        const result = await createTempPreview(exFile);
        if (seq !== exPreviewSeqRef.current) return;
        setExTempPreview(result);
      } catch (e: any) {
        if (seq !== exPreviewSeqRef.current) return;
        setExPreviewError(e?.message ?? "Failed to generate preview");
      } finally {
        if (seq !== exPreviewSeqRef.current) return;
        setExPreviewLoading(false);
      }
    })();
  }, [exFile]);

  // Multi-doc item file preview
  const handleItemFileChange = (idx: number, file: File | null) => {
    if (!itemPreviewSeqRefs.current[idx]) itemPreviewSeqRefs.current[idx] = 0;
    itemPreviewSeqRefs.current[idx] += 1;
    const seq = itemPreviewSeqRefs.current[idx];

    setItems((prev) => {
      const next = [...prev];
      cleanupPreview(next[idx].tempPreview);
      next[idx] = {
        ...next[idx],
        file,
        tempPreview: null,
        previewLoading: !!file,
        previewError: null,
      };
      return next;
    });

    if (!file) return;

    (async () => {
      try {
        const result = await createTempPreview(file);
        if (seq !== itemPreviewSeqRefs.current[idx]) return;
        setItems((prev) => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            tempPreview: result,
            previewLoading: false,
          };
          return next;
        });
      } catch (e: any) {
        if (seq !== itemPreviewSeqRefs.current[idx]) return;
        setItems((prev) => {
          const next = [...prev];
          next[idx] = {
            ...next[idx],
            previewError: e?.message ?? "Failed",
            previewLoading: false,
          };
          return next;
        });
      }
    })();
  };

  const addItem = () => {
    if (items.length >= MAX_ITEMS) return;
    itemPreviewSeqRefs.current.push(0);
    setItems((prev) => [
      ...prev,
      {
        title: "",
        description: "",
        file: null,
        tempPreview: null,
        previewLoading: false,
        previewError: null,
      },
    ]);
    setExpandedIdx(items.length);
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    cleanupPreview(items[idx].tempPreview);
    itemPreviewSeqRefs.current.splice(idx, 1);
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setExpandedIdx((prev) => Math.max(0, prev >= idx ? prev - 1 : prev));
  };

  const updateItem = (
    idx: number,
    field: "title" | "description",
    val: string,
  ) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "multi_doc") {
      const emptyTitle = items.findIndex((it) => !it.title.trim());
      if (emptyTitle !== -1) {
        setError(`Document item ${emptyTitle + 1} needs a title.`);
        setExpandedIdx(emptyTitle);
        return;
      }
    }

    setLoading(true);
    setError(null);

    try {
      let result: { id: number };

      if (mode === "multi_office") {
        const s = state as MultiOfficeState;
        result = await createDocumentRequest({
          mode: "multi_office",
          title,
          description: description.trim() || null,
          due_at: dueAt || null,
          office_ids: s.officeIds,
          example_file: exFile,
        });
        cleanupPreview(exTempPreview);
      } else {
        const s = state as MultiDocState;
        result = await createDocumentRequest({
          mode: "multi_doc",
          title,
          description: description.trim() || null,
          due_at: dueAt || null,
          office_id: s.officeId,
          items: items.map((it) => ({
            title: it.title.trim(),
            description: it.description.trim() || null,
          })),
        });
        const itemIds: number[] = (result as any).item_ids ?? [];
        for (let i = 0; i < items.length; i++) {
          if (items[i].file && itemIds[i]) {
            try {
              await uploadDocumentRequestItemExample(itemIds[i], items[i].file!);
            } catch { /* example upload failure is non-blocking */ }
          }
        }
        items.forEach((it) => cleanupPreview(it.tempPreview));
      }

      navigate(`/document-requests/${result.id}`);
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          err?.message ??
          "Failed to create request.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const officeCodes =
    mode === "multi_office"
      ? (state as MultiOfficeState).officeCodes
      : [(state as MultiDocState).officeCode];

  const barLabel = mode === "multi_office" ? "Recipients" : "Office";

  return (
    <PageFrame
      title="New Document Request"
      onBack={() => {
        cleanupPreview(exTempPreview);
        items.forEach((it) => cleanupPreview(it.tempPreview));
        navigate(-1);
      }}
      contentClassName="flex flex-col gap-4 h-full"
    >
      {/* Mode + recipients bar */}
      <div className="flex items-center gap-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <div className="shrink-0 hidden sm:flex flex-col items-start justify-center px-4 py-2.5 border-r border-slate-200 dark:border-surface-400 gap-0.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            {mode === "multi_office" ? "Multi-Office" : "Multi-Doc"}
          </span>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {barLabel}
          </span>
        </div>
        <div className="flex-1 min-w-0 overflow-x-auto px-4 py-2.5">
          <div className="flex items-center gap-1 flex-nowrap">
            {officeCodes.map((code, i) => (
              <React.Fragment key={i}>
                <span className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shrink-0 bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400 text-slate-600 dark:text-slate-300">
                  {code}
                </span>
                {i < officeCodes.length - 1 && (
                  <span className="text-slate-300 dark:text-slate-600 text-xs shrink-0">
                    ·
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="shrink-0 border-l border-slate-200 dark:border-surface-400">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition h-full"
          >
            Edit
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 flex-1 min-h-0">
        {/* Left: form */}
        <div className="lg:col-span-3 lg:overflow-y-auto lg:max-h-[calc(100vh-220px)]">
          <form id="create-doc-request-form" onSubmit={handleSubmit}>
            <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
              {/* Card header */}
              <div className="px-5 py-4 border-b border-slate-200 dark:border-surface-400">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Request details
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {title}
                </p>
              </div>

              <div className="px-5 py-5 flex flex-col gap-5">
                {/* Shared fields */}
                <Field
                  label="Description"
                  hint="Overall context for this request."
                >
                  <textarea
                    rows={2.5}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe the overall request…"
                    className={inputCls}
                  />
                </Field>

                <Field
                  label="Due date"
                  hint="Optional deadline for submissions."
                >
                  <input
                    type="datetime-local"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                {/* Multi-office: single example file */}
                {mode === "multi_office" && (
                  <Field
                    label="Example file"
                    hint="Optional reference file for all recipient offices. (max 10 MB)"
                  >
                    <input
                      type="file"
                      disabled={loading}
                      onChange={(e) => setExFile(e.target.files?.[0] ?? null)}
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                      className="w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 dark:file:bg-sky-950/40 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700 dark:file:text-sky-400 hover:file:bg-sky-100 disabled:opacity-60"
                    />
                  </Field>
                )}

                {/* Multi-doc: document items accordion */}
                {mode === "multi_doc" && (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">
                        Document Items{" "}
                        <span className="text-rose-500 normal-case">*</span>
                      </label>
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">
                        {items.length} / {MAX_ITEMS}
                      </span>
                    </div>

                    {/* Accordion items */}
                    <div className="rounded-xl border border-slate-200 dark:border-surface-400 overflow-hidden divide-y divide-slate-100 dark:divide-surface-400">
                      {items.map((item, idx) => {
                        const isOpen = expandedIdx === idx;
                        return (
                          <div key={idx}>
                            {/* Item header */}
                            <button
                              type="button"
                              onClick={() => setExpandedIdx(isOpen ? -1 : idx)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                            >
                              <span className="shrink-0 text-xs font-bold text-slate-400 dark:text-slate-500 w-5">
                                {idx + 1}.
                              </span>
                              <span
                                className={[
                                  "flex-1 text-sm font-medium truncate",
                                  item.title
                                    ? "text-slate-800 dark:text-slate-100"
                                    : "text-slate-400 dark:text-slate-500 italic",
                                ].join(" ")}
                              >
                                {item.title || "Untitled document"}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                {item.file && (
                                  <span className="text-[10px] font-medium text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/30 rounded-full px-2 py-0.5">
                                    File attached
                                  </span>
                                )}
                                {items.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeItem(idx);
                                    }}
                                    className="p-1 rounded-md text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                {isOpen ? (
                                  <ChevronUp className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </button>

                            {/* Item body */}
                            {isOpen && (
                              <div className="px-4 pt-3 pb-4 flex flex-col gap-3 bg-slate-50/50 dark:bg-surface-600/50">
                                <Field label="Document title" required>
                                  <input
                                    type="text"
                                    value={item.title}
                                    onChange={(e) =>
                                      updateItem(idx, "title", e.target.value)
                                    }
                                    placeholder="e.g. ISO Certificate, Audit Report"
                                    className={inputCls}
                                    autoFocus={idx === items.length - 1}
                                  />
                                </Field>
                                <Field
                                  label="Description"
                                  hint="What should the office submit for this document?"
                                >
                                  <textarea
                                    rows={2}
                                    value={item.description}
                                    onChange={(e) =>
                                      updateItem(
                                        idx,
                                        "description",
                                        e.target.value,
                                      )
                                    }
                                    placeholder="Optional instructions…"
                                    className={inputCls}
                                  />
                                </Field>
                                <Field
                                  label="Example file"
                                  hint="Optional reference file for this document. (max 10 MB)"
                                >
                                  <input
                                    type="file"
                                    disabled={loading}
                                    onChange={(e) =>
                                      handleItemFileChange(
                                        idx,
                                        e.target.files?.[0] ?? null,
                                      )
                                    }
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                    className="w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 dark:file:bg-sky-950/40 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700 dark:file:text-sky-400 hover:file:bg-sky-100 disabled:opacity-60"
                                  />
                                </Field>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Add item button */}
                    {items.length < MAX_ITEMS && (
                      <button
                        type="button"
                        onClick={addItem}
                        className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 dark:border-surface-400 px-4 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add document item
                      </button>
                    )}
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-400">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      cleanupPreview(exTempPreview);
                      items.forEach((it) => cleanupPreview(it.tempPreview));
                      navigate(-1);
                    }}
                    disabled={loading}
                    className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition"
                  >
                    {loading ? "Creating…" : "Create request"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Right: preview */}
        <div className="lg:col-span-2 flex flex-col min-h-0">
          <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col h-full">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-surface-400">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {mode === "multi_doc" && expandedIdx >= 0
                  ? `Preview — ${items[expandedIdx]?.title?.trim() || `Item ${expandedIdx + 1}`}`
                  : "Example file preview"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                PDF is instant · Office files convert first
              </p>
            </div>
            <div className="flex-1 p-4 min-h-0">
              {!activePreview.url &&
              !activePreview.loading &&
              !activePreview.error ? (
                <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-surface-400">
                  <p className="text-sm text-slate-400 dark:text-slate-500 text-center px-4">
                    {mode === "multi_doc"
                      ? "Attach a file to an item to preview it here"
                      : "Attach an example file to preview it here"}
                  </p>
                </div>
              ) : activePreview.loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Generating preview…
                  </p>
                </div>
              ) : activePreview.error ? (
                <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-700 dark:text-rose-400">
                  {activePreview.error}
                  <p className="mt-1 opacity-70">
                    You can still create without a preview.
                  </p>
                </div>
              ) : activePreview.url ? (
                <iframe
                  title="File preview"
                  src={activePreview.url}
                  className="h-full w-full rounded-lg border border-slate-200 dark:border-surface-400"
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}
