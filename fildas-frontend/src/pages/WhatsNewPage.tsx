import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import { getUserRole } from "../lib/roleFilters";
import {
  Megaphone,
  Plus,
  Trash2,
  X,
  ChevronDown,
  GripVertical,
} from "lucide-react";
import SelectDropdown from "../components/ui/SelectDropdown";


// ── Types ─────────────────────────────────────────────────────────────────────
type Tag = "New" | "Improved" | "Fixed" | "Performance";

type ChangeItem = {
  tag: Tag;
  text: string;
};

type Release = {
  id: string;
  version: string;
  date: string;
  label?: string;
  items: ChangeItem[];
  isCustom?: boolean;
};

// ── Static changelog ──────────────────────────────────────────────────────────
const STATIC_RELEASES: Release[] = [
  {
    id: "v2.6",
    version: "v2.6",
    date: "March 2026",
    items: [
      { tag: "New", text: "Help & Support center with topic pages, accordion articles, and breadcrumb navigation." },
      { tag: "New", text: "What's New page — dedicated changelog to track system updates." },
      { tag: "New", text: "Refresh button added to all data pages: User Manager, Office Manager, Inbox, Archive, Backup, and Announcements." },
      { tag: "Improved", text: "Refresh buttons are consistently placed in the page header across all pages." },
      { tag: "Improved", text: "Report Issue page now shows a breadcrumb linking back to Help & Support." },
    ],
  },
  {
    id: "v2.5",
    version: "v2.5",
    date: "March 2026",
    items: [
      { tag: "Performance", text: "Platform-wide browser caching for document previews — repeated opens load instantly." },
      { tag: "Performance", text: "PDF signing optimized with skip logic for faster turnaround on large documents." },
      { tag: "Improved", text: "Page number input in the document viewer now supports direct keyboard navigation." },
      { tag: "New", text: "Email notifications are now context-aware — messages include the document title, stage, and action taken." },
      { tag: "Improved", text: "Global search extended to cover archives and announcements." },
      { tag: "Fixed", text: "CORS configuration resolved for the production deployment." },
      { tag: "Improved", text: "Sidebar and UI aesthetics polished — spacing, color consistency, and dark mode refinements." },
    ],
  },
  {
    id: "v2.4",
    version: "v2.4",
    date: "February 2026",
    items: [
      { tag: "New", text: "Activity Reports page with daily activity stacked bar chart and activity distribution chart." },
      { tag: "New", text: "Report Export page — generate and download PDF exports of document and activity reports." },
      { tag: "New", text: "Admin Reports dashboard with user statistics, role breakdowns, and system activity charts." },
      { tag: "Improved", text: "Reports page updated with compliance cluster bar chart and stage delay chart." },
      { tag: "New", text: "Help & Report Issue pages added to the sidebar profile menu under Support." },
    ],
  },
  {
    id: "v2.3",
    version: "v2.3",
    date: "January 2026",
    items: [
      { tag: "New", text: "Dashboard redesigned with three role-aware variants: QA, Office, and Admin/Sysadmin." },
      { tag: "New", text: "QA dashboard shows document volume trend, status donut, stage delay chart, and compliance cluster bars." },
      { tag: "New", text: "Office dashboard shows pending tasks, recent activity, and assigned document summaries." },
      { tag: "New", text: "Admin dashboard shows active users, recent registrations, role distribution, and activity trends." },
      { tag: "Improved", text: "Work Queue layout and filtering refined for clarity and performance." },
      { tag: "New", text: "Global search added — find documents, announcements, and archives from the top navigation bar." },
    ],
  },
  {
    id: "v2.2",
    version: "v2.2",
    date: "January 2026",
    items: [
      { tag: "Improved", text: "Settings page split into Account and System tabs — personal info and notification preferences are now separate." },
      { tag: "New", text: "Sound notification toggle added — enable or disable audio alerts for incoming notifications." },
      { tag: "New", text: "Email notification toggle — control whether workflow events trigger email alerts." },
      { tag: "Improved", text: "User Manager table cleaned up with sortable columns, inline role and status filters, and pagination." },
      { tag: "Improved", text: "Office Manager table polished with type filtering and a consistent edit modal." },
      { tag: "Improved", text: "Activity Logs table updated with a calendar tab view and CSV/PDF export." },
    ],
  },
  {
    id: "v2.1",
    version: "v2.1",
    date: "December 2025",
    items: [
      { tag: "New", text: "Document Library now shows all completed documents with version history." },
      { tag: "Improved", text: "Library search, filter, and sort controls refined and made consistent across views." },
      { tag: "New", text: "Archive page added — view cancelled and superseded documents in one place." },
      { tag: "New", text: "Templates page with grid view and small file previews." },
      { tag: "Improved", text: "Document Request flow redesigned — comments, activity log, and submission actions are now in a unified panel." },
    ],
  },
  {
    id: "v2.0",
    version: "v2.0",
    date: "November 2025",
    items: [
      { tag: "New", text: "FilDAS v2 — full platform rewrite with a new React + TypeScript + Tailwind frontend and Laravel backend." },
      { tag: "New", text: "Five-stage document workflow: Draft → Review → Approval → Finalization → Completed." },
      { tag: "New", text: "QA-start and Office-start document creation modes." },
      { tag: "New", text: "Default and custom routing — choose the approval chain at creation time." },
      { tag: "New", text: "Document versioning — every revision produces the next version while preserving history." },
      { tag: "New", text: "Role-based access control across all pages and actions." },
      { tag: "New", text: "Dark mode support across the entire application." },
    ],
  },
];

