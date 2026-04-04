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
  AlertCircle,
  HelpCircle,
  PlusCircle,
  Activity,
  FileSearch,
  BarChart3,
} from "lucide-react";
import { globalSearch, type SearchResultItem } from "../../services/search";
import { navGroups, inboxNavItem } from "../sidebar/navConfig";
import { getUserRole } from "../../lib/roleFilters";
import SkeletonList from "../ui/loader/SkeletonList";

// ── Page results (client-side) ─────────────────────────────────────────────
// ── Page results (client-side) ─────────────────────────────────────────────
function getPageResults(q: string, role: string): SearchResultItem[] {
  if (!q) return [];
  const lower = q.toLowerCase();
  const results: SearchResultItem[] = [];

  const addRecursive = (items: any[], groupLabel: string) => {
    for (const item of items) {
      if (!item.roles || item.roles.includes(role)) {
        if (item.label.toLowerCase().includes(lower)) {
          results.push({
            type: "page",
            id: item.to,
            title: item.label,
            description: groupLabel,
            url: item.to,
          });
        }
        if (item.children) {
          addRecursive(item.children, item.label);
        }
      }
    }
  };

  for (const group of navGroups) {
    addRecursive(group.items, group.label);
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

  // Check static / auxiliary items
  const extraPages = [
    { to: "/documents/all", label: "Workflows", desc: "Work Queue" },
    { to: "/document-requests", label: "Requests", desc: "Work Queue" },
    { to: "/documents", label: "Document Library", desc: "General" },
    { to: "/archive", label: "Archive Library", desc: "General" },
    { to: "/reports", label: "Reports", desc: "Reports" },
    { to: "/activity-logs", label: "Activity Logs", desc: "Reports" },
    { to: "/user-manager", label: "User Manager", desc: "Admin", roles: ["admin", "sysadmin"] },
    { to: "/office-manager", label: "Office Manager", desc: "Admin", roles: ["admin", "sysadmin"] },
    { to: "/system-health", label: "System Health", desc: "Maintenance", roles: ["admin", "sysadmin"] },
    { to: "/backup", label: "Database Backup", desc: "Maintenance", roles: ["admin", "sysadmin", "qa"] },
    { to: "/settings", label: "Settings", desc: "Account" },
    { to: "/my-activity", label: "My Activity", desc: "Account" },
    { to: "/whats-new", label: "What's New", desc: "Support" },
    { to: "/report-issue", label: "Report Issue", desc: "Support" },
    { to: "/help", label: "Help & Support", desc: "Support" },
  ];

  for (const p of extraPages) {
    if (!p.roles || p.roles.includes(role)) {
      if (p.label.toLowerCase().includes(lower)) {
        results.push({
          type: "page",
          id: p.to,
          title: p.label,
          description: p.desc,
          url: p.to,
        });
      }
    }
  }

  // Deduplicate by URL to prevent React key conflicts
  const seen = new Set<string>();
  return results.filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  }).slice(0, 10);
}

// ── Icons ──────────────────────────────────────────────────────────────────
const ResultIcon: React.FC<{ item: SearchResultItem }> = ({ item }) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  const { type, url, title } = item;
  
  if (type === "document") return <FileText className={cls} />;

  if (type === "user") return <Users className={cls} />;
  if (type === "office") return <Building2 className={cls} />;
  if (type === "template") return <LayoutTemplate className={cls} />;
  if (type === "request") return <ClipboardList className={cls} />;
  if (type === "announcement") return <Megaphone className={cls} />;
  if (type === "activity") return <Activity className={cls} />;
  
  // Specific page icons
  if (type === "page") {
    const t = title.toLowerCase();
    const u = url.toLowerCase();
    if (u.includes("help") || t.includes("help")) return <HelpCircle className={cls} />;
    if (u.includes("new") || t.includes("new")) return <Megaphone className={cls} />;
    if (u.includes("activity") || t.includes("activity")) return <Activity className={cls} />;
    if (u.includes("issue") || t.includes("issue")) return <AlertCircle className={cls} />;
    if (u.includes("dashboard") || t.includes("dashboard")) return <LayoutDashboard className={cls} />;

    if (u.includes("create") || t.includes("new")) return <PlusCircle className={cls} />;
    if (u.includes("queue") || t.includes("queue")) return <FileSearch className={cls} />;
    if (u.includes("/reports") || t === "reports") return <BarChart3 className={cls} />;
    return <Hash className={cls} />;
  }

  if (type === "suggestion") return <Search className={cls} />;
  
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
  activity: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-600 dark:text-cyan-400",
  page: "bg-slate-100 dark:bg-surface-400 text-slate-500 dark:text-slate-400",
  suggestion: "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400",
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
  activity: [] as SearchResultItem[],
  suggestions: [] as SearchResultItem[],
};

