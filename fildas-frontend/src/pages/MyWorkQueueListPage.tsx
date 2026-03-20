import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listDocumentsPage, type Document } from "../services/documents";
import { getUserRole, isQA, isSysAdmin } from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import Button from "../components/ui/Button";
import Alert from "../components/ui/Alert";
import RefreshButton from "../components/ui/RefreshButton";
import DateRangeInput from "../components/ui/DateRangeInput";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { Search, X } from "lucide-react";
import { inputCls, selectCls } from "../utils/formStyles";
import { formatDate } from "../utils/formatters";

// ── Badge helpers ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft:        "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  review:       "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  approval:     "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  finalization: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  distributed:  "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled:    "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  superseded:   "bg-slate-50 text-slate-400 dark:bg-surface-500 dark:text-slate-500",
};

const TYPE_STYLES: Record<string, string> = {
  internal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  external: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  forms:    "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status?.toLowerCase()] ?? STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {status || "—"}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_STYLES[type?.toLowerCase()] ?? "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {type || "—"}
    </span>
  );
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

type WFTab = "all" | "active" | "done";

const TABS: { value: WFTab; label: string }[] = [
  { value: "all",    label: "All" },
  { value: "active", label: "Active" },
  { value: "done",   label: "Done" },
];

const TERMINAL_STATUSES = new Set(["distributed", "cancelled", "superseded"]);

// ── Main page ────────────────────────────────────────────────────────────────

export default function MyWorkQueueListPage() {
  const navigate = useNavigate();
  const role = getUserRole();
  const canSeeAll = isQA(role) || isSysAdmin(role) || role === "ADMIN";
  const isAdmin = role === "ADMIN" || isSysAdmin(role);
  const adminDebugMode = useAdminDebugMode();
  const canCreate = isQA(role) || role === "OFFICE_STAFF" || role === "OFFICE_HEAD" || (isAdmin && adminDebugMode);
  const showOffice = canSeeAll;

  const [tab, setTab] = useState<WFTab>("all");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [rows, setRows] = useState<Document[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [tab, qDebounced, typeFilter, dateFrom, dateTo]);

  const statusParam = tab === "done" ? "Distributed" : undefined;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!hasMore && page > 1) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listDocumentsPage({
          page,
          perPage: 30,
          q: qDebounced.trim() || undefined,
          status: statusParam,
          doctype: typeFilter || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
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
        setError(e?.message ?? "Failed to load documents.");
      } finally {
        if (!alive) return;
        setLoading(false);
        setInitialLoading(false);
      }
    };
    load();
    return () => { alive = false; };
  }, [page, qDebounced, statusParam, typeFilter, dateFrom, dateTo, hasMore]);

  const reload = useCallback(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, []);

  const displayRows = useMemo(() => {
    if (tab === "active") {
      return rows.filter((d) => !TERMINAL_STATUSES.has(d.status?.toLowerCase() ?? ""));
    }
    return rows;
  }, [rows, tab]);

  const hasFilters = q || typeFilter || dateFrom || dateTo;

  const tabCls = (active: boolean) =>
    [
      "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
      active
        ? "border-brand-500 text-brand-600 dark:text-brand-400"
        : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
    ].join(" ");

  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: TableColumn<Document>[] = useMemo(() => {
    const cols: TableColumn<Document>[] = [
      {
        key: "status",
        header: "Status",
        render: (doc) => <StatusBadge status={doc.status} />,
      },
      {
        key: "title",
        header: "Document",
        render: (doc) => (
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-sky-600 dark:group-hover:text-sky-400 transition-colors">
              {doc.title}
            </p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <TypeBadge type={doc.doctype} />
              {Array.isArray(doc.tags) && doc.tags.slice(0, 2).map((t) => (
                <span key={t} className="rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-1.5 text-[10px] text-slate-400 dark:text-slate-500">
                  {t}
                </span>
              ))}
              {Array.isArray(doc.tags) && doc.tags.length > 2 && (
                <span className="text-[10px] text-slate-400">+{doc.tags.length - 2}</span>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "code",
        header: "Code",
        render: (doc) => (
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {doc.code || "—"}
          </span>
        ),
      },
    ];

    if (showOffice) {
      cols.push({
        key: "office",
        header: "Office",
        render: (doc) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {doc.ownerOffice?.name ?? "—"}
          </span>
        ),
      });
    }

    cols.push(
      {
        key: "version",
        header: "Ver.",
        align: "center",
        render: (doc) => (
          <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:text-slate-300">
            v{doc.version_number}
          </span>
        ),
      },
      {
        key: "created",
        header: "Created",
        align: "right",
        render: (doc) => (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {formatDate(doc.created_at)}
          </span>
        ),
      },
    );

    return cols;
  }, [showOffice]);

  // grid: status(auto) | title(1fr) | code(auto) | [office(auto)] | ver(auto) | created(auto)
  const gridTemplateColumns = showOffice
    ? "auto 1fr auto auto auto auto"
    : "auto 1fr auto auto auto";

  return (
    <PageFrame
      title="Workflow Documents"
      onBack={() => navigate("/work-queue")}
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
      right={
        <div className="flex items-center gap-2">
          <RefreshButton onClick={reload} loading={loading} title="Refresh" />
          {canCreate && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", { state: { fromWorkQueue: true } });
              }}
            >
              + Create document
            </Button>
          )}
        </div>
      }
    >
      {/* Tabs */}
      <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400 px-4">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => setTab(t.value)} className={tabCls(tab === t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="shrink-0 border-b border-slate-200 dark:border-surface-400 px-4 py-2.5 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, code, office…"
            className={`${inputCls} pl-9 pr-8`}
          />
          {q && (
            <button type="button" onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectCls}>
          <option value="">All types</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="forms">Forms</option>
        </select>

        <DateRangeInput from={dateFrom} to={dateTo} onFromChange={setDateFrom} onToChange={setDateTo} />

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setQ(""); setTypeFilter(""); setDateFrom(""); setDateTo(""); }}
            className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="shrink-0 px-4 pt-3">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 min-h-0">
        <Table<Document>
          bare
          columns={columns}
          rows={displayRows}
          rowKey={(doc) => doc.id}
          initialLoading={initialLoading}
          loading={loading}
          gridTemplateColumns={gridTemplateColumns}
          emptyMessage={
            tab === "active" ? "No active documents." :
            tab === "done"   ? "No completed documents yet." :
            hasFilters       ? "No documents match your filters." :
            "No workflow documents found."
          }
          onRowClick={(doc) => navigate(`/documents/${doc.id}`, { state: { from: "/documents/all" } })}
          hasMore={tab !== "active" && hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
        />
      </div>
    </PageFrame>
  );
}
