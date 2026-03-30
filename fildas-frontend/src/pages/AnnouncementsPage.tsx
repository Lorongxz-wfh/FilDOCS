import React from "react";
import {
  Megaphone,
  Plus,
  Trash2,
  Pin,
  X,
  Archive,
  ArchiveX,
} from "lucide-react";
import Skeleton from "../components/ui/loader/Skeleton";
import {
  listAllAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  archiveAnnouncement,
  unarchiveAnnouncement,
  type Announcement,
} from "../services/documents";
import { getUserRole } from "../lib/roleFilters";
import { AnnouncementTypePill } from "../components/ui/Badge";

// ─── Types ─────────────────────────────────────────────────────────────────
type PageTab = "active" | "all";
type DateFilter = "all" | "today" | "week" | "month" | "custom";

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
  from: string,
  to: string,
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
  if (filter === "custom") {
    const start = from ? new Date(from) : null;
    const end = to ? new Date(to + "T23:59:59") : null;
    return items.filter((a) => {
      const d = new Date(a.created_at);
      if (start && d < start) return false;
      if (end && d > end) return false;
      return true;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-400 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            New announcement
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-400 dark:hover:text-slate-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-5 py-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Title
              </label>
              <input
                type="text"
                required
                maxLength={255}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short, descriptive title"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-surface-300 dark:bg-surface-600 dark:text-slate-100 dark:placeholder-slate-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Message
              </label>
              <textarea
                required
                maxLength={2000}
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Full announcement details…"
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-surface-300 dark:bg-surface-600 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
              />
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {body.length}/2000
              </p>
            </div>

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Priority
                </label>
                <select
                  value={type}
                  onChange={(e) =>
                    setType(e.target.value as "info" | "warning" | "urgent")
                  }
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-surface-300 dark:bg-surface-600 dark:text-slate-100"
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Expires on (optional)
                </label>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:border-surface-300 dark:bg-surface-600 dark:text-slate-100"
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5">
              <div
                role="checkbox"
                aria-checked={isPinned}
                onClick={() => setIsPinned((p) => !p)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${isPinned ? "border-brand-500 bg-brand-500" : "border-slate-300 bg-white dark:border-surface-300 dark:bg-surface-600"}`}
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
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Pin to top of announcements
              </span>
            </label>

            {error && (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-950/30 dark:text-rose-400">
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-surface-400 px-5 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim() || !body.trim()}
              className="rounded-md bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Posting…" : "Post announcement"}
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
      className={`flex items-stretch rounded-md border bg-white dark:bg-surface-500 transition-opacity ${isArchived ? "opacity-50 border-slate-100 dark:border-surface-400" : isExpired ? "opacity-60 border-slate-100 dark:border-surface-400" : "border-slate-200 dark:border-surface-400"}`}
    >
      <div
        className={`w-1 shrink-0 rounded-l-sm ${isArchived || isExpired ? "bg-slate-300 dark:bg-slate-600" : (TYPE_BAR[a.type] ?? "bg-slate-300")}`}
      />

      {/* Content */}
      <div className="flex flex-1 items-start justify-between gap-3 px-4 py-3 min-w-0">
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
              {a.title}
            </p>
            {a.is_pinned && (
              <Pin className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
            )}
            {isArchived ? (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400">
                <Archive className="h-2.5 w-2.5" /> Archived
              </span>
            ) : isExpired ? (
              <span className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400">
                Expired
              </span>
            ) : (
              <AnnouncementTypePill type={a.type} />
            )}
          </div>

          {/* Body */}
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed whitespace-pre-wrap">
            {a.body}
          </p>

          {/* Meta */}
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 flex-wrap">
            <span className="font-medium">{a.created_by}</span>
            <span>·</span>
            <span>
              {new Date(a.created_at).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
            <span>·</span>
            <span>{timeAgo(a.created_at)}</span>
            {a.expires_at && (
              <>
                <span>·</span>
                <span
                  className={
                    isExpired ? "text-rose-400 dark:text-rose-500" : ""
                  }
                >
                  {isExpired ? "Expired" : "Expires"}{" "}
                  {new Date(a.expires_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </>
            )}
            {isArchived && a.archived_at && (
              <>
                <span>·</span>
                <span>
                  Archived{" "}
                  {new Date(a.archived_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Actions — QA/Admin only */}
        {canManage && (
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {isArchived ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onUnarchive(a.id)}
                className="rounded p-1 text-slate-300 hover:text-emerald-500 hover:bg-emerald-50 dark:text-slate-600 dark:hover:text-emerald-400 dark:hover:bg-emerald-950/20 transition-colors disabled:opacity-40"
                aria-label="Unarchive announcement"
              >
                <ArchiveX className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => onArchive(a.id)}
                className="rounded p-1 text-slate-300 hover:text-amber-500 hover:bg-amber-50 dark:text-slate-600 dark:hover:text-amber-400 dark:hover:bg-amber-950/20 transition-colors disabled:opacity-40"
                aria-label="Archive announcement"
              >
                <Archive className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => onDelete(a.id)}
              className="rounded p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:text-slate-600 dark:hover:text-rose-400 dark:hover:bg-rose-950/20 transition-colors disabled:opacity-40"
              aria-label="Delete announcement"
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
  <div>
    <div className="mb-3 flex items-center gap-3">
      <p className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        {label}
      </p>
      <div className="h-px flex-1 bg-slate-200 dark:bg-surface-400" />
      <p className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
        {count} {count === 1 ? "post" : "posts"}
      </p>
    </div>
    <div className="space-y-2">{children}</div>
  </div>
);

// ─── Page ──────────────────────────────────────────────────────────────────
const TABS: { key: PageTab; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
];

const AnnouncementsPage: React.FC = () => {
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
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  async function loadAll() {
    setLoading(true);
    setError(null);
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
      // Pinned first, then newest
      all.sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
      setItems(all);
      setTotal(first.meta.total);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load announcements.");
    } finally {
      setLoading(false);
    }
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
    } catch {
      /* silent */
    } finally {
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
    } catch {
      /* silent */
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(id: number) {
    setActionId(id);
    try {
      await deleteAnnouncement(id);
      setItems((prev) => prev.filter((a) => a.id !== id));
      setTotal((t) => t - 1);
    } catch {
      /* silent */
    } finally {
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

  // Active = not archived (expired ones still show, just dimmed)
  const activeItems = items.filter((a) => !a.is_archived);
  const archivedItems = items.filter((a) => a.is_archived);

  // Apply date filter only on active tab
  const filteredActive = applyDateFilter(
    activeItems,
    dateFilter,
    customFrom,
    customTo,
  );
  const activeGroups = groupByMonth(filteredActive);
  const archiveGroups = groupByMonth(archivedItems);

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-surface-400 dark:bg-surface-600 px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Megaphone className="h-4 w-4 text-slate-400" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  Announcements
                </h1>
                {!loading && (
                  <span className="rounded-full bg-slate-200/50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-surface-400 dark:text-slate-300">
                    {total}
                  </span>
                )}
              </div>
              {!loading && (
                <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  {total} total · {activeItems.length} active ·{" "}
                  {archivedItems.length} archived
                </p>
              )}
            </div>
          </div>

          {canManage && (
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-2 text-xs font-semibold text-white hover:bg-brand-400 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              New announcement
            </button>
          )}
        </div>

        {/* ── Toolbar: tabs + date filters in one row ── */}
        <div className="mt-3 flex items-center justify-between gap-3">
          {/* Left — page tabs */}
          <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-surface-300 dark:bg-surface-600">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key);
                  setDateFilter("all");
                  setCustomFrom("");
                  setCustomTo("");
                }}
                className={`relative flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === t.key
                    ? "bg-brand-500 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                }`}
              >
                {t.label}
                {!loading && t.key === "active" && activeItems.length > 0 && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full h-4 min-w-4 px-1 text-[10px] font-bold ${
                      activeTab === "active"
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400"
                    }`}
                  >
                    {activeItems.length}
                  </span>
                )}
                {!loading && t.key === "all" && archivedItems.length > 0 && (
                  <span
                    className={`inline-flex items-center justify-center rounded-full h-4 min-w-4 px-1 text-[10px] font-bold ${
                      activeTab === "all"
                        ? "bg-white/25 text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400"
                    }`}
                  >
                    {archivedItems.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Right — date filters, Active tab only */}
          {activeTab === "active" && (
            <div className="flex items-center gap-2">
              {/* Period pills */}
              <div className="flex items-center rounded-md border border-slate-200 bg-slate-100 p-0.5 dark:border-surface-300 dark:bg-surface-600">
                {(
                  ["all", "today", "week", "month", "custom"] as DateFilter[]
                ).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setDateFilter(f)}
                    className={`rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                      dateFilter === f
                        ? "bg-brand-500 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    {f === "all"
                      ? "All time"
                      : f === "today"
                        ? "Today"
                        : f === "week"
                          ? "Week"
                          : f === "month"
                            ? "Month"
                            : "Range"}
                  </button>
                ))}
              </div>

              {/* Custom date inputs — slide in when Range selected */}
              {dateFilter === "custom" && (
                <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 dark:border-surface-300 dark:bg-surface-600 shadow-sm">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-slate-300 [color-scheme:light] dark:[color-scheme:dark]"
                  />
                  <span className="text-[11px] text-slate-300 dark:text-slate-600">
                    —
                  </span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="bg-transparent text-[11px] text-slate-700 focus:outline-none dark:text-slate-300 [color-scheme:dark]"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Scrollable list ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-5 py-4 space-y-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 px-4 py-3 space-y-2"
              >
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            ))
          ) : error ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/20 dark:text-rose-400">
              {error}
            </div>
          ) : activeTab === "active" ? (
            // ── Active tab ──
            filteredActive.length === 0 ? (
              <div className="py-16 text-center">
                <Megaphone className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                  {dateFilter !== "all"
                    ? "No announcements in this period"
                    : "No active announcements"}
                </p>
                {canManage && (
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    Post one using the button above.
                  </p>
                )}
              </div>
            ) : (
              activeGroups.map((group) => (
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
              ))
            )
          ) : (
            // ── All tab — active first, then archived section ──
            <>
              {activeItems.length === 0 && archivedItems.length === 0 ? (
                <div className="py-16 text-center">
                  <Megaphone className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                  <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
                    No announcements yet
                  </p>
                  {canManage && (
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                      Post one using the button above.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {/* Active group */}
                  {activeGroups.map((group) => (
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

                  {/* Archived section divider */}
                  {archivedItems.length > 0 && (
                    <>
                      <div className="flex items-center gap-3 pt-2">
                        <Archive className="h-3.5 w-3.5 shrink-0 text-slate-400 dark:text-slate-500" />
                        <p className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                          Archived
                        </p>
                        <div className="h-px flex-1 bg-slate-200 dark:bg-surface-400" />
                        <p className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                          {archivedItems.length}{" "}
                          {archivedItems.length === 1 ? "post" : "posts"}
                        </p>
                      </div>
                      {archiveGroups.map((group) => (
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
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>

      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default AnnouncementsPage;
