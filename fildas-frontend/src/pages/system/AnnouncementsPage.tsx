import React from "react";
import {
  Trash2,
  Pin,
  X,
  Archive,
  ArchiveX,
  Search,
  Bell,
  Megaphone,
} from "lucide-react";
import PageFrame from "../../components/layout/PageFrame";
import Button from "../../components/ui/Button";
import { PageActions, CreateAction } from "../../components/ui/PageActions";
import Skeleton from "../../components/ui/loader/Skeleton";
import { useSmartRefresh } from "../../hooks/useSmartRefresh";
import {
  listAllAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  archiveAnnouncement,
  unarchiveAnnouncement,
  type Announcement,
} from "../../services/documents";
import { getUserRole } from "../../lib/roleFilters";
import { AnnouncementTypePill } from "../../components/ui/Badge";
import SelectDropdown from "../../components/ui/SelectDropdown";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { inputCls } from "../../utils/formStyles";
import EmptyState from "../../components/ui/EmptyState";

// ─── Types ─────────────────────────────────────────────────────────────────
type PageTab = "active" | "all";
type DateFilter = "all" | "today" | "week" | "month";

// ─── Helpers ───────────────────────────────────────────────────────────────
const TYPE_BAR: Record<string, string> = {
  info:    "bg-sky-400",
  warning: "bg-amber-400",
  urgent:  "bg-rose-500",
};

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function timeFormat(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { 
    hour: 'numeric', 
    minute: '2-digit', 
    hour12: true 
  });
}

function getMonthLabel(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
}

