import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import RefreshButton from "../components/ui/RefreshButton";
import { useToast } from "../components/ui/toast/ToastContext";
import { Search, X, ChevronDown, Tag, LayoutGrid, List } from "lucide-react";
import { inputCls } from "../utils/formStyles";
import { getAuthUser } from "../lib/auth";

import {
  listTemplates,
  deleteTemplate,
  type DocumentTemplate,
} from "../services/templates";

import TemplateList from "../components/templates/TemplateList";
import TemplateGridCard from "../components/templates/TemplateGridCard";
import TemplateUploadForm from "../components/templates/TemplateUploadForm";
import TemplateDetailPanel from "../components/templates/TemplateDetailPanel";

type ViewMode = "grid" | "list";
type ScopeFilter = "all" | "global" | "mine";

const TemplatesPage: React.FC = () => {
  const { push } = useToast();
  const authUser = getAuthUser();
  const userRole = authUser?.role?.toLowerCase() ?? "";
  const canChooseScope = userRole === "qa" || userRole === "sysadmin";

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

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!tagDropdownRef.current?.contains(e.target as Node))
        setTagDropdownOpen(false);
    };
    if (tagDropdownOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [tagDropdownOpen]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => (t.tags ?? []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [templates]);

  const filtered = useMemo(() => {
    let list = templates;
    if (scope === "global") list = list.filter((t) => t.is_global);
    if (scope === "mine") list = list.filter((t) => t.can_delete);
    if (activeTag) list = list.filter((t) => (t.tags ?? []).includes(activeTag));
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

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSelectedTemplate((prev) => (prev?.id === id ? null : prev));
      push({ type: "success", title: "Deleted", message: "Template removed." });
    } catch (e: any) {
      push({ type: "error", title: "Delete failed", message: e?.message ?? "Unknown error" });
    } finally {
      setDeletingId(null);
    }
  };

  const handleUploaded = (template: DocumentTemplate) => {
    setTemplates((prev) => [template, ...prev]);
    setModalOpen(false);
  };

  const hasActiveFilters = q || scope !== "all" || activeTag;

  const tabCls = (active: boolean) =>
    [
      "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px",
      active
        ? "border-sky-500 text-sky-600 dark:text-sky-400"
        : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
    ].join(" ");

  return (
    <>
      <PageFrame
        title="Document Templates"
        contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
        right={
          <div className="flex items-center gap-2">
            <RefreshButton onClick={fetchTemplates} loading={loading} title="Refresh templates" />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setModalOpen(true)}
            >
              Upload template
            </Button>
          </div>
        }
      >
        {/* View tabs + refresh */}
        <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0">
          <button type="button" onClick={() => setView("grid")} className={tabCls(viewMode === "grid")}>
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button type="button" onClick={() => setView("list")} className={tabCls(viewMode === "list")}>
            <List className="h-3.5 w-3.5" />
            List
          </button>
          {templates.length > 0 && (
            <span className="ml-auto pr-4 text-xs text-slate-400 dark:text-slate-500">
              {filtered.length} of {templates.length}
            </span>
          )}
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 px-4 py-2.5 border-b border-slate-200 dark:border-surface-400">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, file, tags…"
              className={`${inputCls} pl-9 pr-8`}
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
                    ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-surface-300"
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
              {activeTag ? (
                <span
                  onClick={(e) => { e.stopPropagation(); setActiveTag(null); }}
                  className="ml-0.5 rounded hover:bg-brand-100 dark:hover:bg-brand-900/40 p-0.5"
                >
                  <X className="h-3 w-3" />
                </span>
              ) : (
                <ChevronDown className="h-3 w-3 ml-0.5" />
              )}
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
                        onClick={() => { setActiveTag(tag === activeTag ? null : tag); setTagDropdownOpen(false); }}
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

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setQ(""); setScope("all"); setActiveTag(null); }}
              className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {error ? (
            <div className="p-4">
              <Alert variant="danger">
                {error}{" "}
                <button type="button" className="underline" onClick={fetchTemplates}>
                  Retry
                </button>
              </Alert>
            </div>
          ) : viewMode === "grid" ? (
            loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="rounded-xl bg-slate-100 dark:bg-surface-600 animate-pulse aspect-3/4" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                label={templates.length === 0 ? "No templates yet." : "No templates match your filters."}
                description={
                  templates.length === 0
                    ? "Upload the first template using the button above."
                    : "Try adjusting your search or filters."
                }
              />
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
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
        <TemplateUploadForm onUploaded={handleUploaded} canChooseScope={canChooseScope} />
      </Modal>
    </>
  );
};

export default TemplatesPage;
