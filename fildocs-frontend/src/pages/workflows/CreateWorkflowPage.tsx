import React, { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../../lib/auth";
import {
  createDocumentWithProgress,
  setDocumentTags,
  listOffices,
  type Office,
} from "../../services/documents";
import {
  createTempPreview,
  deleteTempPreview,
  type TempPreview,
} from "../../services/previews";
import PageFrame from "../../components/layout/PageFrame";
import Button from "../../components/ui/Button";
import TemplatesBrowserPanel from "../../components/templates/TemplatesBrowserPanel";
import { useToast } from "../../components/ui/toast/ToastContext";
import FlowSelectModal, {
  type FlowSelection,
} from "../../components/documents/modals/WorkflowCreateModal";
import { Pencil, ArrowRight, FileText, Info } from "lucide-react";
import SelectDropdown from "../../components/ui/SelectDropdown";
import { motion, AnimatePresence } from "framer-motion";
import { TRANSITION_EASE_OUT } from "../../utils/animations";

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

import { inputCls } from "../../utils/formStyles";

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

export default function CreateWorkflowPage() {
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
  const [retentionDate, setRetentionDate] = useState("");
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
  useEffect(() => {
    console.log("[CreateWorkflowPage] Diagnostic Check:", {
      React: !!React,
      useEffect: !!useEffect,
      useMemo: !!useMemo,
      useState: !!useState,
      useNavigate: !!useNavigate,
      useLocation: !!useLocation,
      useToast: !!useToast,
      allOffices: !!allOffices,
      me: !!me,
      isQA: !!isQA,
      inputCls: !!inputCls,
      Button: !!Button,
      TemplatesBrowserPanel: !!TemplatesBrowserPanel,
      FlowSelectModal: !!FlowSelectModal,
      SelectDropdown: !!SelectDropdown,
      PageFrame: !!PageFrame,
      Pencil: !!Pencil,
    });
  }, []);

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
    import("../../services/documents").then(({ listOffices }) => {
      listOffices()
        .then((offices) => {
          const codes = flow.customOfficeIds.map(
            (id: number, i: number) => offices.find((o) => o.id === id)?.code ?? `O${i + 1}`,
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
        retention_date:
          retentionDate.trim() ? retentionDate.trim() : null,
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
        breadcrumbs={[{ label: "Work Queue", to: "/work-queue" }]}
        contentClassName="flex flex-col gap-4 h-full"
        right={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setTemplatesPanelOpen(true)}
            title="Browse Templates"
          >
            <span className="font-semibold">Templates</span>
          </Button>
        }
      >
        {/* ── Flow summary bar ─────────────────────────────────────────────── */}
        {flow && (
          <div className="flex items-center gap-0 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden shadow-sm shadow-slate-900/5">
            {/* Label */}
            <div className="shrink-0 hidden sm:flex items-center px-4 py-2.5 border-r border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 whitespace-nowrap">
                {flow.routingMode === "default"
                  ? isQA
                    ? "Default QA Flow"
                    : "Default Office Flow"
                  : "Custom Flow"}
              </span>
            </div>
            {/* Chain — centered, scrollable */}
            <div className="flex-1 min-w-0 overflow-x-auto px-4 py-2.5">
              <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                {chainNodes.map((node, i) => (
                  <React.Fragment key={i}>
                    <span
                      className={[
                        "whitespace-nowrap rounded px-2.5 py-1 text-[11px] font-semibold shrink-0 transition-colors",
                        node.type === "check"
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 ring-1 ring-emerald-200/50 dark:ring-emerald-800/30"
                          : node.type === "action"
                            ? "bg-slate-50 text-slate-500 dark:bg-surface-400 dark:text-slate-400 border border-slate-200 dark:border-surface-400/80"
                            : node.type === "creator"
                              ? "bg-brand-50 text-brand-600 dark:bg-brand-400/15 dark:text-brand-300 ring-1 ring-brand-200 dark:ring-brand-400/20"
                              : "bg-white dark:bg-surface-600 border border-slate-200 dark:border-surface-400 text-slate-600 dark:text-slate-300 shadow-sm shadow-slate-900/5",
                      ].join(" ")}
                    >
                      {node.label}
                    </span>
                    {i < chainNodes.length - 1 && (
                      <ArrowRight className="h-3 w-3 text-slate-300 dark:text-slate-600 shrink-0 mx-0.5" />
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
                className="flex items-center gap-1.5 px-4 py-2.5 text-[10px] font-bold uppercase tracking-tight text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition h-full"
              >
                <Pencil size={11} className="text-slate-400" />
                <span>Edit flow</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Main content ──────────────────────────────────────────────────── */}
        {flow && (
          <div className="flex flex-col lg:grid lg:grid-cols-5 gap-4 flex-1 min-h-0">
            {/* Left: form */}
            <div className="lg:col-span-3 flex flex-col min-h-0">
              <form id="create-doc-form" onSubmit={handleSubmit} className="flex flex-col h-full min-h-0">
                <div className="flex flex-col h-full min-h-0 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden ">
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

                  {/* Scrollable Body */}
                  <div className="flex-1 overflow-y-auto min-h-0 px-5 py-5 flex flex-col gap-5 bg-slate-50/10 dark:bg-transparent">
                    {isAdminUser && (
                      <Field label="Acting as office" required hint="Document will be created on behalf of this office.">
                        <SelectDropdown
                          value={actingOfficeId}
                          onChange={(v) => setActingOfficeId(v ? Number(v) : null)}
                          options={allOffices.map((o) => ({ value: o.id, label: o.name, sublabel: o.code }))}
                          placeholder="Select an office…"
                          searchable
                          clearable={false}
                        />
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
                                className="accent-brand-400"
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

                      <Field
                        label="Retention period"
                        hint="Automated archiving date (optional)."
                      >
                        <input
                          type="date"
                          value={retentionDate}
                          onChange={(e) => setRetentionDate(e.target.value)}
                          min={new Date().toISOString().split("T")[0]}
                          className={inputCls}
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
                            className="shrink-0 rounded-md border border-slate-200 dark:border-surface-400 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
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



                    {/* Error Banner */}
                    {error && (
                      <div className="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/15 mx-5 mb-5 px-4 py-3 text-xs text-rose-700 dark:text-rose-300">
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
                  </div>

                  {/* Sticky Footer */}
                  <div className="shrink-0 px-5 py-4 border-t border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/20 flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="md"
                      onClick={() => {
                        cleanupTempPreview(tempPreview);
                        navigate(-1);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="md"
                      loading={loading}
                      className="px-6 font-semibold"
                    >
                      Save document
                    </Button>
                  </div>
                </div>
              </form>
            </div>

            {/* Right: preview */}
            <div className="lg:col-span-2 flex flex-col min-h-0">
              <div className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col h-full ">
                <div className="px-5 py-3 border-b border-slate-200 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/10 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                      Attachment & Preview
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 truncate font-medium">
                      {file ? file.name : "No file attached — PDF/Word/Excel"}
                    </p>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    <input
                      type="file"
                      id="create-upload-btn"
                      className="hidden"
                      disabled={loading || previewLoading}
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    {loading && (
                      <div className="h-4 w-4 rounded-full border-2 border-slate-200 dark:border-surface-400 border-t-brand-500 animate-spin" />
                    )}
                    <label
                      htmlFor="create-upload-btn"
                      className="cursor-pointer rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-tight text-slate-600 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition "
                    >
                      {file ? "Change File" : "Attach File"}
                    </label>
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <AnimatePresence mode="wait">
                    {!file ? (
                      <motion.div 
                        key="empty"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: TRANSITION_EASE_OUT }}
                        className="flex h-full flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-surface-400 p-8 text-center"
                      >
                        <div className="h-12 w-12 rounded-full bg-slate-50 dark:bg-surface-400 flex items-center justify-center mb-3">
                          <FileText className="h-6 w-6 text-slate-300 dark:text-slate-500" />
                        </div>
                        <p className="text-sm font-semibold text-slate-400 dark:text-slate-500">
                          No file attached
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 max-w-[180px]">
                          Upload a PDF, Word, or Excel file to see a preview here.
                        </p>
                      </motion.div>
                    ) : previewLoading ? (
                      <motion.div 
                        key="loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-full w-full bg-white dark:bg-surface-500 flex flex-col p-8 space-y-6"
                      >
                        <div className="space-y-3">
                          <div className="h-4 w-2/3 bg-slate-100 dark:bg-surface-400 rounded animate-pulse" />
                          <div className="h-3 w-1/2 bg-slate-50 dark:bg-surface-400/50 rounded animate-pulse" />
                        </div>
                        
                        <div className="space-y-3 pt-4">
                          {[1, 2, 3, 4, 5, 6].map(i => (
                            <div 
                              key={i} 
                              className="h-2.5 bg-slate-50 dark:bg-surface-400/30 rounded animate-pulse" 
                              style={{ 
                                width: `${Math.floor(Math.random() * 40) + 60}%`,
                                animationDelay: `${i * 100}ms`
                              }} 
                            />
                          ))}
                        </div>

                        <div className="flex-1" />
                        
                        <div className="flex items-center gap-2 pt-6 border-t border-slate-50 dark:border-surface-400/50">
                          <div className="h-8 w-8 rounded-full bg-slate-50 dark:bg-surface-400 animate-pulse" />
                          <div className="space-y-1.5 flex-1">
                            <div className="h-2 w-24 bg-slate-100 dark:bg-surface-400 rounded animate-pulse" />
                            <div className="h-2 w-16 bg-slate-50 dark:bg-surface-400/50 rounded animate-pulse" />
                          </div>
                        </div>
                      </motion.div>
                    ) : previewError ? (
                      <motion.div 
                        key="error"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: TRANSITION_EASE_OUT }}
                        className="p-6 h-full flex flex-col items-center justify-center text-center"
                      >
                         <div className="h-10 w-10 rounded-full bg-rose-50 dark:bg-rose-950/30 flex items-center justify-center mb-3 text-rose-500">
                          <Info className="h-5 w-5" />
                        </div>
                        <p className="text-sm font-bold text-rose-600 dark:text-rose-400">{previewError}</p>
                        <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 max-w-[200px]">
                          We couldn't generate a visual preview for this file. You can still save the document and it will be accessible in the library.
                        </p>
                      </motion.div>
                    ) : tempPreview?.url ? (
                      <motion.div 
                        key="iframe"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="h-full w-full"
                      >
                        <iframe
                          title="Document preview"
                          src={tempPreview.url}
                          className="h-full w-full border-0"
                        />
                      </motion.div>
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                          Preview not available.
                        </p>
                      </div>
                    )}
                  </AnimatePresence>
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
        onConfirm={(selection: any) => {
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
