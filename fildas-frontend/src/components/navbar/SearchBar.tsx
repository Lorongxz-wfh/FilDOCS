import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  Users,
  Building2,
  LayoutDashboard,
  ClipboardList,
  LayoutTemplate,
  X,
  ArrowRight,
  Hash,
  Megaphone,
} from "lucide-react";
import { globalSearch, type SearchResultItem } from "../../services/search";
import { navGroups, inboxNavItem } from "../sidebar/navConfig";
import { getUserRole } from "../../lib/roleFilters";
import SkeletonList from "../ui/loader/SkeletonList";

// ── Page results (client-side) ─────────────────────────────────────────────
function getPageResults(q: string, role: string): SearchResultItem[] {
  if (!q) return [];
  const lower = q.toLowerCase();
  const results: SearchResultItem[] = [];
  for (const group of navGroups) {
    for (const item of group.items) {
      if (!item.roles || item.roles.includes(role)) {
        if (item.label.toLowerCase().includes(lower)) {
          results.push({
            type: "page",
            id: item.to,
            title: item.label,
            description: group.label,
            url: item.to,
          });
        }
      }
    }
  }
  // Check static items (Inbox, etc)
  for (const item of [inboxNavItem]) {
    if (item.label.toLowerCase().includes(lower)) {
      results.push({
        type: "page",
        id: item.to,
        title: item.label,
        description: "General",
        url: item.to,
      });
    }
  }

  // Hardcoded check for Settings since it's now in the profile menu
  if ("settings".includes(lower)) {
    results.push({
      type: "page",
      id: "/settings",
      title: "Settings",
      description: "Account",
      url: "/settings",
    });
  }

  return results.slice(0, 5);
}

// ── Icons ──────────────────────────────────────────────────────────────────
const ResultIcon: React.FC<{ type: SearchResultItem["type"] }> = ({ type }) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (type === "document") return <FileText className={cls} />;
  if (type === "user") return <Users className={cls} />;
  if (type === "office") return <Building2 className={cls} />;
  if (type === "template") return <LayoutTemplate className={cls} />;
  if (type === "request") return <ClipboardList className={cls} />;
  if (type === "announcement") return <Megaphone className={cls} />;
  if (type === "page") return <Hash className={cls} />;
  return <LayoutDashboard className={cls} />;
};

const TYPE_ICON_BG: Record<string, string> = {
  document: "bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400",
  user: "bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400",
  office: "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400",
  template:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400",
  request: "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400",
  announcement: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400",
  page: "bg-slate-100 dark:bg-surface-400 text-slate-500 dark:text-slate-400",
};

// ── Empty results shape ────────────────────────────────────────────────────
const emptyResults = {
  pages: [] as SearchResultItem[],
  documents: [] as SearchResultItem[],
  requests: [] as SearchResultItem[],
  announcements: [] as SearchResultItem[],
  templates: [] as SearchResultItem[],
  users: [] as SearchResultItem[],
  offices: [] as SearchResultItem[],
};

