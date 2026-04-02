import { useCallback, useEffect, useMemo, useState } from "react";
import { listDocumentsPage, type Document } from "../services/documents";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { Search, X, SlidersHorizontal } from "lucide-react";
import RefreshButton from "../components/ui/RefreshButton";
import { inputCls } from "../utils/formStyles";
import DateRangeInput from "../components/ui/DateRangeInput";
import Button from "../components/ui/Button";
import Table from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import { formatDate } from "../utils/formatters";
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

  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [dateFrom, dateTo]);

  const [sortBy, setSortBy] = useState<"updated_at" | "created_at" | "title">("updated_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [reloadTick, setReloadTick] = useState(0);

  const archiveColumns = useMemo(() => buildArchiveColumns(), []);
  
  // High density grid matching Created columns logic
  const gridTemplateColumns = "130px minmax(120px, 1fr) 100px 110px 100px 140px";

  const fetchPage = useCallback(
    async (p: number, reset = false) => {
      // Don't skip if initial load wait
      if (loading && !reset) return;
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
    navigate(`/documents/${doc.id}/view`, {
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
      {/* Filter bar - updated for mobile responsiveness */}
      <div className="shrink-0 py-3 flex flex-col gap-3 sm:gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Search title, code…"
              className={`${inputCls} pl-9 pr-8 text-sm`}
            />
            {q && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Button
            type="button"
            variant={isFiltersOpen || activeFiltersCount > 0 ? "primary" : "outline"}
            size="sm"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className="sm:hidden"
          >
            <SlidersHorizontal size={14} />
            <span className="font-bold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-white text-brand-600 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </Button>

          <div className="hidden sm:flex items-center gap-2">
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
                  setPage(1);
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Mobile secondary filters collapsible */}
        {isFiltersOpen && (
          <div className="sm:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
              <DateRangeInput
                from={dateFrom}
                to={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
              />
            </div>

            {(q || dateFrom || dateTo) && (
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => {
                  setQ("");
                  setDateFrom("");
                  setDateTo("");
                  setPage(1);
                }}
                className="w-full font-bold text-rose-500 hover:text-rose-600 dark:text-rose-400"
              >
                Clear all filters
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      {/* Table Container - standardized with rounded-xl and library tokens */}
      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<Document>
          bare
          columns={archiveColumns}
          rows={rows}
          loading={loading}
          initialLoading={initialLoading || (loading && rows.length === 0)}
          emptyMessage={
            q || dateFrom || dateTo
              ? "No archived results match your filters."
              : "No cancelled or superseded documents found."
          }
          rowKey={(doc) => doc.id}
          onRowClick={handleRowClick}
          hasMore={hasMore}
          onLoadMore={() => setPage((p) => p + 1)}
          mobileRender={(doc: any) => (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                    {doc.doctype || "DOC"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {doc.code || "—"}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {formatDate(doc.updated_at)}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                {doc.title}
              </p>
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                  {doc.office?.code || doc.ownerOffice?.code || "—"}
                </span>
                <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wide shrink-0">
                  {doc.status}
                </span>
              </div>
            </div>
          )}
          gridTemplateColumns={gridTemplateColumns}
          className="h-full"
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
