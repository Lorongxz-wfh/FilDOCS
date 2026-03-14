import React from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing,
  Search,
  FileText,
  Users,
  Building2,
  LayoutDashboard,
  Inbox,
  ClipboardList,
  LayoutTemplate,
  X,
  Menu,
} from "lucide-react";
import InlineSpinner from "../ui/loader/InlineSpinner";
import SkeletonList from "../ui/loader/SkeletonList";
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "../../services/documents";
import { globalSearch, type SearchResultItem } from "../../services/search";
import { playNotificationChime } from "../../utils/notificationSound";
import { navGroups, settingsNavItem, inboxNavItem } from "../sidebar/navConfig";
import { getUserRole } from "../../lib/roleFilters";
import { Sun, Moon } from "lucide-react";

interface NavbarProps {
  onThemeToggle?: () => void;
  theme?: "light" | "dark";
  onMobileMenuOpen?: () => void;
}

// ── Page results from navConfig ────────────────────────────────────────────
function getPageResults(q: string, role: string): SearchResultItem[] {
  if (!q) return [];
  const lower = q.toLowerCase();
  const results: SearchResultItem[] = [];

  // Nav group pages
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

  // Settings + Inbox as static pages
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

// ── Icon per result type ───────────────────────────────────────────────────
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

const Navbar: React.FC<NavbarProps> = ({
  onThemeToggle,
  theme = "light",
  onMobileMenuOpen,
}) => {
  const navigate = useNavigate();
  const role = getUserRole();

  // ── Search state ───────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchLoading, setSearchLoading] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<{
    pages: SearchResultItem[];
    documents: SearchResultItem[];
    users: SearchResultItem[];
    offices: SearchResultItem[];
    templates: SearchResultItem[];
    requests: SearchResultItem[];
    notifications: SearchResultItem[];
  }>({
    pages: [],
    documents: [],
    users: [],
    offices: [],
    templates: [],
    requests: [],
    notifications: [],
  });
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

    if (searchDebounceRef.current)
      window.clearTimeout(searchDebounceRef.current);

    if (!q.trim()) {
      setSearchResults({
        pages: [],
        documents: [],
        users: [],
        offices: [],
        templates: [],
        requests: [],
        notifications: [],
      });
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

  const handleResultClick = (url: string) => {
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults({
      pages: [],
      documents: [],
      users: [],
      offices: [],
      templates: [],
      requests: [],
      notifications: [],
    });
    navigate(url);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults({
      pages: [],
      documents: [],
      users: [],
      offices: [],
      templates: [],
      requests: [],
      notifications: [],
    });
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

  // ── Notification state ─────────────────────────────────────────────────
  const [isNotifOpen, setIsNotifOpen] = React.useState(false);
  const [notifUnread, setNotifUnread] = React.useState<number>(0);
  const [notifItems, setNotifItems] = React.useState<NotificationItem[]>([]);
  const [notifLoading, setNotifLoading] = React.useState(false);
  const [notifError, setNotifError] = React.useState<string | null>(null);

  const prevUnreadRef = React.useRef<number>(0);

  async function refreshNotifBadge() {
    const n = await getUnreadNotificationCount();
    if (n > prevUnreadRef.current) {
      playNotificationChime();
    }
    prevUnreadRef.current = n;
    setNotifUnread(n);
  }

  async function loadNotifDropdown() {
    setNotifLoading(notifItems.length === 0);
    setNotifError(null);
    try {
      const { data } = await listNotifications({ page: 1, perPage: 5 });
      setNotifItems(data);
      await refreshNotifBadge();
    } catch (e: any) {
      setNotifError(e?.message ?? "Failed to load notifications.");
    } finally {
      setNotifLoading(false);
    }
  }

  const notifPollRef = React.useRef<number | null>(null);
  const notifBurstTimeoutRef = React.useRef<number | null>(null);

  async function refreshNotifications(opts?: { includeList?: boolean }) {
    await refreshNotifBadge();
    if (opts?.includeList) {
      try {
        const { data } = await listNotifications({ page: 1, perPage: 5 });
        setNotifItems(data);
      } catch {
        /* ignore */
      }
    }
  }

  function stopNotifPolling() {
    if (notifPollRef.current) window.clearInterval(notifPollRef.current);
    notifPollRef.current = null;
    if (notifBurstTimeoutRef.current)
      window.clearTimeout(notifBurstTimeoutRef.current);
    notifBurstTimeoutRef.current = null;
  }

  function startNotifPolling(mode: "idle" | "open" | "burst") {
    stopNotifPolling();
    const ms = mode === "open" ? 8000 : mode === "burst" ? 5000 : 30000;
    notifPollRef.current = window.setInterval(() => {
      refreshNotifications({ includeList: isNotifOpen }).catch(() => {});
    }, ms);
    if (mode === "burst") {
      notifBurstTimeoutRef.current = window.setTimeout(() => {
        startNotifPolling(isNotifOpen ? "open" : "idle");
      }, 8000);
    }
  }

  React.useEffect(() => {
    refreshNotifications({ includeList: false }).catch(() => {});
    startNotifPolling("idle");
    return () => stopNotifPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    const onRefresh = () => {
      refreshNotifications({ includeList: isNotifOpen }).catch(() => {});
      startNotifPolling("burst");
    };
    window.addEventListener("notifications:refresh", onRefresh);
    return () => window.removeEventListener("notifications:refresh", onRefresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNotifOpen]);

  // ── Result group renderer ──────────────────────────────────────────────
  const ResultGroup: React.FC<{
    label: string;
    items: SearchResultItem[];
  }> = ({ label, items }) => {
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
            onMouseDown={() => handleResultClick(item.url)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-surface-400 text-slate-500 dark:text-slate-300">
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
              <span className="shrink-0 rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 capitalize">
                {item.meta}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <header className="relative z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-surface-400 dark:bg-surface-500/80">
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={onMobileMenuOpen}
          className="md:hidden rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Left spacer to push search to center — desktop only */}
        <div className="hidden md:block w-190" />
        {/* Search bar — centered */}
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
              className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 pl-9 pr-8 py-1.5 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition"
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

          {/* Results dropdown */}
          {searchOpen && searchQuery.trim() && (
            <div className="absolute left-0 right-0 top-full mt-1.5 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl overflow-hidden">
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
                  <ResultGroup
                    label="Documents"
                    items={searchResults.documents}
                  />
                  <ResultGroup
                    label="Requests"
                    items={searchResults.requests}
                  />
                  <ResultGroup
                    label="Templates"
                    items={searchResults.templates}
                  />
                  <ResultGroup
                    label="Notifications"
                    items={searchResults.notifications}
                  />
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

        {/* Right actions — equal width to left spacer so search stays centered */}
        <div className="flex-1 flex items-center justify-end gap-1.5">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={onThemeToggle}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>

          {/* Notification bell */}
          <button
            type="button"
            onClick={() => {
              setIsNotifOpen((v) => {
                const next = !v;
                if (next) {
                  loadNotifDropdown();
                  startNotifPolling("open");
                } else startNotifPolling("idle");
                return next;
              });
            }}
            className="relative rounded-md p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
            aria-haspopup="menu"
            aria-expanded={isNotifOpen}
          >
            <BellRing className="h-4 w-4" />
            {notifUnread > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
                {notifUnread > 99 ? "99+" : notifUnread}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {isNotifOpen && (
            <div className="absolute right-4 top-14 w-72 rounded-xl border border-slate-200 bg-white shadow-lg dark:border-surface-400 dark:bg-surface-500">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-surface-400">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Inbox
                </div>
                {notifLoading && <InlineSpinner className="h-3 w-3 border-2" />}
              </div>
              <div className="max-h-56 overflow-auto px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                {notifError ? (
                  <div className="py-4 text-rose-700 dark:text-rose-400">
                    {notifError}
                  </div>
                ) : notifItems.length === 0 && notifLoading ? (
                  <div className="py-2">
                    <SkeletonList rows={4} rowClassName="h-10 rounded-md" />
                  </div>
                ) : notifItems.length === 0 ? (
                  <div className="py-4 text-slate-500 dark:text-slate-400">
                    Inbox is empty.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {notifItems.map((n) => {
                      const isUnread = !n.read_at;
                      return (
                        <button
                          key={n.id}
                          type="button"
                          className={[
                            "w-full rounded-md border px-3 py-2 text-left transition",
                            isUnread
                              ? "border-sky-200 bg-sky-50 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:hover:bg-sky-950/60"
                              : "border-slate-200 bg-white hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-600 dark:hover:bg-surface-400",
                          ].join(" ")}
                          onClick={async () => {
                            try {
                              if (!n.read_at) await markNotificationRead(n.id);
                              await refreshNotifBadge();
                              setIsNotifOpen(false);
                              startNotifPolling("burst");
                              const noLink = Boolean((n as any)?.meta?.no_link);
                              if (noLink) return;
                              if (n.document_id)
                                navigate(`/documents/${n.document_id}`);
                              else navigate("/inbox");
                            } catch {
                              /* ignore */
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div
                                className={[
                                  "truncate text-xs font-semibold",
                                  isUnread
                                    ? "text-slate-900 dark:text-slate-100"
                                    : "text-slate-700 dark:text-slate-300",
                                ].join(" ")}
                              >
                                {n.title}
                              </div>
                              {n.body && (
                                <div className="mt-0.5 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">
                                  {n.body}
                                </div>
                              )}
                            </div>
                            {isUnread && (
                              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 dark:border-surface-400">
                <button
                  type="button"
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  onClick={async () => {
                    try {
                      await markAllNotificationsRead();
                      await loadNotifDropdown();
                      startNotifPolling("burst");
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  Mark all as read
                </button>
                <button
                  type="button"
                  className="text-xs font-medium text-sky-700 hover:text-sky-900 dark:text-sky-400 dark:hover:text-sky-300"
                  onClick={() => {
                    setIsNotifOpen(false);
                    navigate("/inbox");
                  }}
                >
                  View all
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