// ── Command Menu ───────────────────────────────────────────────────────────
interface SearchBarProps {
  isMobileIconOnly?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = () => {
  const navigate = useNavigate();
  const role = getUserRole();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState(emptyResults);
  const [activeIndex, setActiveIndex] = React.useState(0);

  const searchRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const debounceRef = React.useRef<number | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Flat list of all results for keyboard nav
  const flatResults = React.useMemo(() => {
    return [
      ...results.pages,
      ...results.suggestions,
      ...results.documents,
      ...results.requests,
      ...results.activity,
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

    // Ensure open if typing
    if (!open) setOpen(true);

    const pages = getPageResults(q, (role ?? "").toUpperCase());
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
          activity: data.activity || [],
          suggestions: data.suggestions || [],
        });
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const navigate_to = (item: SearchResultItem) => {
    if (item.type === "suggestion") {
      setQuery(item.title);
      // Wait for next fetch or trigger it manually
      return;
    }
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
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

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
      <div className="border-t first:border-t-0 border-slate-100 dark:border-surface-400">
        <p className="px-3.5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
        <div className="px-1.5 pb-1.5">
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
                  "flex w-full items-center gap-3 px-2.5 py-2 rounded-md text-left transition-all duration-150",
                  isActive
                    ? "bg-slate-100 dark:bg-surface-400 shadow-sm"
                    : "hover:bg-slate-50 dark:hover:bg-surface-400/50",
                ].join(" ")}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${TYPE_ICON_BG[item.type] ?? TYPE_ICON_BG.page} shadow-sm border border-white/20 dark:border-black/10`}
                >
                  <ResultIcon item={item} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block truncate text-xs font-bold text-slate-800 dark:text-slate-100">
                    {item.title}
                  </span>
                  {item.description && (
                    <span className="block truncate text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {item.description}
                    </span>
                  )}
                </span>
                <div className="shrink-0 flex items-center gap-2">
                  {item.meta && (
                    <span className="rounded bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                      {item.meta}
                    </span>
                  )}
                  {isActive && (
                    <ArrowRight className="h-3 w-3 text-brand-500 dark:text-brand-400 animate-in slide-in-from-left-1 duration-200" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Calculate start indices for keyboard nav
  const pageStart = 0;
  const sugStart = pageStart + results.pages.length;
  const docStart = sugStart + results.suggestions.length;
  const reqStart = docStart + results.documents.length;
  const actStart = reqStart + results.requests.length;
  const annStart = actStart + results.activity.length;
  const tplStart = annStart + results.announcements.length;
  const usrStart = tplStart + results.templates.length;
  const offStart = usrStart + results.users.length;

  return (
    <div className="relative w-full max-w-md flex flex-col" ref={searchRef}>
      {/* Navbar Input Field */}
      <div className={[
        "relative flex items-center gap-2 rounded-md border transition-all duration-200",
        open 
          ? "border-brand-600 dark:border-brand-500 bg-white dark:bg-surface-500 shadow-lg ring-1 ring-brand-600" 
          : "border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 hover:border-slate-300 dark:hover:border-surface-300"
      ].join(" ")}>
        <Search className={[
          "absolute left-3 h-3.5 w-3.5 shrink-0 transition-colors",
          open ? "text-brand-500 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"
        ].join(" ")} />
        
        <input
          ref={inputRef}
          type="text"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={handleQueryChange}
          onKeyDown={handleKeyDown}
          placeholder="Search documents, requests..."
          className="w-full bg-transparent pl-9 pr-12 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
        />

        <div className="absolute right-2 flex items-center gap-1.5">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setResults(emptyResults);
                inputRef.current?.focus();
              }}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-surface-300 transition"
            >
              <X className="h-3 w-3" />
            </button>
          )}
          {!query && (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 shadow-xs tabular-nums">
              <span className="text-[9px] opacity-70">Ctrl</span> K
            </kbd>
          )}
        </div>
      </div>

      {/* Results Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-60 mt-1.5 max-h-[65vh] flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-2xl overflow-hidden animate-pop-in-top">
          <div ref={listRef} className="flex-1 overflow-y-auto">
            {!query.trim() ? (
              <div className="px-4 py-8 text-center bg-slate-50/30 dark:bg-black/5">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400 mb-3">
                  <Search size={18} className="text-slate-400 dark:text-slate-500" />
                </div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Quick search</p>
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 max-w-45 mx-auto leading-relaxed">
                  Type to search across documents, templates and users.
                </p>
              </div>
            ) : loading && totalResults === 0 ? (
              <div className="px-4 py-4">
                <SkeletonList rows={3} rowClassName="h-9 rounded-md" />
              </div>
            ) : totalResults === 0 && !loading ? (
              <div className="px-4 py-10 text-center">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  No results for "{query}"
                </p>
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Try a different search term...
                </p>
              </div>
            ) : (
              <div className="flex flex-col">
                <ResultGroup
                  label="Pages"
                  items={results.pages}
                  startIndex={pageStart}
                />
                <ResultGroup
                  label="Suggestions"
                  items={results.suggestions}
                  startIndex={sugStart}
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
                  label="Activity Logs"
                  items={results.activity}
                  startIndex={actStart}
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

          {/* Footer Shortcuts */}
          {totalResults > 0 && (
            <div className="shrink-0 flex items-center justify-between border-t border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-black/5 px-4 py-2">
              <div className="flex items-center gap-3 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">
                <span className="flex items-center gap-1.5">
                  <span className="flex gap-1">
                    <kbd className="rounded bg-white dark:bg-surface-400 shadow-xs px-1 py-0.5 border border-slate-200 dark:border-surface-300">↑</kbd>
                    <kbd className="rounded bg-white dark:bg-surface-400 shadow-xs px-1 py-0.5 border border-slate-200 dark:border-surface-300">↓</kbd>
                  </span>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded bg-white dark:bg-surface-400 shadow-xs px-1 py-0.5 border border-slate-200 dark:border-surface-300">↵</kbd>
                  Select
                </span>
              </div>
              {loading && (
                <span className="text-[10px] font-bold text-brand-500 dark:text-brand-400 animate-pulse uppercase tracking-wider">
                  Updating...
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
