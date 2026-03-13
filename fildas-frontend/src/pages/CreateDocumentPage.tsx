import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import {
  createDocumentWithProgress,
  setDocumentTags,
} from "../services/documents";
import {
  createTempPreview,
  deleteTempPreview,
  type TempPreview,
} from "../services/previews";
import OfficeDropdown from "../components/OfficeDropdown";
import PageFrame from "../components/layout/PageFrame";
import TemplatesBrowserPanel from "../components/templates/TemplatesBrowserPanel";

// ── Field wrapper ──────────────────────────────────────────────────────────────
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

const inputCls =
  "w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition";
const selectCls = inputCls + " cursor-pointer";

const CreateDocumentPage: React.FC = () => {
  const navigate = useNavigate();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const rawRole =
    typeof (me as any).role === "string"
      ? (me as any).role
      : (me as any).role?.name;
  const roleName = String(rawRole ?? "").toLowerCase();
  const allowed = new Set(["qa", "office_staff", "office_head"]);
  if (!allowed.has(roleName)) return <Navigate to="/work-queue" replace />;

  const isQA = roleName === "qa";
  const MAX_CUSTOM = 5;

  const [step, setStep] = useState<1 | 2>(1);
  const [routingMode, setRoutingMode] = useState<"default" | "custom">(
    "default",
  );
  const [customReviewOfficeIds, setCustomReviewOfficeIds] = useState<number[]>([
    0,
  ]);
  const [reviewOfficeId, setReviewOfficeId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [doctype, setDoctype] = useState<"internal" | "external" | "forms">(
    "internal",
  );
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [effectiveDate, setEffectiveDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [tempPreview, setTempPreview] = useState<TempPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [templatesPanelOpen, setTemplatesPanelOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<
    string,
    string[]
  > | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const previewSeqRef = React.useRef(0);

  const customSelectedIds = useMemo(
    () => customReviewOfficeIds.filter((x) => x > 0),
    [customReviewOfficeIds],
  );

  const cleanupTempPreview = (p: TempPreview | null) => {
    if (!p) return;
    deleteTempPreview(p.year, p.id).catch(() => {});
  };

  const previewUrl = useMemo(() => {
    if (!file) return "";
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (!file) {
      setPreviewLoading(false);
      setPreviewError(null);
      setTempPreview((prev) => {
        cleanupTempPreview(prev);
        return null;
      });
      return;
    }
    previewSeqRef.current += 1;
    const seq = previewSeqRef.current;
    setTempPreview((prev) => {
      cleanupTempPreview(prev);
      return null;
    });
    setPreviewLoading(true);
    setPreviewError(null);
    (async () => {
      try {
        const result = await createTempPreview(file);
        if (seq !== previewSeqRef.current) return;
        setTempPreview(result);
      } catch (e: any) {
        if (seq !== previewSeqRef.current) return;
        setPreviewError(e?.message ?? "Failed to generate preview");
      } finally {
        if (seq !== previewSeqRef.current) return;
        setPreviewLoading(false);
      }
    })();
  }, [file]);

  const addCustomRecipient = () => {
    setCustomReviewOfficeIds((p) => (p.length >= MAX_CUSTOM ? p : [...p, 0]));
  };

  const removeCustomRecipient = (idx: number) => {
    setCustomReviewOfficeIds((p) => {
      const next = p.filter((_, i) => i !== idx);
      return next.length ? next : [0];
    });
  };

  const updateCustomRecipient = (idx: number, officeId: number | null) => {
    setCustomReviewOfficeIds((p) => {
      const next = [...p];
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

  const validateStep1 = (): string | null => {
    if (routingMode === "default") {
      if (isQA && !reviewOfficeId) return "Please select a reviewer office.";
      return null;
    }
    if (customSelectedIds.length < 1)
      return "Please add at least 1 recipient office.";
    if (customReviewOfficeIds.some((x) => x === 0))
      return "Please select an office for each recipient row.";
    if (customSelectedIds.length > MAX_CUSTOM)
      return `Maximum ${MAX_CUSTOM} recipient offices.`;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setFieldErrors(null);
    try {
      const step1Err = validateStep1();
      if (step1Err) {
        setError(step1Err);
        setStep(1);
        return;
      }
      if (!file) {
        setError("Please attach a file.");
        return;
      }
      // Create document metadata only (no file) — instant
      const result = await createDocumentWithProgress({
        title,
        workflow_type: isQA ? "qa" : "office",
        routing_mode: routingMode,
        review_office_id:
          routingMode === "default" && isQA ? (reviewOfficeId as number) : null,
        custom_review_office_ids:
          routingMode === "custom" ? customSelectedIds : undefined,
        doctype,
        description,
        effective_date:
          isQA && effectiveDate.trim() ? effectiveDate.trim() : null,
        // file intentionally omitted — uploaded in background on flow page
      });
      if (tags.length > 0) {
        try {
          await setDocumentTags(result.id, tags);
        } catch {
          /* non-fatal */
        }
      }
      cleanupTempPreview(tempPreview);
      // Redirect immediately — file uploads in background on flow page
      navigate(`/documents/${result.id}`, {
        state: { pendingFile: file, fromCreate: true },
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to create document");
      if (err?.details) setFieldErrors(err.details);
    } finally {
      setLoading(false);
      setUploadPct(0);
    }
  };

  // ── Step indicator ───────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="flex items-center gap-2 shrink-0 overflow-x-auto pb-0.5">
      {[
        { num: 1, label: "Flow setup" },
        { num: 2, label: "Document details" },
      ].map((s, i) => (
        <React.Fragment key={s.num}>
          {i > 0 && (
            <div
              className={`h-px w-10 transition-colors ${step > 1 ? "bg-sky-400" : "bg-slate-200 dark:bg-surface-400"}`}
            />
          )}
          <div
            className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium border transition-all ${
              step === s.num
                ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-400"
                : step > s.num
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                  : "border-slate-200 bg-white text-slate-400 dark:border-surface-400 dark:bg-surface-500"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${
                step > s.num
                  ? "bg-emerald-500 text-white"
                  : step === s.num
                    ? "bg-sky-500 text-white"
                    : "bg-slate-200 dark:bg-surface-400 text-slate-500"
              }`}
            >
              {step > s.num ? "✓" : s.num}
            </span>
            {s.label}
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <PageFrame
      title="Draft Document"
      onBack={() => {
        cleanupTempPreview(tempPreview);
        navigate(-1);
      }}
      contentClassName="flex flex-col gap-5 h-full"
      right={
        <button
          type="button"
          onClick={() => setTemplatesPanelOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
        >
          📄 Templates
        </button>
      }
    >
      <StepBar />

      {/* ── STEP 1 ──────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex justify-center">
          <div className="w-full max-w-lg mx-auto">
            <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-surface-400">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Choose workflow
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Set how this document will be routed for review and approval.
                </p>
              </div>

              <div className="px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-5">
                {/* Flow option */}
                <Field label="Flow option" required>
                  <select
                    value={routingMode}
                    onChange={(e) => {
                      const v = e.target.value as "default" | "custom";
                      setRoutingMode(v);
                      setError(null);
                      if (v === "default") setCustomReviewOfficeIds([0]);
                      if (v === "custom" && customReviewOfficeIds.length === 0)
                        setCustomReviewOfficeIds([0]);
                    }}
                    className={selectCls}
                  >
                    <option value="default">
                      {isQA ? "Default QA Flow" : "Default Office Flow"}
                    </option>
                    <option value="custom">Custom Flow</option>
                  </select>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">
                    {routingMode === "default"
                      ? isQA
                        ? "QA → Office → VP → QA → Office → VP → President → QA"
                        : "Your Office → Office Head → VP → QA"
                      : "You choose 1–5 offices in order. They receive the document sequentially."}
                  </p>
                </Field>

                {/* Default QA: reviewer office */}
                {routingMode === "default" && isQA && (
                  <Field
                    label="Reviewer office"
                    required
                    hint="The first office that will review this document."
                  >
                    <OfficeDropdown
                      value={reviewOfficeId}
                      onChange={setReviewOfficeId}
                      error={fieldErrors?.review_office_id?.[0]}
                    />
                  </Field>
                )}

                {/* Custom flow: recipients */}
                {routingMode === "custom" && (
                  <Field
                    label="Recipients"
                    required
                    hint={`Ordered list of offices. Min 1, max ${MAX_CUSTOM}.`}
                  >
                    <div className="flex flex-col gap-2">
                      {customReviewOfficeIds.map((val, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-5 shrink-0 text-center text-xs font-semibold text-slate-400">
                            {idx + 1}
                          </span>
                          <div className="flex-1 min-w-0">
                            <OfficeDropdown
                              value={val > 0 ? val : null}
                              onChange={(id) => updateCustomRecipient(idx, id)}
                              excludeOfficeIds={customSelectedIds.filter(
                                (id) => id !== val,
                              )}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCustomRecipient(idx)}
                            className="shrink-0 rounded-lg border border-slate-200 dark:border-surface-400 px-2.5 py-2 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                      {customReviewOfficeIds.length < MAX_CUSTOM && (
                        <button
                          type="button"
                          onClick={addCustomRecipient}
                          className="mt-1 rounded-lg border border-dashed border-slate-300 dark:border-surface-400 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-sky-400 hover:text-sky-600 dark:hover:text-sky-400 transition"
                        >
                          + Add recipient
                        </button>
                      )}
                    </div>
                  </Field>
                )}

                {error && (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-3 py-2 text-xs text-rose-700 dark:text-rose-400">
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate(-1)}
                    className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const err = validateStep1();
                      if (err) {
                        setError(err);
                        return;
                      }
                      setError(null);
                      setStep(2);
                    }}
                    className="rounded-lg bg-sky-500 hover:bg-sky-600 px-5 py-2 text-sm font-semibold text-white transition"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 2 ──────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col lg:grid lg:grid-cols-5 gap-5 flex-1 min-h-0">
          {/* Left: form — 3 cols */}
          <div className="lg:col-span-3 lg:overflow-y-auto">
            <form onSubmit={handleSubmit}>
              <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200 dark:border-surface-400">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Document details
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Flow:{" "}
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {routingMode === "default"
                          ? isQA
                            ? "Default QA Flow"
                            : "Default Office Flow"
                          : "Custom Flow"}
                      </span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline"
                  >
                    ← Change flow
                  </button>
                </div>

                <div className="px-4 py-4 sm:px-6 sm:py-5 flex flex-col gap-5">
                  <Field label="Title" required>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. QA Manual – Document Control Procedure"
                      required
                      className={inputCls}
                    />
                  </Field>

                  <Field label="Document type" required>
                    <div className="flex gap-5">
                      {(["internal", "external", "forms"] as const).map(
                        (type) => (
                          <label
                            key={type}
                            className="flex items-center gap-2 cursor-pointer"
                          >
                            <input
                              type="radio"
                              value={type}
                              checked={doctype === type}
                              onChange={() => setDoctype(type)}
                              className="accent-sky-500"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300 capitalize">
                              {type}
                            </span>
                          </label>
                        ),
                      )}
                    </div>
                  </Field>

                  <Field
                    label="Description"
                    hint="Short summary shown in the Library. Not for comments."
                  >
                    <textarea
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="What is this document for?"
                      className={inputCls}
                    />
                  </Field>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field
                      label="Effective date"
                      hint={
                        isQA
                          ? "Set the date this document takes effect."
                          : "Only QA can set this."
                      }
                    >
                      <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        disabled={!isQA}
                        className={
                          inputCls +
                          " disabled:opacity-50 disabled:cursor-not-allowed"
                        }
                      />
                    </Field>

                    <Field
                      label="Tags"
                      hint="Click Add or press Enter to add a tag."
                    >
                      <div className="flex gap-2">
                        <input
                          value={tagsInput}
                          onChange={(e) => setTagsInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const t = tagsInput.trim();
                              if (
                                !t ||
                                tags.some(
                                  (x) => x.toLowerCase() === t.toLowerCase(),
                                )
                              )
                                return;
                              setTags((p) => [...p, t]);
                              setTagsInput("");
                            }
                          }}
                          placeholder="e.g. SOP, QMS"
                          className={inputCls}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const t = tagsInput.trim();
                            if (
                              !t ||
                              tags.some(
                                (x) => x.toLowerCase() === t.toLowerCase(),
                              )
                            )
                              return;
                            setTags((p) => [...p, t]);
                            setTagsInput("");
                          }}
                          className="shrink-0 rounded-lg border border-slate-200 dark:border-surface-400 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                        >
                          Add
                        </button>
                      </div>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {tags.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() =>
                                setTags((p) => p.filter((x) => x !== t))
                              }
                              className="inline-flex items-center gap-1 rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-2.5 py-0.5 text-[11px] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-400 transition"
                            >
                              {t} ×
                            </button>
                          ))}
                        </div>
                      )}
                    </Field>
                  </div>

                  <Field
                    label="Attach file"
                    required
                    hint="Accepts Word, Excel, PowerPoint, or PDF (max 10 MB)."
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="file"
                        required
                        disabled={loading}
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-sky-50 dark:file:bg-sky-950/40 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-sky-700 dark:file:text-sky-400 hover:file:bg-sky-100 disabled:opacity-60"
                      />
                      {loading && (
                        <div className="w-24 shrink-0">
                          <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-surface-400 overflow-hidden">
                            <div
                              className="h-full bg-sky-500 transition-[width]"
                              style={{ width: `${Math.max(2, uploadPct)}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[11px] text-slate-400 text-right">
                            {uploadPct}%
                          </p>
                        </div>
                      )}
                    </div>
                  </Field>

                  {error && (
                    <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
                      <p className="font-medium">{error}</p>
                      {fieldErrors && (
                        <ul className="mt-1 list-disc pl-4 space-y-0.5">
                          {Object.entries(fieldErrors).map(
                            ([field, messages]) => (
                              <li key={field}>
                                <span className="font-semibold">{field}</span>:{" "}
                                {messages.join(" ")}
                              </li>
                            ),
                          )}
                        </ul>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => navigate(-1)}
                      disabled={loading}
                      className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition"
                    >
                      {loading ? "Creating…" : "Save document"}
                    </button>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Right: preview — 2 cols */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            <div
              className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col"
              style={{ minHeight: "475px" }}
            >
              <div className="px-5 py-4 border-b border-slate-200 dark:border-surface-400">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Preview
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  PDF is instant · Office files convert first
                </p>
              </div>
              <div className="flex-1 p-4 min-h-0">
                {!file ? (
                  <div className="flex h-full items-center justify-center rounded-lg border-2 border-dashed border-slate-200 dark:border-surface-400">
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      Attach a file to preview it here
                    </p>
                  </div>
                ) : previewLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Generating preview…
                    </p>
                  </div>
                ) : previewError ? (
                  <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 p-4 text-xs text-rose-700 dark:text-rose-400">
                    {previewError}
                    <p className="mt-1 opacity-70">
                      You can still save without a preview.
                    </p>
                  </div>
                ) : tempPreview?.url ? (
                  <iframe
                    title="Document preview"
                    src={tempPreview.url}
                    className="h-full w-full rounded-lg border border-slate-200 dark:border-surface-400"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <p className="text-sm text-slate-400 dark:text-slate-500">
                      Preview not available.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <TemplatesBrowserPanel
        open={templatesPanelOpen}
        onClose={() => setTemplatesPanelOpen(false)}
      />
    </PageFrame>
  );
};

export default CreateDocumentPage;
