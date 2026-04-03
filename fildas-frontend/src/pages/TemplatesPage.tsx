import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Modal from "../components/ui/Modal";
import Alert from "../components/ui/Alert";
import EmptyState from "../components/ui/EmptyState";
import { useToast } from "../components/ui/toast/ToastContext";
import { Tag, LayoutGrid, List, ChevronDown } from "lucide-react";
import { tabCls } from "../utils/formStyles";
import { getAuthUser } from "../lib/auth";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import { PageActions, RefreshAction, UploadAction } from "../components/ui/PageActions";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import SelectDropdown from "../components/ui/SelectDropdown";
import { useSmartRefresh } from "../hooks/useSmartRefresh";


import {
  listTemplates,
  deleteTemplate,
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
  const [initialLoading, setInitialLoading] = useState(true);
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

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (scope !== "all") count++;
    if (activeTag) count++;
    return count;
  }, [scope, activeTag]);

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

  const loadTemplates = useCallback(async (silent = false) => {
    if (!silent) setInitialLoading(true);
    setError(null);
    try {
      const data = await listTemplates({ sort_by: sortBy, sort_dir: sortDir });
      setTemplates(data);
      const newIds = data.map((t) => t.id).join(",");
      const changed = newIds !== templateIdsRef.current;
      templateIdsRef.current = newIds;
      return { data, changed };
    } catch (e: any) {
      setError(e?.message ?? "Failed to load templates.");
    } finally {
      setInitialLoading(false);
    }
  }, [sortBy, sortDir]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    await loadTemplates(false);
    return { changed: true }; 
  });


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

  const [uploadingName, setUploadingName] = useState<string | null>(null);

  const handleSortChange = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
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


  return (
    <>
      <PageFrame
        title="Document Templates"
        contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
        right={
          <PageActions>
            <RefreshAction
              onRefresh={refresh}
              loading={isRefreshing}
            />
            {canUpload && (
              <UploadAction
                label="Upload template"
                onClick={() => setModalOpen(true)}
              />
            )}
          </PageActions>
        }
      >
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
        </div>

        <SearchFilterBar
          search={q}
          setSearch={(val) => setQ(val)}
          placeholder="Search name, file, tags…"
          activeFiltersCount={activeFiltersCount}
          onClear={() => {
            setQ("");
            setScope("all");
            setActiveTag(null);
          }}
          mobileFilters={
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Scope</label>
                  <SelectDropdown
                    value={scope}
                    onChange={(val) => setScope((val as typeof scope) || "all")}
                    className="w-full"
                    options={[
                      { value: "all", label: "All Scope" },
                      { value: "global", label: "Global" },
                      { value: "mine", label: "Mine" },
                    ]}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Tag</label>
                  <SelectDropdown
                    value={activeTag || ""}
                    onChange={(val) => setActiveTag((val as string) || null)}
                    className="w-full"
                    options={[
                      { value: "", label: "All Tags" },
                      ...allTags.map(tag => ({
                        value: tag,
                        label: tag,
                      })),
                    ]}
                  />
                </div>
              </div>
            </div>
          }
        >
          {canChooseScope && (
            <SelectDropdown
              value={scope}
              onChange={(val) => setScope((val as typeof scope) || "all")}
              className="w-28"
              options={[
                { value: "all", label: "All Scope" },
                { value: "global", label: "Global" },
                { value: "mine", label: "Mine" },
              ]}
            />
          )}

          <div ref={tagDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setTagDropdownOpen((v) => !v)}
              className={[
                "flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-[11px] font-medium transition",
                activeTag
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                  : "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 shadow-xs",
              ].join(" ")}
            >
              <Tag className="h-3 w-3" />
              {activeTag ?? "Tags"}
              <ChevronDown className="h-3 w-3 ml-0.5 opacity-50" />
            </button>
            {tagDropdownOpen && (
              <div className="absolute left-0 top-full mt-1.5 z-20 w-52 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="px-3 py-2 border-b border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-700/50">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Filter by tag
                  </p>
                </div>
                <div className="max-h-52 overflow-y-auto p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTag(null);
                      setTagDropdownOpen(false);
                    }}
                    className={[
                      "w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition",
                      !activeTag
                        ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400",
                    ].join(" ")}
                  >
                    All Tags
                  </button>
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        setActiveTag(tag);
                        setTagDropdownOpen(false);
                      }}
                      className={[
                        "w-full rounded-md px-3 py-1.5 text-left text-xs font-medium transition",
                        activeTag === tag
                          ? "bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400"
                          : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400",
                      ].join(" ")}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SearchFilterBar>

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

        <div className="flex-1 min-h-0 flex flex-col">
          {error ? (
            <div className="p-4 shrink-0">
              <Alert variant="danger">
                {error}{" "}
                <button
                  type="button"
                  className="underline"
                  onClick={() => loadTemplates()}
                >
                  Retry
                </button>
              </Alert>
            </div>
          ) : viewMode === "grid" ? (
            <>
              {initialLoading ? (
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
                <div className="flex-1 flex flex-col items-center justify-center">
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
                    isSearch={templates.length > 0}
                  />
                </div>
              ) : (
                <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
                  <div className="h-full overflow-y-auto">
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
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col flex-1 min-h-0">
              <TemplateList
                templates={filtered}
                loading={initialLoading}
                deletingId={deletingId}
                onDeleteClick={handleDeleteClick}
                onSelect={setSelectedTemplate}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={handleSortChange}
              />
            </div>
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
        <TemplateUploadForm
          onUploaded={handleUploaded}
          onUploadStart={handleUploadStart}
          onUploadError={handleUploadError}
          canChooseScope={canChooseScope}
        />
      </Modal>
    </>
  );
};

export default TemplatesPage;
