import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDocumentsPage,
  getCurrentUserOfficeId,
  type Document,
} from "../services/documents";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { getUserRole, isQA, isSysAdmin } from "../lib/roleFilters";
import ShareDocumentModal from "../components/documents/ShareDocumentModal";
import { Search, X, RefreshCw, BookOpen, FileText, Share2 } from "lucide-react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" });
}

// ── Type badge ─────────────────────────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  internal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  external:
    "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  forms:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function TypeBadge({ type }: { type: string }) {
  const cls =
    TYPE_STYLES[type?.toLowerCase()] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}
    >
      {type || "—"}
    </span>
  );
}

// ── Source badge ───────────────────────────────────────────────────────────
function SourceBadge({
  source,
}: {
  source: "created" | "requested" | "shared";
}) {
  const map = {
    created:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400",
    requested:
      "bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400",
    shared:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400",
  };
  const label = {
    created: "Created",
    requested: "Requested",
    shared: "Shared",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${map[source]}`}
    >
      {label[source]}
    </span>
  );
}

// ── Doc row ────────────────────────────────────────────────────────────────
const DocRow: React.FC<{
  doc: Document;
  source: "created" | "requested" | "shared";
  canShare: boolean;
  onClick: () => void;
  onShare: () => void;
}> = ({ doc, source, canShare, onClick, onShare }) => (
  <button
    type="button"
    onClick={onClick}
    className="group w-full flex items-center gap-4 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition border-b border-slate-100 dark:border-surface-400 last:border-0"
  >
    {/* Icon */}
    <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600">
      <FileText className="h-4 w-4 text-slate-400 dark:text-slate-500" />
    </div>

    {/* Main info */}
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
          {doc.title}
        </span>
        <TypeBadge type={doc.doctype} />
        <SourceBadge source={source} />
      </div>
      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
        {doc.code && (
          <span className="font-mono text-[11px] text-slate-400 dark:text-slate-500">
            {doc.code}
          </span>
        )}
        {doc.ownerOffice && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {doc.ownerOffice.name}
          </span>
        )}
        {Array.isArray(doc.tags) && doc.tags.length > 0 && (
          <div className="flex items-center gap-1">
            {doc.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1.5 py-0 text-[10px] text-slate-400 dark:text-slate-500"
              >
                {t}
              </span>
            ))}
            {doc.tags.length > 3 && (
              <span className="text-[10px] text-slate-400">
                +{doc.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Right: version + date + share */}
    <div className="shrink-0 flex flex-col items-end gap-1.5">
      <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
        v{doc.version_number}
      </span>
      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        {formatDate(doc.created_at)}
      </span>
      {canShare && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onShare();
          }}
          className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
        >
          <Share2 className="h-2.5 w-2.5" />
          Share
        </button>
      )}
    </div>
  </button>
);

// ── Tab type ───────────────────────────────────────────────────────────────
type LibTab = "all" | "created" | "requested" | "shared";

const TAB_LABELS: Record<LibTab, string> = {
  all: "All",
  created: "Created",
  requested: "Requested",
  shared: "Shared",
};

// ── Determine source label per doc ─────────────────────────────────────────
function getDocSource(
  doc: Document,
  myOfficeId: number,
  _role?: ReturnType<typeof getUserRole>,
): "created" | "shared" | "requested" {
  // Shared: not owned by user's office
  if (doc.owner_office_id && doc.owner_office_id !== myOfficeId)
    return "shared";
  return "created";
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DocumentLibraryPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  const myOfficeId = getCurrentUserOfficeId();

  const [tab, setTab] = useState<LibTab>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const [rows, setRows] = useState<Document[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<number | null>(null);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  // Reset on filter change
  useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [tab, qDebounced, typeFilter]);

  // Derive scope from tab
  const scopeFromTab = useMemo((): "all" | "owned" | "shared" | "assigned" => {
    if (tab === "created") return "owned";
    if (tab === "shared") return "shared";
    if (tab === "requested") return "assigned";
    return "all";
  }, [tab]);

  // Load — always filter to Distributed only
  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!hasMore && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listDocumentsPage({
          page,
          perPage: 25,
          q: qDebounced.trim() || undefined,
          status: "Distributed",
          doctype: typeFilter !== "ALL" ? typeFilter : undefined,
          scope: scopeFromTab,
        });
        if (!alive) return;
        const incoming = res.data ?? [];
        setRows((prev) => (page === 1 ? incoming : [...prev, ...incoming]));
        setHasMore(
          res.meta?.current_page != null &&
            res.meta?.last_page != null &&
            res.meta.current_page < res.meta.last_page,
        );
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load library.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [page, qDebounced, typeFilter, scopeFromTab, hasMore]);

  const reloadLibrary = useCallback(async () => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, []);

  const { refresh, refreshing } = usePageBurstRefresh(reloadLibrary);

  const canShare = isQA(role) || isSysAdmin(role);

  // const tabCounts = useMemo(() => {
  //   // Just show total — granular counts would need separate API calls
  //   return rows.length;
  // }, [rows.length]);

  return (
    <PageFrame
      title="Document Library"
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            title="Refresh library"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      }
      contentClassName="flex flex-col min-h-0 gap-4 h-full"
    >
      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-slate-200 dark:border-surface-400 shrink-0">
        {(["all", "created", "requested", "shared"] as LibTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={[
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-sky-500 text-sky-600 dark:text-sky-400"
                : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
            ].join(" ")}
          >
            <BookOpen className="h-3.5 w-3.5" />
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, code…"
            className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition"
        >
          <option value="ALL">All types</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="forms">Forms</option>
        </select>

        {(q || typeFilter !== "ALL") && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setTypeFilter("ALL");
            }}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}

        {error && <span className="text-xs text-rose-500">{error}</span>}
      </div>

      {/* Doc list */}
      <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden overflow-y-auto flex-1 min-h-0">
        {initialLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-surface-400">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="px-4 py-3.5 flex items-center gap-4">
                <div className="h-9 w-9 rounded-xl bg-slate-100 dark:bg-surface-400 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-2">
                  <div className="h-4 w-2/3 rounded-md bg-slate-100 dark:bg-surface-400 animate-pulse" />
                  <div className="h-3 w-1/3 rounded-md bg-slate-100 dark:bg-surface-400 animate-pulse" />
                </div>
                <div className="h-4 w-16 rounded-md bg-slate-100 dark:bg-surface-400 animate-pulse" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <BookOpen className="h-8 w-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {tab === "all"
                ? "No distributed documents yet."
                : `No ${TAB_LABELS[tab].toLowerCase()} documents found.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-surface-400">
            {rows.map((doc) => {
              const source = getDocSource(doc, myOfficeId, role);
              return (
                <DocRow
                  key={doc.id}
                  doc={doc}
                  source={source}
                  canShare={canShare && doc.status === "Distributed"}
                  onClick={() =>
                    navigate(`/documents/${doc.id}/view`, {
                      state: { from: "/documents" },
                    })
                  }
                  onShare={() => {
                    setShareDocId(doc.id);
                    setShareOpen(true);
                  }}
                />
              );
            })}
            {hasMore && (
              <div className="flex justify-center py-3">
                <button
                  type="button"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={loading}
                  className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ShareDocumentModal
        open={shareOpen}
        documentId={shareDocId}
        onClose={() => {
          setShareOpen(false);
          setShareDocId(null);
        }}
        onSaved={() => {}}
      />
    </PageFrame>
  );
}