const STORAGE_KEY = "fildas_custom_releases";

function loadCustomReleases(): Release[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Release[]) : [];
  } catch {
    return [];
  }
}

function saveCustomReleases(releases: Release[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(releases));
}

// ── Tag pill ──────────────────────────────────────────────────────────────────
const TAG_STYLES: Record<Tag, string> = {
  New: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  Improved: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  Fixed: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Performance: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
};

function TagPill({ tag }: { tag: Tag }) {
  return (
    <span className={`inline-block shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TAG_STYLES[tag]}`}>
      {tag}
    </span>
  );
}

// ── Filter tabs ───────────────────────────────────────────────────────────────
const ALL_TAGS: Tag[] = ["New", "Improved", "Fixed", "Performance"];

// ── Create modal ──────────────────────────────────────────────────────────────
type DraftItem = { tag: Tag; text: string };

function CreateReleaseModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (r: Release) => void;
}) {
  const [version, setVersion] = useState("");
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [items, setItems] = useState<DraftItem[]>([{ tag: "New", text: "" }]);
  const [error, setError] = useState("");

  const addItem = () =>
    setItems((prev) => [...prev, { tag: "New", text: "" }]);

  const removeItem = (i: number) =>
    setItems((prev) => prev.filter((_, idx) => idx !== i));

  const updateItem = (i: number, field: keyof DraftItem, value: string) =>
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === i ? { ...item, [field]: value } : item,
      ),
    );

  const handleSave = () => {
    if (!version.trim()) return setError("Version is required.");
    if (!date.trim()) return setError("Date is required.");
    const filledItems = items.filter((it) => it.text.trim());
    if (filledItems.length === 0) return setError("Add at least one change item.");

    onSave({
      id: `custom-${Date.now()}`,
      version: version.trim(),
      date: date.trim(),
      label: label.trim() || undefined,
      items: filledItems,
      isCustom: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-400 px-5 py-4">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            New Release Entry
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-600 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Version + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Version <span className="text-rose-500">*</span>
              </label>
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="e.g. v2.7"
                className="w-full rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 transition"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
                Date <span className="text-rose-500">*</span>
              </label>
              <input
                value={date}
                onChange={(e) => setDate(e.target.value)}
                placeholder="e.g. April 2026"
                className="w-full rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 transition"
              />
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Badge label{" "}
              <span className="font-normal text-slate-400 dark:text-slate-500">
                (optional — e.g. Latest, Hotfix)
              </span>
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Latest"
              className="w-full rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 transition"
            />
          </div>

          {/* Change items */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-slate-600 dark:text-slate-400">
              Change items <span className="text-rose-500">*</span>
            </label>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <GripVertical className="mt-2.5 h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" />
                  <SelectDropdown
                    value={item.tag}
                    onChange={(val) => updateItem(i, "tag", val as string)}
                    className="shrink-0 w-32"
                    options={ALL_TAGS.map((t) => ({
                      value: t,
                      label: t,
                    }))}
                  />
                  <input
                    value={item.text}
                    onChange={(e) => updateItem(i, "text", e.target.value)}
                    placeholder="Describe the change…"
                    className="flex-1 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400 transition"
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="mt-1.5 rounded p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-brand-500 hover:text-brand-600 transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Add item
            </button>
          </div>

          {error && (
            <p className="rounded-md bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-surface-400 px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 transition"
          >
            Cancel
          </button>
          <Button type="button" variant="primary" size="sm" onClick={handleSave}>
            Publish release
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Delete confirm ─────────────────────────────────────────────────────────────
function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirm, setConfirm] = useState(false);

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-[11px] text-slate-500 dark:text-slate-400">Delete?</span>
        <button
          type="button"
          onClick={onDelete}
          className="rounded px-2 py-0.5 text-[11px] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 dark:hover:bg-rose-950/40 transition"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setConfirm(false)}
          className="rounded px-2 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-400 transition"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirm(true)}
      className="rounded p-1 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition"
      title="Delete this release"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

// ── Collapsible release card ───────────────────────────────────────────────────
function ReleaseCard({
  release,
  isAdmin,
  onDelete,
  defaultOpen,
}: {
  release: Release;
  isAdmin: boolean;
  onDelete?: () => void;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="relative pl-7">
      {/* Timeline dot */}
      <div className={`absolute left-0 top-[18px] flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white dark:bg-surface-600 ${release.isCustom ? "border-brand-400 dark:border-brand-500" : "border-slate-200 dark:border-surface-400"}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${release.isCustom ? "bg-brand-500" : "bg-slate-400 dark:bg-slate-500"}`} />
      </div>

      {/* Release header — clickable to collapse */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group mb-2 flex w-full flex-wrap items-center gap-2 text-left"
      >
        <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {release.version}
        </span>
        {release.label && (
          <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
            {release.label}
          </span>
        )}
        {release.isCustom && (
          <span className="rounded-full border border-slate-200 dark:border-surface-300 px-2 py-0.5 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
            Custom
          </span>
        )}
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {release.date}
        </span>
        <ChevronDown
          className={`ml-auto h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {/* Items */}
      {open && (
        <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
          {release.items.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 border-b border-slate-100 dark:border-surface-400 px-4 py-3 last:border-0"
            >
              <div className="pt-0.5">
                <TagPill tag={item.tag} />
              </div>
              <p className="flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                {item.text}
              </p>
            </div>
          ))}

          {/* Admin delete — inside card footer */}
          {isAdmin && release.isCustom && onDelete && (
            <div className="flex items-center justify-end border-t border-slate-100 dark:border-surface-400 px-4 py-2">
              <DeleteButton onDelete={onDelete} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WhatsNewPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";

  const [customReleases, setCustomReleases] = useState<Release[]>(loadCustomReleases);
  const [activeTag, setActiveTag] = useState<Tag | "All">("All");
  const [showModal, setShowModal] = useState(false);

  // Persist whenever custom releases change
  useEffect(() => {
    saveCustomReleases(customReleases);
  }, [customReleases]);

  const allReleases = [...customReleases, ...STATIC_RELEASES];

  const filtered = allReleases
    .map((r) => ({
      ...r,
      items:
        activeTag === "All"
          ? r.items
          : r.items.filter((it) => it.tag === activeTag),
    }))
    .filter((r) => r.items.length > 0);

  const handleSave = (release: Release) => {
    setCustomReleases((prev) => [release, ...prev]);
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    setCustomReleases((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <>
      <PageFrame
        title="What's New"
        contentClassName="max-w-3xl mx-auto"
        right={
          isAdmin ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowModal(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              New release
            </Button>
          ) : undefined
        }
      >
        {/* Intro banner */}
        <div className="mb-6 flex items-start gap-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-500 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950/30">
            <Megaphone className="h-5 w-5 text-brand-600 dark:text-brand-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              FilDAS Release Notes
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              A record of every update, improvement, and fix shipped to the
              platform — newest first.
            </p>
          </div>
        </div>

        {/* Tag filter */}
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {(["All", ...ALL_TAGS] as const).map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setActiveTag(tag)}
              className={[
                "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                activeTag === tag
                  ? "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                  : "border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-surface-300 hover:bg-slate-50 dark:hover:bg-surface-400 hover:text-slate-800 dark:hover:text-slate-200",
              ].join(" ")}
            >
              {tag}
            </button>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Vertical rule */}
          <div className="absolute bottom-2 left-[7px] top-2 w-px bg-slate-200 dark:bg-surface-400" />

          <div className="space-y-8">
            {filtered.map((release, idx) => (
              <ReleaseCard
                key={release.id}
                release={release}
                isAdmin={isAdmin}
                onDelete={release.isCustom ? () => handleDelete(release.id) : undefined}
                defaultOpen={idx === 0}
              />
            ))}

            {filtered.length === 0 && (
              <div className="py-16 pl-7 text-center">
                <p className="text-sm text-slate-400 dark:text-slate-500">
                  No entries match this filter.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-6 py-4 text-center">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Found a bug or have a suggestion?{" "}
            <button
              type="button"
              onClick={() => navigate("/report-issue")}
              className="font-semibold text-brand-500 hover:underline"
            >
              Report it here
            </button>
          </p>
        </div>
      </PageFrame>

      {showModal && (
        <CreateReleaseModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
        />
      )}
    </>
  );
}
