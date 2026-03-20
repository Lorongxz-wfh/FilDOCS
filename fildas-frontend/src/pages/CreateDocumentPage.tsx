import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth";
import {
  createDocumentWithProgress,
  setDocumentTags,
  listOffices,
  type Office,
} from "../services/documents";
import {
  createTempPreview,
  deleteTempPreview,
  type TempPreview,
} from "../services/previews";
import PageFrame from "../components/layout/PageFrame";
import TemplatesBrowserPanel from "../components/templates/TemplatesBrowserPanel";
import FlowSelectModal, {
  type FlowSelection,
} from "../components/documents/CreateDocumentModal";
import { Pencil } from "lucide-react";

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

import { inputCls } from "../utils/formStyles";

function buildChainLabels(
  isQA: boolean,
  routingMode: "default" | "custom",
  _customOfficeIds: number[],
  officeNames: string[],
): { label: string; type: "creator" | "office" | "check" | "action" }[] {
  if (routingMode === "custom") {
    const creator = isQA ? "QA" : "Your Office";
    const nodes: {
      label: string;
      type: "creator" | "office" | "check" | "action";
    }[] = [
      { label: creator, type: "creator" },
      ...officeNames.map((n) => ({ label: n, type: "office" as const })),
      { label: creator + " ✓", type: "check" },
      ...officeNames.map((n) => ({ label: n, type: "office" as const })),
      { label: creator + " ✓", type: "check" },
      { label: "Register", type: "action" },
      { label: "Distribute", type: "action" },
    ];
    return nodes;
  }
  if (isQA) {
    return [
      { label: "QA", type: "creator" },
      { label: "Office", type: "office" },
      { label: "VP", type: "office" },
      { label: "QA ✓", type: "check" },
      { label: "Office", type: "office" },
      { label: "VP", type: "office" },
      { label: "President", type: "office" },
      { label: "QA ✓", type: "check" },
      { label: "Register", type: "action" },
      { label: "Distribute", type: "action" },
    ];
  }
  return [
    { label: "Your Office", type: "creator" },
    { label: "Office Head", type: "office" },
    { label: "VP", type: "office" },
    { label: "Office ✓", type: "check" },
    { label: "Office Head", type: "office" },
    { label: "VP", type: "office" },
    { label: "President", type: "office" },
    { label: "Office ✓", type: "check" },
    { label: "Register", type: "action" },
    { label: "Distribute", type: "action" },
  ];
}

