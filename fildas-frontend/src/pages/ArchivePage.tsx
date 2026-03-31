import { useCallback, useEffect, useMemo, useState } from "react";
import { listDocumentsPage, type Document } from "../services/documents";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { Search, X } from "lucide-react";
import RefreshButton from "../components/ui/RefreshButton";
import { inputCls } from "../utils/formStyles";
import DateRangeInput from "../components/ui/DateRangeInput";
import Table from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import { buildArchiveColumns } from "./documentLibrary/DocumentLibraryColumns";

// ── Helpers ─────────────────────────────────────────────────────────────────
function useDebounce(value: string, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function ArchivePage() {
  const navigate = useNavigate();

  const [rows, setRows] = useState<Document[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const qDebounced = useDebounce(q);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  
  const [sortBy, setSortBy] = useState<"updated_at" | "created_at" | "title">("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [reloadTick, setReloadTick] = useState(0);

  const archiveColumns = useMemo(() => buildArchiveColumns(), []);
  
  // Standard grid layout matching the 5 columns defined in buildArchiveColumns
  const gridTemplateColumns = "100px minmax(250px, 2fr) minmax(150px, 1fr) 120px 140px";

  const fetchPage = useCallback(
    async (p: number, reset = false) => {
      // Don't skip if initial load wait
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await listDocumentsPage({
          status: "Cancelled,Superseded",
          q: qDebounced || undefined,
          date_from: dateFrom || undefined,
          date_to: dateTo || undefined,
          page: p,
          perPage: 25,
          sort_by: sortBy,
          sort_dir: sortDir,
        });
        const newRows = res.data ?? [];
        setRows((prev) => (reset ? newRows : [...prev, ...newRows]));
        setHasMore(p < (res.meta?.last_page ?? 1));
      } catch (e: any) {
        setError(e?.response?.data?.message ?? "Failed to load archived documents.");
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [loading, qDebounced, dateFrom, dateTo, sortBy, sortDir],
  );

  // Reset + reload when filters/sort change
  useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
    fetchPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, dateFrom, dateTo, sortBy, sortDir, reloadTick]);

  // Load next page
  useEffect(() => {
    if (page > 1) fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleRowClick = (doc: Document) => {
    navigate(`/documents/${doc.id}`, {
      state: {
        from: "/archive",
        breadcrumbs: [
          { label: "Library", to: "/documents" },
          { label: "Archive", to: "/archive" },
        ],
      },
    });
  };

  return (
    <PageFrame
      title="Archive"
      onBack={() => navigate("/documents")}
      contentClassName="flex flex-col h-full overflow-hidden"
      right={
        <RefreshButton
          onClick={() => setReloadTick((t) => t + 1)}
          loading={loading || initialLoading}
          title="Refresh archive"
        />
      }
    >
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-surface-400 dark:bg-surface-600 px-5 py-3.5 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, code…"
            className={`${inputCls} pl-9 pr-8`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <DateRangeInput
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />
        
        {(q || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDateFrom("");
              setDateTo("");
            }}
            className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
          >
            Clear
          </button>
        )}

      </div>

      <div className="flex-1 min-h-0 flex flex-col pt-0 sm:pt-4">
        {error && <div className="px-5 sm:px-4"><Alert variant="danger" className="mb-4">{error}</Alert></div>}
        <Table<Document>
          columns={archiveColumns}
          rows={rows}
          loading={loading}
          initialLoading={initialLoading || (loading && rows.length === 0)}
          emptyMessage={
            q || dateFrom || dateTo
              ? "No results match your filters."
              : "No cancelled or superseded documents found."
          }
          rowKey={(doc) => doc.id}
          onRowClick={handleRowClick}
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          gridTemplateColumns={gridTemplateColumns}
          className="flex-1 min-h-0"
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as any);
            setSortDir(dir);
          }}
        />
      </div>
    </PageFrame>
  );
}
