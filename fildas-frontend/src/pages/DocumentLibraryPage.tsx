import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDocumentsPage,
  getCurrentUserOfficeId,
  type Document,
} from "../services/documents";
import { useNavigate } from "react-router-dom";
import Table, { type TableColumn } from "../components/ui/Table";
import Button from "../components/ui/Button";
import PageFrame from "../components/layout/PageFrame";
import {
  getUserRole,
  isOfficeStaff,
  isOfficeHead,
  isQA,
  isSysAdmin,
} from "../lib/roleFilters";
import ShareDocumentModal from "../components/documents/ShareDocumentModal";
import { Search, X, LayoutList, LayoutGrid, RefreshCw } from "lucide-react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";

// ── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  review: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approval: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  registration:
    "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  distributed:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function StatusBadge({ status }: { status: string }) {
  const key = status?.toLowerCase().trim();
  const cls =
    STATUS_STYLES[key] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  internal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  external:
    "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  forms:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function TypeBadge({ type }: { type: string }) {
  const key = type?.toLowerCase() ?? "";
  const cls =
    TYPE_STYLES[key] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${cls}`}
    >
      {type || "—"}
    </span>
  );
}

// ── Filter select ─────────────────────────────────────────────────────────────
const selectCls =
  "rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition";

// ── View toggle storage key ───────────────────────────────────────────────────
const VIEW_KEY = "doclib_view";

// ── Card view ─────────────────────────────────────────────────────────────────
const DocCard: React.FC<{
  doc: Document;
  role: ReturnType<typeof getUserRole>;
  onClick: () => void;
  onShare: () => void;
}> = ({ doc, role, onClick, onShare }) => {
  const canShare =
    (isQA(role) || isSysAdmin(role)) && doc.status === "Distributed";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3.5 transition hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm"
    >
      {/* Title row */}
      <div className="flex items-start justify-between gap-2 min-w-0">
        <p className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate flex-1">
          {doc.title}
        </p>
        <span className="shrink-0 rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          v{doc.version_number}
        </span>
      </div>

      {/* Code */}
      <p className="mt-1 font-mono text-[11px] text-slate-400 dark:text-slate-500">
        {doc.code || "—"}
      </p>

      {/* Tags */}
      {Array.isArray(doc.tags) && doc.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {doc.tags.slice(0, 3).map((t) => (
            <span
              key={t}
              className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-400"
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

      {/* Bottom row: badges + date + share */}
      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <TypeBadge type={doc.doctype} />
          <StatusBadge status={doc.status} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {new Date(doc.created_at).toLocaleDateString()}
          </span>
          {canShare && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
              className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              Share
            </button>
          )}
        </div>
      </div>
    </button>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
interface DocumentLibraryPageProps {
  documents?: Document[];
}

const DocumentLibraryPage: React.FC<DocumentLibraryPageProps> = ({
  documents,
}) => {
  const navigate = useNavigate();

  // Default: cards on mobile, table on desktop
  const getInitialView = (): "table" | "cards" => {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "table" || stored === "cards") return stored;
    return window.innerWidth < 640 ? "cards" : "table";
  };

  const [viewMode, setViewMode] = useState<"table" | "cards">(getInitialView);

  // const toggleView = () => {
  //   setViewMode((v) => {
  //     const next = v === "table" ? "cards" : "table";
  //     localStorage.setItem(VIEW_KEY, next);
  //     return next;
  //   });
  // };

  const [loadedDocuments, setLoadedDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [scopeFilter, setScopeFilter] = useState<
    "all" | "owned" | "shared" | "assigned"
  >("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const PER_PAGE = 25;

  const [shareOpen, setShareOpen] = useState(false);
  const [shareDocId, setShareDocId] = useState<number | null>(null);

  const role = getUserRole();
  const myOfficeId = getCurrentUserOfficeId();

  const reloadLibrary = useCallback(async () => {
    setPage(1);
    // page reset triggers the load useEffect automatically
  }, []);

  const { refresh: refreshLibrary, refreshing: refreshingLibrary } =
    usePageBurstRefresh(reloadLibrary);

  useEffect(() => {
    setPage(1);
  }, [qDebounced, statusFilter, typeFilter, scopeFilter]);

  const displayDocuments = documents ?? loadedDocuments;

  const latestDocuments = useMemo(() => {
    const byFamily = new Map<number, Document>();
    for (const d of displayDocuments) {
      const familyId = Number(d.parent_document_id ?? d.id);
      const existing = byFamily.get(familyId);
      if (!existing) {
        byFamily.set(familyId, d);
        continue;
      }
      const better =
        Number(d.version_number) > Number(existing.version_number) ||
        (Number(d.version_number) === Number(existing.version_number) &&
          String(d.updated_at) > String(existing.updated_at));
      if (better) byFamily.set(familyId, d);
    }
    return Array.from(byFamily.values()).sort(
      (a, b) => Number(b.version_number) - Number(a.version_number),
    );
  }, [displayDocuments]);

  const statusOptions = useMemo(() => {
    if (loading) return ["ALL"];
    const s = new Set<string>();
    for (const d of latestDocuments) s.add(d.status);
    return ["ALL", ...Array.from(s).sort()];
  }, [latestDocuments, loading]);

  useEffect(() => {
    if (loading) return;
    if (!statusOptions.includes(statusFilter)) setStatusFilter("ALL");
  }, [loading, statusOptions, statusFilter]);

  useEffect(() => {
    if (documents) {
      setLoadedDocuments([]);
      setLoading(false);
      setError(null);
      setPage(1);
      setHasMore(false);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await listDocumentsPage({
          page,
          perPage: PER_PAGE,
          q: qDebounced.trim() || undefined,
          status: statusFilter !== "ALL" ? statusFilter : undefined,
          doctype: typeFilter !== "ALL" ? typeFilter : undefined,
          owner_office_id: undefined,
          scope: scopeFilter,
        });
        if (!alive) return;
        setLoadedDocuments((prev) => {
          const next = page === 1 ? res.data : [...prev, ...res.data];
          const byId = new Map<number, Document>();
          for (const d of next) byId.set(d.id, d);
          return Array.from(byId.values());
        });
        setHasMore(Boolean(res.links?.next));
      } catch (err: any) {
        if (!alive) return;
        setError(err?.message ?? "Failed to load documents");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [
    documents,
    page,
    qDebounced,
    statusFilter,
    typeFilter,
    scopeFilter,
    role,
    myOfficeId,
  ]);

  const isFiltered =
    q ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    scopeFilter !== "all";

  const columns: TableColumn<Document>[] = [
    {
      key: "title",
      header: "Title",
      render: (d) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800 dark:text-slate-100">
            {d.title}
          </div>
          {Array.isArray(d.tags) && d.tags.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {d.tags.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-500 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-400"
                >
                  {t}
                </span>
              ))}
              {d.tags.length > 3 && (
                <span className="text-[10px] text-slate-400">
                  +{d.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "code",
      header: "Code",
      render: (d) => (
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
          {d.code || "—"}
        </span>
      ),
    },
    {
      key: "type",
      header: "Type",
      render: (d) => <TypeBadge type={d.doctype} />,
    },
    {
      key: "status",
      header: "Status",
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: "version",
      header: "Ver.",
      align: "center",
      render: (d) => (
        <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          v{d.version_number}
        </span>
      ),
    },
    {
      key: "created",
      header: "Created",
      render: (d) => (
        <span className="text-xs text-slate-400 dark:text-slate-500">
          {new Date(d.created_at).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (d) => {
        const canShare =
          (isQA(role) || isSysAdmin(role)) && d.status === "Distributed";
        if (!canShare) return null;
        return (
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={(e) => {
              e.stopPropagation();
              setShareDocId(d.id);
              setShareOpen(true);
            }}
          >
            Share
          </Button>
        );
      },
    },
  ];

  // ── Card infinite scroll sentinel ─────────────────────────────────────────
  const cardSentinelRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewMode !== "cards") return;
    const sentinel = cardSentinelRef.current;
    if (!sentinel || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && hasMore) {
          setPage((p) => p + 1);
        }
      },
      { rootMargin: "100px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [viewMode, hasMore, loading]);

  return (
    <PageFrame
      title="Document Library"
      right={
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-0.5">
            <button
              type="button"
              onClick={() => {
                setViewMode("cards");
                localStorage.setItem(VIEW_KEY, "cards");
              }}
              title="Card view"
              className={[
                "rounded-md p-1.5 transition",
                viewMode === "cards"
                  ? "bg-white dark:bg-surface-500 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
              ].join(" ")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("table");
                localStorage.setItem(VIEW_KEY, "table");
              }}
              title="Table view"
              className={[
                "rounded-md p-1.5 transition",
                viewMode === "table"
                  ? "bg-white dark:bg-surface-500 text-slate-800 dark:text-slate-100 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300",
              ].join(" ")}
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={refreshLibrary}
            disabled={refreshingLibrary || loading}
            title="Refresh library"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshingLibrary ? "animate-spin" : ""}`}
            />
          </button>
          {(isQA(role) || isOfficeStaff(role) || isOfficeHead(role)) && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() =>
                navigate("/documents/create", {
                  state: isQA(role) ? { fromLibrary: true } : undefined,
                })
              }
            >
              Create document
            </Button>
          )}
        </div>
      }
      contentClassName="flex flex-col min-h-0 gap-4 h-full"
    >
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 shrink-0">
        {/* Search */}
        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, code, office…"
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
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className={selectCls}
        >
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {s === "ALL" ? "All statuses" : s}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={selectCls}
        >
          <option value="ALL">All types</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="forms">Forms</option>
        </select>

        <select
          value={scopeFilter}
          onChange={(e) => setScopeFilter(e.target.value as any)}
          className={selectCls}
        >
          <option value="all">All scope</option>
          <option value="assigned">Assigned</option>
          <option value="owned">Owned</option>
          <option value="shared">Shared</option>
        </select>

        {isFiltered && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setStatusFilter("ALL");
              setTypeFilter("ALL");
              setScopeFilter("all");
              setPage(1);
            }}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table view */}
      {viewMode === "table" && (
        <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
          <Table<Document>
            bare
            className="h-full"
            columns={columns}
            rows={latestDocuments}
            rowKey={(d) => d.id}
            onRowClick={(d) =>
              navigate(`/documents/${d.id}`, { state: { from: "/documents" } })
            }
            loading={loading}
            initialLoading={loading && latestDocuments.length === 0}
            error={error}
            emptyMessage="No documents found."
            hasMore={hasMore}
            onLoadMore={!documents ? () => setPage((p) => p + 1) : undefined}
            gridTemplateColumns="minmax(0,2.5fr) minmax(0,1fr) 100px 160px 60px 90px 80px"
          />
        </div>
      )}

      {/* Card view */}
      {viewMode === "cards" && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && latestDocuments.length === 0 ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              {error}
            </div>
          ) : latestDocuments.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
              No documents found.
            </div>
          ) : (
            <div className="space-y-2 pb-4">
              {latestDocuments.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  role={role}
                  onClick={() =>
                    navigate(`/documents/${doc.id}`, {
                      state: { from: "/documents" },
                    })
                  }
                  onShare={() => {
                    setShareDocId(doc.id);
                    setShareOpen(true);
                  }}
                />
              ))}
              {/* Infinite scroll sentinel */}
              <div ref={cardSentinelRef} className="py-3 flex justify-center">
                {loading && (
                  <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                )}
                {!loading && !hasMore && latestDocuments.length > 0 && (
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    All caught up
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
};

export default DocumentLibraryPage;