// ── Command Menu ───────────────────────────────────────────────────────────
const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const role = getUserRole();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState(emptyResults);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<number | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // Flat list of all results for keyboard nav
  const flatResults = React.useMemo(() => {
    return [
      ...results.pages,
      ...results.documents,
      ...results.requests,
      ...results.announcements,
      ...results.templates,
      ...results.users,
      ...results.offices,
    ];
  }, [results]);

  const totalResults = flatResults.length;

  // Reset active index when results change
  React.useEffect(() => {
    setActiveIndex(0);
  }, [totalResults]);

  const openMenu = () => {
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const closeMenu = () => {
    setOpen(false);
    setQuery("");
    setResults(emptyResults);
    setLoading(false);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setQuery(q);

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    if (!q.trim()) {
      setResults(emptyResults);
      setLoading(false);
      return;
    }

    const pages = getPageResults(q, role ?? "");
    setResults((prev) => ({ ...prev, pages }));

    if (q.trim().length < 2) return;

    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      try {
        const data = await globalSearch(q.trim());
        setResults({
          pages,
          documents: data.documents,
          users: data.users,
          offices: data.offices,
          templates: data.templates,
          requests: data.requests,
          announcements: data.announcements || [],
        });
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const navigate_to = (item: SearchResultItem) => {
    closeMenu();
    if (item.type === "document" && !item.url.includes("/view")) {
      navigate(item.url, { state: { from: "/work-queue" } });
    } else {
      navigate(item.url);
    }
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        open ? closeMenu() : openMenu();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Keyboard navigation inside menu
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeMenu();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, totalResults - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    }
    if (e.key === "Enter" && flatResults[activeIndex]) {
      navigate_to(flatResults[activeIndex]);
    }
  };

  // Scroll active item into view
  React.useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // ── Result group ───────────────────────────────────────────────────────────
  const ResultGroup: React.FC<{
    label: string;
    items: SearchResultItem[];
    startIndex: number;
  }> = ({ label, items, startIndex }) => {
    if (!items.length) return null;
    return (
      <div>
        <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
        {items.map((item, i) => {
          const idx = startIndex + i;
          const isActive = idx === activeIndex;
          return (
            <button
              key={`${item.type}-${item.id}`}
              type="button"
              data-index={idx}
              onMouseEnter={() => setActiveIndex(idx)}
              onMouseDown={() => navigate_to(item)}
              className={[
                "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors",
                isActive
                  ? "bg-slate-50 dark:bg-surface-400"
                  : "hover:bg-slate-50 dark:hover:bg-surface-400",
              ].join(" ")}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${TYPE_ICON_BG[item.type] ?? TYPE_ICON_BG.page}`}
              >
                <ResultIcon type={item.type} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                  {item.title}
                </span>
                {item.description && (
                  <span className="block truncate text-xs text-slate-400 dark:text-slate-500">
                    {item.description}
                  </span>
                )}
              </span>
              <div className="shrink-0 flex items-center gap-2">
                {item.meta && (
                  <span className="rounded bg-slate-100 dark:bg-surface-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                    {item.meta}
                  </span>
                )}
                {isActive && (
                  <ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                )}
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  // Calculate start indices for keyboard nav
  const pageStart = 0;
  const docStart = results.pages.length;
  const reqStart = docStart + results.documents.length;
  const annStart = reqStart + results.requests.length;
  const tplStart = annStart + results.announcements.length;
  const usrStart = tplStart + results.templates.length;
  const offStart = usrStart + results.users.length;

  return (
    <>
      {/* Trigger button in navbar */}
      <button
        type="button"
        onClick={openMenu}
        className="flex items-center gap-2 w-full max-w-md rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 py-1.5 text-sm text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-surface-300 transition"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left text-sm">Search…</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500">
          Ctrl K
        </kbd>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm"
          onMouseDown={closeMenu}
        />
      )}

      {/* Command menu modal */}
      {open && (
        <div className="fixed left-1/2 top-[15vh] z-50 w-full max-w-xl -translate-x-1/2 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleQueryChange}
              onKeyDown={handleKeyDown}
              placeholder="Search documents, requests, templates, users…"
              className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
            />
            {query && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setQuery("");
                  setResults(emptyResults);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
            <kbd
              className="shrink-0 rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-slate-500 cursor-pointer"
              onMouseDown={closeMenu}
            >
              Esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[60vh] overflow-y-auto">
            {!query.trim() ? (
              <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                Start typing to search across documents, requests, templates and
                more.
              </div>
            ) : loading && totalResults === 0 ? (
              <div className="px-4 py-4">
                <SkeletonList rows={4} rowClassName="h-10 rounded-md" />
              </div>
            ) : totalResults === 0 && !loading ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No results for{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    "{query}"
                  </span>
                </p>
                <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                  Try a different search term.
                </p>
              </div>
            ) : (
              <div className="pb-2">
                <ResultGroup
                  label="Pages"
                  items={results.pages}
                  startIndex={pageStart}
                />
                <ResultGroup
                  label="Documents"
                  items={results.documents}
                  startIndex={docStart}
                />
                <ResultGroup
                  label="Requests"
                  items={results.requests}
                  startIndex={reqStart}
                />
                <ResultGroup
                  label="Announcements"
                  items={results.announcements}
                  startIndex={annStart}
                />
                <ResultGroup
                  label="Templates"
                  items={results.templates}
                  startIndex={tplStart}
                />
                <ResultGroup
                  label="Users"
                  items={results.users}
                  startIndex={usrStart}
                />
                <ResultGroup
                  label="Offices"
                  items={results.offices}
                  startIndex={offStart}
                />
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-surface-400 px-4 py-2">
            <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1 py-0.5 text-[10px]">
                  ↑
                </kbd>
                <kbd className="rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1 py-0.5 text-[10px]">
                  ↓
                </kbd>
                navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="rounded border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1 py-0.5 text-[10px]">
                  ↵
                </kbd>
                select
              </span>
            </div>
            {loading && totalResults > 0 && (
              <span className="text-[11px] text-slate-400 dark:text-slate-500 animate-pulse">
                Searching…
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SearchBar;
