import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  FileText,
  Users,
  Building2,
  LayoutDashboard,
  Inbox,
  ClipboardList,
  LayoutTemplate,
  X,
} from "lucide-react";
import InlineSpinner from "../ui/loader/InlineSpinner";
import SkeletonList from "../ui/loader/SkeletonList";
import { globalSearch, type SearchResultItem } from "../../services/search";
import { navGroups, settingsNavItem, inboxNavItem } from "../sidebar/navConfig";
import { getUserRole } from "../../lib/roleFilters";

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

  for (const item of [settingsNavItem, inboxNavItem]) {
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

  return results.slice(0, 6);
}

const ResultIcon: React.FC<{ type: SearchResultItem["type"] }> = ({ type }) => {
  const cls = "h-3.5 w-3.5 shrink-0";
  if (type === "document") return <FileText className={cls} />;
  if (type === "user") return <Users className={cls} />;
  if (type === "office") return <Building2 className={cls} />;
  if (type === "template") return <LayoutTemplate className={cls} />;
  if (type === "request") return <ClipboardList className={cls} />;
  if (type === "notification") return <Inbox className={cls} />;
  return <LayoutDashboard className={cls} />;
};

const emptyResults = {
  pages: [] as SearchResultItem[],
  documents: [] as SearchResultItem[],
  users: [] as SearchResultItem[],
  offices: [] as SearchResultItem[],
  templates: [] as SearchResultItem[],
  requests: [] as SearchResultItem[],
  notifications: [] as SearchResultItem[],
};

const SearchBar: React.FC = () => {
  const navigate = useNavigate();
  const role = getUserRole();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState(emptyResults);
  const searchRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const searchDebounceRef = React.useRef<number | null>(null);

  const totalResults =
    searchResults.pages.length +
    searchResults.documents.length +
    searchResults.users.length +
    searchResults.offices.length +
    searchResults.templates.length +
    searchResults.requests.length +
    searchResults.notifications.length;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setSearchQuery(q);
    setSearchOpen(true);

    if (searchDebounceRef.current) window.clearTimeout(searchDebounceRef.current);

    if (!q.trim()) {
      setSearchResults(emptyResults);
      setSearchLoading(false);
      return;
    }

    const pages = getPageResults(q, role ?? "");
    setSearchResults((prev) => ({ ...prev, pages }));

    if (q.trim().length < 2) return;

    setSearchLoading(true);
    searchDebounceRef.current = window.setTimeout(async () => {
      try {
        const data = await globalSearch(q.trim());
        setSearchResults({
          pages,
          documents: data.documents,
          users: data.users,
          offices: data.offices,
          templates: data.templates,
          requests: data.requests,
          notifications: data.notifications,
        });
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const handleResultClick = (url: string, item?: SearchResultItem) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults(emptyResults);
    if (item?.type === "document" && !url.includes("/view")) {
      navigate(url, { state: { from: "/work-queue" } });
    } else {
      navigate(url);
    }
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults(emptyResults);
    searchInputRef.current?.focus();
  };

  // Close on outside click
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
        searchInputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const ResultGroup: React.FC<{ label: string; items: SearchResultItem[] }> = ({
    label,
    items,
  }) => {
    if (!items.length) return null;
    return (
      <div>
        <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
          {label}
        </p>
        {items.map((item) => (
          <button
            key={`${item.type}-${item.id}`}
            type="button"
            onMouseDown={() => handleResultClick(item.url, item)}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-slate-100 dark:bg-surface-400 text-slate-500 dark:text-slate-300">
              <ResultIcon type={item.type} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                {item.title}
              </span>
              {item.description && (
                <span className="block truncate text-[11px] text-slate-400 dark:text-slate-500">
                  {item.description}
                </span>
              )}
            </span>
            {item.meta && (
              <span className="shrink-0 rounded bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                {item.meta}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
        <input
          ref={searchInputRef}
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            if (searchQuery) setSearchOpen(true);
          }}
          placeholder="Search documents, pages… (Ctrl+K)"
          className="w-full rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 pl-9 pr-8 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:focus:ring-brand-900/30 transition"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={clearSearch}
            className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {searchOpen && searchQuery.trim() && (
        <div className="absolute left-0 right-0 top-full mt-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-md overflow-hidden">
          {searchLoading && totalResults === 0 ? (
            <div className="px-3 py-4">
              <SkeletonList rows={3} rowClassName="h-8 rounded-md" />
            </div>
          ) : totalResults === 0 ? (
            <div className="px-4 py-5 text-sm text-slate-400 dark:text-slate-500 text-center">
              No results for{" "}
              <span className="font-medium text-slate-600 dark:text-slate-300">
                "{searchQuery}"
              </span>
            </div>
          ) : (
            <div className="py-1.5 max-h-80 overflow-y-auto">
              <ResultGroup label="Pages" items={searchResults.pages} />
              <ResultGroup label="Documents" items={searchResults.documents} />
              <ResultGroup label="Requests" items={searchResults.requests} />
              <ResultGroup label="Templates" items={searchResults.templates} />
              <ResultGroup label="Notifications" items={searchResults.notifications} />
              <ResultGroup label="Users" items={searchResults.users} />
              <ResultGroup label="Offices" items={searchResults.offices} />
            </div>
          )}
          {searchLoading && totalResults > 0 && (
            <div className="flex items-center gap-2 border-t border-slate-100 dark:border-surface-400 px-4 py-2 text-[11px] text-slate-400">
              <InlineSpinner className="h-3 w-3 border-2" /> Searching…
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;