function groupByMonth(
  items: Announcement[],
): { label: string; items: Announcement[] }[] {
  const map = new Map<string, Announcement[]>();
  for (const a of items) {
    const label = getMonthLabel(a.created_at);
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(a);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

function applyDateFilter(
  items: Announcement[],
  filter: DateFilter,
): Announcement[] {
  if (filter === "all") return items;
  const now = new Date();
  if (filter === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return items.filter((a) => new Date(a.created_at) >= start);
  }
  if (filter === "week") {
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    return items.filter((a) => new Date(a.created_at) >= start);
  }
  if (filter === "month") {
    return items.filter((a) => {
      const d = new Date(a.created_at);
      return (
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      );
    });
  }
  return items;
}

// ─── Create Modal ──────────────────────────────────────────────────────────
const CreateModal: React.FC<{
  onClose: () => void;
  onCreated: (a: Announcement) => void;
}> = ({ onClose, onCreated }) => {
  const [title, setTitle] = React.useState("");
  const [body, setBody] = React.useState("");
  const [type, setType] = React.useState<"info" | "warning" | "urgent">("info");
  const [isPinned, setIsPinned] = React.useState(false);
  const [expiresAt, setExpiresAt] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await createAnnouncement({
        title: title.trim(),
        body: body.trim(),
        type,
        is_pinned: isPinned,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      onCreated(created);
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to create announcement.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-400 px-6 py-4 bg-slate-50 dark:bg-surface-600">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Publish New Announcement
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-6 space-y-5">
            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Title
              </label>
              <input
                type="text"
                required
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short, descriptive title"
                className={inputCls}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                Message Content
              </label>
              <textarea
                required
                maxLength={2000}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Full announcement details…"
                className={`${inputCls} resize-none`}
              />
              <p className="mt-1 text-right text-[10px] font-semibold text-slate-400">
                {body.length} / 2000
              </p>
            </div>

            <div className="flex items-end gap-4">
              <div className="flex-1">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Priority level
                </label>
                <SelectDropdown
                  value={type}
                  onChange={(val) => setType((val as any) || "info")}
                  className="w-full"
                  options={[
                    { value: "info", label: "Info" },
                    { value: "warning", label: "Warning" },
                    { value: "urgent", label: "Urgent" },
                  ]}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Auto-expire date
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 group">
              <div
                role="checkbox"
                aria-checked={isPinned}
                onClick={() => setIsPinned((p) => !p)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${isPinned ? "border-brand-500 bg-brand-500" : "border-slate-300 bg-white group-hover:border-slate-400 dark:border-surface-300 dark:bg-surface-600"}`}
              >
                {isPinned && (
                  <svg
                    className="h-2.5 w-2.5 text-white"
                    fill="none"
                    viewBox="0 0 10 10"
                  >
                    <path
                      d="M1.5 5l2.5 2.5 4.5-4.5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-tight text-slate-500 dark:text-slate-400">
                Pin to top of feed
              </span>
            </label>

            {error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-xs font-medium text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-slate-100 dark:border-surface-400 px-6 py-4 bg-slate-50/50 dark:bg-surface-600/50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="rounded-md bg-brand-500 px-6 py-2 text-[11px] font-semibold uppercase tracking-widest text-white hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md active:scale-95"
            >
              {submitting ? "Publishing..." : "Publish Feed"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Announcement Card ─────────────────────────────────────────────────────
const AnnouncementCard: React.FC<{
  a: Announcement;
  canManage: boolean;
  actionId: number | null;
  onArchive: (id: number) => void;
  onUnarchive: (id: number) => void;
  onDelete: (id: number) => void;
}> = ({ a, canManage, actionId, onArchive, onUnarchive, onDelete }) => {
  const isExpired = a.expires_at && new Date(a.expires_at) < new Date();
  const isArchived = a.is_archived;
  const busy = actionId === a.id;

  return (
    <div
      className={`group relative flex items-stretch rounded-xl border bg-white dark:bg-surface-500 transition-all duration-250 ${isArchived ? "opacity-50 border-slate-200 grayscale dark:border-surface-400 " : isExpired ? "opacity-75 border-slate-200 dark:border-surface-400 " : "border-slate-200 dark:border-surface-400  hover:border-brand-200 dark:hover:border-brand-900/50"}`}
    >
      <div
        className={`w-1 shrink-0 rounded-l-sm transition-colors ${isArchived || isExpired ? "bg-slate-300 dark:bg-slate-600" : (TYPE_BAR[a.type] || "bg-slate-300")}`}
      />

      <div className="flex flex-1 items-start justify-between gap-4 px-4 py-4 min-w-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {a.title}
            </p>
            {a.is_pinned && (
              <Pin className="h-3 w-3 text-brand-500 dark:text-brand-400 shrink-0 fill-current" />
            )}
            {isArchived ? (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-tight bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400">
                <Archive className="h-2.5 w-2.5" /> Archived
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-tight bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400">
                Expired
              </span>
            ) : (
              <AnnouncementTypePill type={a.type} />
            )}
          </div>

          <p 
            className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: a.body }}
          />

          {/* STANDARDIZED META ROW — EXACTLY LIKE INBOX CARD */}
          <div className="mt-3 flex items-center gap-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
            <span className="text-slate-600 dark:text-slate-300 font-semibold">{a.created_by}</span>
            <span className="opacity-30">·</span>
            <span>
              {new Date(a.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
              })}
            </span>
            <span className="opacity-30">·</span>
            <span>{timeFormat(a.created_at)}</span>
            <span className="opacity-30">·</span>
            <span>{timeAgo(a.created_at)}</span>
            {a.expires_at && (
              <>
                <span className="opacity-30">·</span>
                <span className={isExpired ? "text-rose-400" : ""}>
                   {isExpired ? "EXPIRED" : "EXPIRES"} {new Date(a.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </>
            )}
          </div>
        </div>

        {canManage && (
          <div className="flex items-center gap-1 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {isArchived ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onUnarchive(a.id)}
                className="rounded-md p-1.5 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:text-slate-600 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/20 transition-all active:scale-90"
              >
                <ArchiveX className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onArchive(a.id)}
                className="rounded-md p-1.5 text-slate-300 hover:text-amber-500 hover:bg-amber-50 dark:text-slate-600 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-all active:scale-90"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(a.id)}
              className="rounded-md p-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:text-slate-600 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition-all active:scale-90"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Month group divider ───────────────────────────────────────────────────
const MonthGroup: React.FC<{
  label: string;
  count: number;
  children: React.ReactNode;
}> = ({ label, count, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="h-px flex-1 bg-slate-200 dark:bg-surface-400" />
      <p className="shrink-0 text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
        {count} {count === 1 ? "entry" : "entries"}
      </p>
    </div>
    <div className="space-y-3">{children}</div>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────
const TABS: { key: PageTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "all", label: "All Feed" },
];

const AnnouncementsPage: React.FC = () => {
  const navigate = useNavigate();
  const role = getUserRole();
  const canManage = role === "QA" || role === "ADMIN" || role === "SYSADMIN";

  const [items, setItems] = React.useState<Announcement[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [total, setTotal] = React.useState(0);
  const [showModal, setShowModal] = React.useState(false);
  const [actionId, setActionId] = React.useState<number | null>(null);
  const [activeTab, setActiveTab] = React.useState<PageTab>("active");
  const [dateFilter, setDateFilter] = React.useState<DateFilter>("all");
  const [search, setSearch] = React.useState("");
  
  const { refresh } = useSmartRefresh(async () => {
    setLoading(true);
    try {
      const first = await listAllAnnouncements(1);
      let all = [...first.data];
      const last = first.meta.last_page;
      if (last > 1) {
        const rest = await Promise.all(
          Array.from({ length: last - 1 }, (_, i) =>
            listAllAnnouncements(i + 2),
          ),
        );
        rest.forEach((r) => all.push(...r.data));
      }
      all.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setItems(all);
      setTotal(first.meta.total);
      return { changed: true, message: "Announcement feed synchronized." };
    } catch (e: any) {
      setError(e?.message ?? "Failed to load announcements feed.");
      throw e;
    } finally {
      setLoading(false);
    }
  });

  async function loadAll() {
    refresh();
  }

  React.useEffect(() => {
    loadAll();
  }, []);

  async function handleArchive(id: number) {
    setActionId(id);
    try {
      await archiveAnnouncement(id);
      setItems((prev) =>
        prev.map((a) =>
          a.id === id
            ? { ...a, is_archived: true, archived_at: new Date().toISOString() }
            : a,
        ),
      );
    } catch { /* ignore */ } finally {
      setActionId(null);
    }
  }

  async function handleUnarchive(id: number) {
    setActionId(id);
    try {
      await unarchiveAnnouncement(id);
      setItems((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, is_archived: false, archived_at: null } : a,
        ),
      );
    } catch { /* ignore */ } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: number) {
    setActionId(id);
    try {
      await deleteAnnouncement(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => t - 1);
    } catch { /* ignore */ } finally {
      setActionId(null);
    }
  }

  function handleCreated(a: Announcement) {
    setItems((prev) => {
      const next = [a, ...prev];
      next.sort((x, y) => {
        if (x.is_pinned !== y.is_pinned) return x.is_pinned ? -1 : 1;
        return (
          new Date(y.created_at).getTime() - new Date(x.created_at).getTime()
        );
      });
      return next;
    });
    setTotal((t) => t + 1);
  }

  const activeItems = items.filter((a) => !a.is_archived);
  const archivedItems = items.filter((a) => a.is_archived);

  const filtered = React.useMemo(() => {
    let list = activeTab === "active" ? activeItems : items;
    list = applyDateFilter(list, dateFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a => a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q));
    }
    return list;
  }, [items, activeTab, dateFilter, search]);

  const groups = groupByMonth(filtered);

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <PageFrame
      title="Announcement"
      onBack={handleBack}
      right={
        <PageActions>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/inbox")}
            className="text-[11px] font-semibold uppercase tracking-widest"
          >
            <Bell className="h-3.5 w-3.5 sm:mr-2" />
            <span className="hidden sm:inline">Inbox</span>
          </Button>
          {canManage && (
            <CreateAction
              label="New announcement"
              onClick={() => setShowModal(true)}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 bg-slate-50 dark:bg-surface-600 overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-6 space-y-6">
          {/* Header & Stats (Utilitarian) */}
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-brand-500 fill-brand-500/10" strokeWidth={1.5} />
              <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Announcement
              </h2>
            </div>
            {!loading && (
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                {total} total items · {activeItems.length} active · {archivedItems.length} archived
              </p>
            )}
          </div>

          {/* Filter & Search Toolbar (Inbox Style) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              {/* Page Tabs */}
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-surface-300 dark:bg-surface-600">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setActiveTab(t.key);
                      setDateFilter("all");
                    }}
                    className={`relative flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeTab === t.key
                        ? "bg-brand-500 text-white "
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Date Filters (Pills) */}
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-surface-300 dark:bg-surface-600">
                {(["all", "today", "week", "month"] as DateFilter[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDateFilter(f)}
                    className={`rounded px-2.5 py-1.5 text-[11px] font-semibold transition-colors uppercase tracking-tight ${
                      dateFilter === f
                        ? "bg-brand-500 text-white "
                        : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    }`}
                  >
                    {f === "all" ? "All" : f}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input — Standarized and Using UI Cls */}
            <div className="relative flex-1 max-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className={`${inputCls} !py-1.5 !pl-9  !text-xs !px-8`}
              />
              {search && (
                <button
                   onClick={() => setSearch("")}
                   className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab + dateFilter + search}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-8"
            >
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-4 py-4 space-y-3 "
                  >
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                ))
              ) : error ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
                  {error}
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  isSearch={!!search}
                  label={search ? "No matches found" : "Feed is empty"}
                  description={search 
                    ? "Adjust your search keywords or try a different filter to find what you're looking for." 
                    : "There are currently no announcements to show. New posts will appear here."
                  }
                />
              ) : (
                <div className="space-y-10">
                  {groups.map((group) => (
                    <MonthGroup
                      key={group.label}
                      label={group.label}
                      count={group.items.length}
                    >
                      {group.items.map((a) => (
                        <AnnouncementCard
                          key={a.id}
                          a={a}
                          canManage={canManage}
                          actionId={actionId}
                          onArchive={handleArchive}
                          onUnarchive={handleUnarchive}
                          onDelete={handleDelete}
                        />
                      ))}
                    </MonthGroup>
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </PageFrame>
  );
};

export default AnnouncementsPage;
