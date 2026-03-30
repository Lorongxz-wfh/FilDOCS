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
import { inputCls, selectCls } from "../utils/formStyles";
import { getAuthUser } from "../lib/auth";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";

import {
  listTemplates,
  deleteTemplate,
  invalidateTemplatesCache,
  appendToTemplatesCache,
  removeFromTemplatesCache,
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
  const isAdminUser = userRole === "admin" || userRole === "sysadmin";
  const adminDebugMode = useAdminDebugMode();
  const canUpload =
    ["qa", "sysadmin", "office_staff", "office_head"].includes(userRole) ||
    (isAdminUser && adminDebugMode);

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
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const templateIdsRef = React.useRef<string>("");

  // Initial mount — serve from cache if available, no loading flash on revisit
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    listTemplates({ sort_by: sortBy, sort_dir: sortDir })
      .then((data) => {
        if (!alive) return;
        templateIdsRef.current = data.map((t) => t.id).join(",");
        setTemplates(data);
      })
      .catch((e: any) => {
        if (!alive) return;
        setError(e?.message ?? "Failed to load templates.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Refresh button — always bypasses cache and re-fetches from server
  const fetchTemplates = useCallback(async (): Promise<string | void> => {
    const prevIds = templateIdsRef.current;
    invalidateTemplatesCache();
    setLoading(true);
    setError(null);
    try {
      const data = await listTemplates({ sort_by: sortBy, sort_dir: sortDir });
      const newIds = data.map((t) => t.id).join(",");
      templateIdsRef.current = newIds;
      setTemplates(data);
      return newIds === prevIds
        ? "Already up to date."
        : `Updated — ${data.length} template${data.length !== 1 ? "s" : ""} loaded.`;
    } catch (e: any) {
      setError(e?.message ?? "Failed to load templates.");
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleDeleteClick = async (id: number) => {
    if (!window.confirm("Delete this template? This cannot be undone.")) return;
    setDeletingId(id);
    try {
      await deleteTemplate(id);
      removeFromTemplatesCache(id);
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

  // Optimistic upload state
  const [uploadingName, setUploadingName] = useState<string | null>(null);

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    invalidateTemplatesCache();
    setLoading(true);
    setError(null);
    listTemplates({ sort_by: key, sort_dir: dir })
      .then((data) => {
        templateIdsRef.current = data.map((t) => t.id).join(",");
        setTemplates(data);
      })
      .catch((e: any) => setError(e?.message ?? "Failed to load templates."))
      .finally(() => setLoading(false));
  };

  const handleUploadStart = (name: string) => {
    setUploadingName(name);
    setModalOpen(false);
  };

  const handleUploaded = (template: DocumentTemplate) => {
    appendToTemplatesCache(template);
    setTemplates((prev) => [template, ...prev]);
    setUploadingName(null);
  };

  const handleUploadError = () => {
    setUploadingName(null);
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
            <RefreshButton
              onRefresh={fetchTemplates}
              loading={loading}
              title="Refresh templates"
            />
            {canUpload && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setModalOpen(true)}
              >
                Upload template
              </Button>
            )}
          </div>
        }
      >
        {/* View tabs + refresh */}
        <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0">
          <button
            type="button"
            onClick={() => setView("grid")}
            className={tabCls(viewMode === "grid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Grid
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={tabCls(viewMode === "list")}
          >
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
        <div
          className={`flex flex-wrap items-center gap-2 shrink-0 py-2.5 ${viewMode === "grid" ? "border-b border-slate-200 dark:border-surface-400" : ""}`}
        >
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
                title="Clear"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Scope select */}
          {canChooseScope && (
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as typeof scope)}
              className={selectCls}
            >
              <option value="all">All</option>
              <option value="global">Global</option>
              <option value="mine">Mine</option>
            </select>
          )}

          {/* Tags dropdown */}
          <div ref={tagDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setTagDropdownOpen((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition",
                activeTag
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-surface-400 dark:text-brand-400"
                  : "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400",
              ].join(" ")}
            >
              <Tag className="h-3.5 w-3.5" />
              {activeTag ?? "Tags"}
              {activeTag ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveTag(null);
                  }}
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
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
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
                          "w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition",
                          activeTag === tag
                            ? "bg-brand-50 dark:bg-surface-400 text-brand-700 dark:text-brand-400"
                            : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400",
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
              onClick={() => {
                setQ("");
                setScope("all");
                setActiveTag(null);
              }}
              className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              Clear
            </button>
          )}
        </div>

        {/* Optimistic upload banner */}
        {uploadingName && (
          <div className="shrink-0 flex items-center gap-2.5 border-b border-slate-200 dark:border-surface-400 bg-sky-50 dark:bg-sky-950/20 px-4 py-2.5">
            <svg
              className="h-3.5 w-3.5 animate-spin text-sky-500 shrink-0"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              />
            </svg>
            <p className="text-xs text-sky-700 dark:text-sky-400">
              Uploading <span className="font-semibold">{uploadingName}</span>…
            </p>
          </div>
        )}

        {/* Content */}
        {error ? (
          <div className="p-4 shrink-0">
            <Alert variant="danger">
              {error}{" "}
              <button
                type="button"
                className="underline"
                onClick={fetchTemplates}
              >
                Retry
              </button>
            </Alert>
          </div>
        ) : viewMode === "grid" ? (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 p-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 animate-pulse overflow-hidden aspect-3/4 flex flex-col"
                  >
                    <div className="flex-1 bg-slate-100 dark:bg-surface-600" />
                    <div className="p-2.5 space-y-1.5">
                      <div
                        className="h-2.5 rounded bg-slate-100 dark:bg-surface-600"
                        style={{ width: `${55 + (i % 4) * 10}%` }}
                      />
                      <div
                        className="h-2 rounded bg-slate-100 dark:bg-surface-600"
                        style={{ width: `${35 + (i % 3) * 8}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                label={
                  templates.length === 0
                    ? "No templates yet."
                    : "No templates match your filters."
                }
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
            )}
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0">
            <TemplateList
              templates={filtered}
              loading={loading}
              deletingId={deletingId}
              onDeleteClick={handleDeleteClick}
              onSelect={setSelectedTemplate}
              sortBy={sortBy}
              sortDir={sortDir}
              onSortChange={handleSortChange}
            />
          </div>
        )}
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
        <TemplateUploadForm
          onUploaded={handleUploaded}
          onUploadStart={handleUploadStart}
          onUploadError={handleUploadError}
          canChooseScope={canChooseScope}
        />
      </Modal>
    </>
  );
};;

export default TemplatesPage;
