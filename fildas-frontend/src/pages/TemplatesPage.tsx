import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { useToast } from "../components/ui/toast/ToastContext";
import { Search, X, ChevronDown, Tag } from "lucide-react";

import {
  listTemplates,
  deleteTemplate,
  type DocumentTemplate,
} from "../services/templates";

import TemplateList from "../components/templates/TemplateList";
import TemplateGridCard from "../components/templates/TemplateGridCard";
import TemplateUploadForm from "../components/templates/TemplateUploadForm";
import TemplateDetailPanel from "../components/templates/TemplateDetailPanel";

type ViewMode = "list" | "grid";
type ScopeFilter = "all" | "global" | "mine";

const TemplatesPage: React.FC = () => {
  const { push } = useToast();

  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const location = useLocation();
  const [modalOpen, setModalOpen] = useState(
    () => (location.state as any)?.openModal === true,
  );
  const [selectedTemplate, setSelectedTemplate] =
    useState<DocumentTemplate | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("templates_view") as ViewMode) ?? "grid";
  });

  // ── Filters (lifted — shared between grid and list) ────────
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const tagDropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Close tag dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!tagDropdownRef.current?.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    if (tagDropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

  // All unique tags across loaded templates
  const allTags = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => (t.tags ?? []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [templates]);

  // Filtered list — used by both grid and list
  const filtered = useMemo(() => {
    let list = templates;
    if (scope === "global") list = list.filter((t) => t.is_global);
    if (scope === "mine") list = list.filter((t) => t.can_delete);
    if (activeTag)
      list = list.filter((t) => (t.tags ?? []).includes(activeTag));
    if (debouncedQ) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(debouncedQ) ||
          t.original_filename.toLowerCase().includes(debouncedQ) ||
          (t.description ?? "").toLowerCase().includes(debouncedQ) ||
          (t.tags ?? []).some((tag) => tag.toLowerCase().includes(debouncedQ)),
      );
    }
    return list;
  }, [templates, scope, activeTag, debouncedQ]);

  const setView = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem("templates_view", mode);
  };

  // ── Fetch ──────────────────────────────────────────────────
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates();
      setTemplates(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load templates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // ── Delete ─────────────────────────────────────────────────
  const handleDeleteClick = async (id: number) => {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSelectedTemplate((prev) => (prev?.id === id ? null : prev));
      push({ type: "success", title: "Deleted", message: "Template removed." });
    } catch (e: any) {
      push({
        type: "error",
        title: "Delete failed",
        message: e?.message ?? "Unknown error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  // ── After upload ───────────────────────────────────────────
  const handleUploaded = (template: DocumentTemplate) => {
    setTemplates((prev) => [template, ...prev]);
    setModalOpen(false);
  };

  const hasActiveFilters = q || scope !== "all" || activeTag;

  return (
    <>
      <PageFrame
        title="Document Templates"
        right={
          <div className="flex items-center gap-2">
            {/* List/Grid toggle */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-1 gap-0.5">
              <button
                type="button"
                onClick={() => setView("list")}
                title="List view"
                className={[
                  "rounded-md p-1.5 transition",
                  viewMode === "list"
                    ? "bg-slate-100 dark:bg-surface-400 text-slate-800 dark:text-slate-100"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                ].join(" ")}
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
                    d="M4 6h16M4 10h16M4 14h16M4 18h16"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setView("grid")}
                title="Grid view"
                className={[
                  "rounded-md p-1.5 transition",
                  viewMode === "grid"
                    ? "bg-slate-100 dark:bg-surface-400 text-slate-800 dark:text-slate-100"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
                ].join(" ")}
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
                    d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                  />
                </svg>
              </button>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setModalOpen(true)}
            >
              + Upload template
            </Button>
          </div>
        }
      >
        <div className="rounded-2xl border border-slate-200 dark:border-surface-400 bg-white/80 dark:bg-surface-500/80 shadow-sm">
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-slate-50/80 dark:bg-surface-600/80 px-5 py-4">
            <div>
              <p className="text-sm font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                Available templates
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Global templates are visible to everyone. Office templates are
                visible to your office only.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchTemplates}
              disabled={loading}
              className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-50 transition"
            >
              Refresh
            </button>
          </div>

          {/* ── Filter toolbar ── */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-surface-400 px-5 py-3">
            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, file, tags…"
                className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 pl-8 pr-8 py-1.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/30 transition"
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

            {/* Scope pills */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-1">
              {(["all", "global", "mine"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={[
                    "rounded-md px-3 py-1 text-xs font-medium capitalize transition",
                    scope === s
                      ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-surface-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                  ].join(" ")}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Tags dropdown */}
            <div ref={tagDropdownRef} className="relative">
              <button
                type="button"
                onClick={() => setTagDropdownOpen((v) => !v)}
                className={[
                  "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition",
                  activeTag
                    ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-950/30 dark:text-brand-400"
                    : "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400",
                ].join(" ")}
              >
                <Tag className="h-3.5 w-3.5" />
                {activeTag ?? "Tags"}
                {activeTag && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveTag(null);
                    }}
                    className="ml-0.5 rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/40 p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
                {!activeTag && <ChevronDown className="h-3 w-3 ml-0.5" />}
              </button>

              {tagDropdownOpen && (
                <div className="absolute left-0 top-full mt-1.5 z-20 w-52 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-lg overflow-hidden">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-surface-400">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      Filter by tag
                    </p>
                  </div>
                  <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                    {allTags.length === 0 ? (
                      <p className="px-2 py-3 text-xs text-center text-slate-400 dark:text-slate-500">
                        No tags yet.
                      </p>
                    ) : (
                      allTags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setActiveTag(tag === activeTag ? null : tag);
                            setTagDropdownOpen(false);
                          }}
                          className={[
                            "w-full rounded-lg px-3 py-1.5 text-left text-xs font-medium transition",
                            activeTag === tag
                              ? "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-400"
                              : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500",
                          ].join(" ")}
                        >
                          {tag}
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Result count + clear */}
            <div className="ml-auto flex items-center gap-2">
              {templates.length > 0 && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  {filtered.length} of {templates.length}
                </span>
              )}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setScope("all");
                    setActiveTag(null);
                  }}
                  className="text-xs text-brand-500 hover:text-brand-600 dark:text-brand-400 font-medium"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-5">
            {error ? (
              <div className="rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
                {error}
                <button
                  type="button"
                  className="ml-3 underline text-rose-600 dark:text-rose-400"
                  onClick={fetchTemplates}
                >
                  Retry
                </button>
              </div>
            ) : viewMode === "grid" ? (
              loading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-slate-100 dark:bg-surface-600 animate-pulse aspect-3/4"
                    />
                  ))}
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-6 py-10 text-center">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {templates.length === 0
                      ? "No templates yet."
                      : "No templates match your filters."}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {templates.length === 0
                      ? "Upload the first template using the button above."
                      : "Try adjusting your search or filters."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filtered.map((t) => (
                    <TemplateGridCard
                      key={t.id}
                      template={t}
                      onSelect={setSelectedTemplate}
                      onDeleteClick={handleDeleteClick}
                      isDeleting={deletingId === t.id}
                    />
                  ))}
                </div>
              )
            ) : (
              <TemplateList
                templates={filtered}
                loading={loading}
                deletingId={deletingId}
                onDeleteClick={handleDeleteClick}
                onSelect={setSelectedTemplate}
              />
            )}
          </div>
        </div>
      </PageFrame>

      <TemplateDetailPanel
        template={selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        isDeleting={deletingId === selectedTemplate?.id}
        onDeleteClick={handleDeleteClick}
      />

      <Modal
        open={modalOpen}
        title="Upload template"
        onClose={() => setModalOpen(false)}
        widthClassName="max-w-lg"
      >
        <div className="mb-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-3 text-xs text-slate-600 dark:text-slate-400 space-y-1">
          <p className="font-semibold text-slate-700 dark:text-slate-300">
            Who can see your upload?
          </p>
          <p>
            <span className="font-medium text-violet-700 dark:text-violet-400">
              Admin / QA
            </span>{" "}
            — visible to <strong>all offices</strong>.
          </p>
          <p>
            <span className="font-medium text-sky-700 dark:text-sky-400">
              Other roles
            </span>{" "}
            — visible to your office only.
          </p>
        </div>
        <TemplateUploadForm onUploaded={handleUploaded} />
      </Modal>
    </>
  );
};

export default TemplatesPage;
