import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  listTemplates,
  downloadTemplate,
  templateFileTypeLabel,
  templateFileTypeColor,
  type DocumentTemplate,
} from "../../services/templates";
import {
  createTempPreview,
  deleteTempPreview,
  type TempPreview,
} from "../../services/previews";
import { useToast } from "../ui/toast/ToastContext";
import SkeletonList from "../ui/loader/SkeletonList";



type Props = {
  open: boolean;
  onClose: () => void;
};

const TemplatesBrowserPanel: React.FC<Props> = ({ open, onClose }) => {
  const { push } = useToast();

  // ── List state ─────────────────────────────────────────────
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [scope, setScope] = useState<"all" | "global" | "mine">("all");


  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const filtered = React.useMemo(() => {
    let list = templates;
    if (scope === "global") list = list.filter((t) => t.is_global);
    if (scope === "mine") list = list.filter((t) => t.can_delete);
    if (debouncedQ)
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(debouncedQ) ||
          t.original_filename.toLowerCase().includes(debouncedQ) ||
          (t.description ?? "").toLowerCase().includes(debouncedQ),
      );
    return list;
  }, [templates, debouncedQ, scope]);

  const fetchTemplates = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      setTemplates(await listTemplates());
    } catch (e: any) {
      setListError(e?.message ?? "Failed to load templates.");
    } finally {
      setLoadingList(false);
    }
  }, []);

  // Fetch once when opened
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (open && !fetchedRef.current) {
      fetchedRef.current = true;
      fetchTemplates();
    }
    if (!open) setSelected(null);
  }, [open, fetchTemplates]);

  // ── Detail / preview state ─────────────────────────────────
  const [selected, setSelected] = useState<DocumentTemplate | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<TempPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const seqRef = useRef(0);
  const previewRef = useRef<TempPreview | null>(null);

  const cleanupPreview = (p: TempPreview | null) => {
    if (!p) return;
    deleteTempPreview(p.year, p.id).catch(() => {});
  };

  useEffect(() => {
    if (!selected) {
      cleanupPreview(previewRef.current);
      previewRef.current = null;
      setPreview(null);
      setPreviewLoading(false);
      setPreviewError(null);
      return;
    }

    seqRef.current += 1;
    const seq = seqRef.current;
    cleanupPreview(previewRef.current);
    previewRef.current = null;
    setPreview(null);
    setPreviewLoading(true);
    setPreviewError(null);

    (async () => {
      try {
        const api = (await import("../../services/api")).default;
        const res = await api.get(`/templates/${selected.id}/download`, {
          responseType: "blob",
        });
        const file = new File([res.data as Blob], selected.original_filename, {
          type: selected.mime_type,
        });
        const result = await createTempPreview(file);
        if (seq !== seqRef.current) return;
        previewRef.current = result;
        setPreview(result);
      } catch (e: any) {
        if (seq !== seqRef.current) return;
        setPreviewError(e?.message ?? "Failed to generate preview.");
      } finally {
        if (seq !== seqRef.current) return;
        setPreviewLoading(false);
      }
    })();

    return () => {
      seqRef.current += 1;
    };
  }, [selected?.id]);

  useEffect(() => () => cleanupPreview(previewRef.current), []);

  // Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selected) setSelected(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, selected, onClose]);

  const handleDownload = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      await downloadTemplate(selected.id, selected.original_filename);
    } catch (e: any) {
      push({
        type: "error",
        title: "Download failed",
        message: e?.message ?? "Unknown error",
      });
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <button
          type="button"
          aria-label="Close templates panel"
          onClick={onClose}
          className="fixed inset-0 z-[90] bg-slate-900/40 dark:bg-black/50"
        />
      )}

      {/* Panel */}
      <div
        className={[
          "fixed inset-y-0 right-0 z-[100] flex w-full max-w-2xl flex-col",
          "border-l border-slate-200 dark:border-surface-400",
          "bg-white dark:bg-surface-500 shadow-2xl",
          "transition-transform duration-300 ease-in-out",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        {/* Panel header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 bg-slate-50/80 dark:bg-surface-600/80 px-5 py-4">
          <div className="flex items-center gap-2">
            {selected && (
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:text-slate-500 dark:hover:bg-surface-400 transition"
                aria-label="Back to list"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selected ? selected.name : "Templates"}
              </p>
              {!selected && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Browse and preview available templates
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">

            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition"
            >
              ✕
            </button>
          </div>
        </div>

        {/* LIST VIEW */}
        {!selected && (
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Toolbar */}
            <div className="shrink-0 border-b border-slate-200 dark:border-surface-400 px-5 py-3 space-y-2">
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search templates…"
                className="w-full rounded-md border border-slate-300 dark:border-surface-400 bg-white dark:bg-surface-400 px-3 py-2 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-brand-400 dark:focus:border-brand-300 transition"
              />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-1">
                  {(["all", "global", "mine"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setScope(s)}
                      className={[
                        "rounded-md px-3 py-1 text-xs font-medium capitalize transition",
                        scope === s
                          ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100  border border-slate-200 dark:border-surface-400"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                      ].join(" ")}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                {templates.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {filtered.length} of {templates.length}
                  </span>
                )}
              </div>
            </div>

            {/* List / Grid */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {listError ? (
                <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
                  {listError}
                  <button
                    type="button"
                    className="ml-2 underline"
                    onClick={fetchTemplates}
                  >
                    Retry
                  </button>
                </div>
              ) : loadingList ? (
                <SkeletonList rows={5} rowClassName="h-16 rounded-xl" />
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {templates.length === 0
                      ? "No templates yet."
                      : "No templates match your search."}
                  </p>
                </div>

              ) : (
                <div className="space-y-2">
                  {filtered.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelected(t)}
                      className="w-full text-left flex items-start gap-3 rounded-xl border border-slate-200 dark:border-surface-400 bg-transparent px-4 py-3 transition hover:border-sky-300 dark:hover:border-sky-700 hover:bg-slate-50/50 dark:hover:bg-surface-400/30"
                    >
                      <div className="shrink-0 pt-0.5">
                        <span
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide ${templateFileTypeColor(t.mime_type)}`}
                        >
                          {templateFileTypeLabel(t.mime_type)}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                            {t.name}
                          </p>
                          {t.is_global ? (
                            <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">
                              Global
                            </span>
                          ) : t.office ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-surface-400 border border-slate-200 dark:border-surface-300 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                              {t.office.code}
                            </span>
                          ) : null}
                        </div>
                        {t.description && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {t.description}
                          </p>
                        )}
                        <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-400 dark:text-slate-500">
                          <span>{t.file_size_label}</span>
                          {t.uploaded_by && (
                            <span>by {t.uploaded_by.name}</span>
                          )}
                        </div>
                      </div>
                      <svg
                        className="h-4 w-4 shrink-0 mt-1 text-slate-300 dark:text-slate-600"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* DETAIL VIEW */}
        {selected && (
          <>
            {/* Meta + actions */}
            <div className="shrink-0 border-b border-slate-200 dark:border-surface-400 px-5 py-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold tracking-wide ${templateFileTypeColor(selected.mime_type)}`}
                >
                  {templateFileTypeLabel(selected.mime_type)}
                </span>
                {selected.is_global ? (
                  <span className="inline-flex items-center rounded-full bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800 px-2 py-0.5 text-xs font-medium text-violet-700 dark:text-violet-400">
                    Global
                  </span>
                ) : selected.office ? (
                  <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-surface-400 border border-slate-200 dark:border-surface-300 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {selected.office.code}
                  </span>
                ) : null}
              </div>
              {selected.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {selected.description}
                </p>
              )}
              <div className="flex flex-wrap gap-x-3 text-xs text-slate-400 dark:text-slate-500">
                <span>{selected.original_filename}</span>
                <span>{selected.file_size_label}</span>
                {selected.uploaded_by && (
                  <span>by {selected.uploaded_by.name}</span>
                )}
                <span>
                  {new Date(selected.created_at).toLocaleDateString()}
                </span>
              </div>
              <button
                type="button"
                disabled={downloading}
                onClick={handleDownload}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50"
              >
                {downloading ? "Downloading…" : "↓ Download"}
              </button>
            </div>

            {/* Preview */}
            <div className="flex-1 overflow-hidden p-4">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
                  <div className="text-center">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Generating preview…
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Office files may take a few seconds.
                    </p>
                  </div>
                </div>
              ) : previewError ? (
                <div className="flex h-full items-center justify-center rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30">
                  <div className="text-center px-6">
                    <p className="text-sm text-rose-700 dark:text-rose-400">
                      Preview unavailable
                    </p>
                    <p className="mt-1 text-xs text-rose-500">{previewError}</p>
                    <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                      You can still download the file.
                    </p>
                  </div>
                </div>
              ) : preview?.url ? (
                <iframe
                  title="Template preview"
                  src={preview.url}
                  className="h-full w-full rounded-xl border border-slate-200 dark:border-surface-400"
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default TemplatesBrowserPanel;