export default function CreateDocumentPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const rawRole =
    typeof (me as any).role === "string"
      ? (me as any).role
      : (me as any).role?.name;
  const roleName = String(rawRole ?? "").toLowerCase();
  const isAdminUser = roleName === "admin" || roleName === "sysadmin";
  const adminDebugOn =
    isAdminUser &&
    localStorage.getItem(`pref_debug_mode_${(me as any).id}`) === "1";

  if (!new Set(["qa", "office_staff", "office_head"]).has(roleName) && !adminDebugOn)
    return <Navigate to="/work-queue" replace />;

  const isQA = roleName === "qa";

  // ── Flow state (from location.state if coming back from modal) ─────────────
  const [flowModalOpen, setFlowModalOpen] = useState(false);
  const [flow, setFlow] = useState<FlowSelection | null>(
    (location.state as any)?.flow ?? null,
  );

  // Open modal immediately if no flow selected yet
  useEffect(() => {
    if (!flow) setFlowModalOpen(true);
  }, []);

  // ── Form state ─────────────────────────────────────────────────────────────
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
  const [uploadPct] = useState(0);
  const previewSeqRef = React.useRef(0);

  // ── Admin: office picker ───────────────────────────────────────────────────
  const [allOffices, setAllOffices] = useState<Office[]>([]);
  const [actingOfficeId, setActingOfficeId] = useState<number | null>(null);
  useEffect(() => {
    if (!isAdminUser) return;
    listOffices().then(setAllOffices).catch(() => {});
  }, [isAdminUser]);

  // ── Office names for chain display ─────────────────────────────────────────
  const [officeCodes, setOfficeCodes] = useState<string[]>([]);
  useEffect(() => {
    if (!flow || flow.routingMode !== "custom") {
      setOfficeCodes([]);
      return;
    }
    import("../services/documents").then(({ listOffices }) => {
      listOffices()
        .then((offices) => {
          const codes = flow.customOfficeIds.map(
            (id, i) => offices.find((o) => o.id === id)?.code ?? `O${i + 1}`,
          );
          setOfficeCodes(codes);
        })
        .catch(() => {});
    });
  }, [flow]);

  const chainNodes = useMemo(() => {
    if (!flow) return [];
    return buildChainLabels(
      isQA,
      flow.routingMode,
      flow.customOfficeIds,
      officeCodes,
    );
  }, [flow, isQA, officeCodes]);

  // ── Temp preview ───────────────────────────────────────────────────────────
  const cleanupTempPreview = (p: TempPreview | null) => {
    if (!p) return;
    deleteTempPreview(p.year, p.id).catch(() => {});
  };

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

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flow) {
      setFlowModalOpen(true);
      return;
    }
    setLoading(true);
    setError(null);
    setFieldErrors(null);
    try {
      if (!file) {
        setError("Please attach a file.");
        return;
      }
      if (isAdminUser && !actingOfficeId) {
        setError("Please select an office to create this document on behalf of.");
        return;
      }
      const result = await createDocumentWithProgress({
        title,
        workflow_type: isQA ? "qa" : "office",
        routing_mode: flow.routingMode,
        review_office_id:
          flow.routingMode === "default" && isQA
            ? (flow.reviewOfficeId as number)
            : null,
        custom_review_office_ids:
          flow.routingMode === "custom" ? flow.customOfficeIds : undefined,
        doctype,
        description,
        effective_date:
          isQA && effectiveDate.trim() ? effectiveDate.trim() : null,
        ...(isAdminUser && actingOfficeId ? { acting_as_office_id: actingOfficeId } : {}),
      });
      if (tags.length > 0) {
        try {
          await setDocumentTags(result.id, tags);
        } catch {
          /* non-fatal */
        }
      }
      cleanupTempPreview(tempPreview);
      navigate(`/documents/${result.id}`, {
        state: { pendingFile: file, fromCreate: true },
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to create document");
      if (err?.details) setFieldErrors(err.details);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageFrame
        title="Draft Document"
        onBack={() => {
          cleanupTempPreview(tempPreview);
          navigate(-1);
        }}
        contentClassName="flex flex-col gap-4 h-full"
        right={
          <button
            type="button"
            onClick={() => setTemplatesPanelOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Templates
          </button>
        }
      >
        {/* ── Flow summary bar ─────────────────────────────────────────────── */}
        {flow && (
          <div className="flex items-center gap-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
            {/* Label */}
            <div className="shrink-0 hidden sm:flex items-center px-4 py-2.5 border-r border-slate-200 dark:border-surface-400">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {flow.routingMode === "default"
                  ? isQA
                    ? "Default QA Flow"
                    : "Default Office Flow"
                  : "Custom Flow"}
              </span>
            </div>
            {/* Chain — centered, scrollable */}
            <div className="flex-1 min-w-0 overflow-x-auto px-4 py-2.5">
              <div className="flex items-center justify-center gap-1 flex-nowrap">
                {chainNodes.map((node, i) => (
                  <React.Fragment key={i}>
                    <span
                      className={[
                        "whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold shrink-0",
                        node.type === "check"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                          : node.type === "action"
                            ? "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400"
                            : node.type === "creator"
                              ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400 ring-1 ring-sky-200 dark:ring-sky-800"
                              : "bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400 text-slate-600 dark:text-slate-300",
                      ].join(" ")}
                    >
                      {node.label}
                    </span>
                    {i < chainNodes.length - 1 && (
                      <span className="text-slate-300 dark:text-slate-600 text-xs shrink-0">
                        →
                      </span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
            {/* Edit button */}
            <div className="shrink-0 border-l border-slate-200 dark:border-surface-400">
              <button
                type="button"
                onClick={() => setFlowModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition h-full"
              >
                <Pencil size={10} />
                Edit flow
              </button>
            </div>
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────────────── */}
        {flow && (
          <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 flex-1 min-h-0">
            {/* Left: form */}
            <div className="lg:col-span-3 lg:overflow-y-auto lg:max-h-[calc(100vh-220px)]">
              <form id="create-doc-form" onSubmit={handleSubmit}>
                <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-200 dark:border-surface-400">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      Document details
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {flow.routingMode === "default"
                        ? isQA
                          ? "Default QA Flow"
                          : "Default Office Flow"
                        : "Custom Flow"}
                    </p>
                  </div>

                  <div className="px-5 py-5 flex flex-col gap-5">
                    {isAdminUser && (
                      <Field label="Acting as office" required hint="Document will be created on behalf of this office.">
                        <select
                          value={actingOfficeId ?? ""}
                          onChange={(e) => setActingOfficeId(Number(e.target.value) || null)}
                          required
                          className={inputCls}
                        >
                          <option value="">Select an office…</option>
                          {allOffices.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      </Field>
                    )}

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
                      hint="Short summary shown in the Library."
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
                            ? "Date this document takes effect."
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

                      <Field label="Tags" hint="Press Enter or click Add.">
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
                      hint="Word, Excel, PowerPoint, or PDF (max 10 MB)."
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
                                  <span className="font-semibold">{field}</span>
                                  : {messages.join(" ")}
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
                        onClick={() => {
                          cleanupTempPreview(tempPreview);
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
                        className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition"
                      >
                        {loading ? "Creating…" : "Save document"}
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
      </PageFrame>

      <FlowSelectModal
        open={flowModalOpen}
        isQA={isQA}
        initial={flow ?? undefined}
        onConfirm={(selection) => {
          setFlow(selection);
          setFlowModalOpen(false);
        }}
        onClose={() => {
          if (!flow) navigate(-1);
          else setFlowModalOpen(false);
        }}
      />

      <TemplatesBrowserPanel
        open={templatesPanelOpen}
        onClose={() => setTemplatesPanelOpen(false)}
      />
    </>
  );
}
