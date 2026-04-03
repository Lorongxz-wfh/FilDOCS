import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDocumentsPage,
} from "../services/documents";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Table from "../components/ui/Table";
import Select from "../components/ui/Select";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { inputCls } from "../utils/formStyles";
import Alert from "../components/ui/Alert";
import DateRangeInput from "../components/ui/DateRangeInput";
import RefreshButton from "../components/ui/RefreshButton";
import { formatDate } from "../utils/formatters";
import { buildBaseDocColumns } from "./documentLibrary/DocumentLibraryColumns";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";

export default function ArchivePage() {
  const navigate = useNavigate();
  
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "title">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "ALL") count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [typeFilter, dateFrom, dateTo]);

  // Debounce search
  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadData = useCallback(async (isNextPage = false) => {
    const targetPage = isNextPage ? page + 1 : 1;
    if (!isNextPage) {
      setInitialLoading(true);
      setRows([]);
    }

    setLoading(true);
    setError(null);

    try {
      const res = await listDocumentsPage({
        page: targetPage,
        perPage: 15,
        q: qDebounced.trim() || undefined,
        space: "archive",
        doctype: typeFilter !== "ALL" ? typeFilter : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy === "created_at" ? "created_at" : "title",
        sort_dir: sortDir,
      });

      const incoming = res.data ?? [];
      setRows(prev => targetPage === 1 ? incoming : [...prev, ...incoming]);
      setHasMore((res.meta?.current_page ?? 0) < (res.meta?.last_page ?? 0));
      setPage(targetPage);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load archive.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDebounced, typeFilter, dateFrom, dateTo, sortBy, sortDir]);

  const { refreshing } = usePageBurstRefresh(() => loadData(false));

  const columns = useMemo(() => buildBaseDocColumns(), []);
  const gridTemplate = "130px minmax(120px, 1fr) 100px 110px 70px 140px";

  const handleRowClick = (row: any) => {
    navigate(`/documents/${row.id}/view`, { 
      state: { 
        from: "/archive",
        breadcrumbs: [{ label: "Archive", to: "/archive" }] 
      } 
    });
  };

  return (
    <PageFrame
      title="Archive"
      onBack={() => navigate("/documents")}
      right={
        <RefreshButton
          onRefresh={async () => { await loadData(false); }}
          loading={refreshing || loading}
          title="Refresh archive"
        />
      }
      contentClassName="flex flex-col min-h-0 h-full"
    >
      <div className="shrink-0 py-3 flex flex-col gap-3 sm:gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:max-w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search archive..."
              className={`${inputCls} pl-9 pr-8 text-sm`}
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

          <button
            type="button"
            onClick={() => setIsFiltersOpen(!isFiltersOpen)}
            className={`sm:hidden flex items-center gap-2 px-3 h-9 rounded-lg border transition-all ${isFiltersOpen || activeFiltersCount > 0
                ? "bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400"
                : "bg-white border-slate-200 text-slate-600 dark:bg-surface-500 dark:border-surface-400 dark:text-slate-400"
              }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span className="text-xs font-semibold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-brand-500 text-white rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="hidden sm:flex flex-wrap items-center gap-2 flex-1">
            <Select
              value={typeFilter}
              onChange={(val) => setTypeFilter(val as string)}
              placeholder="All Types"
              className="w-32"
              options={[
                { value: "ALL", label: "All Types" },
                { value: "INTERNAL", label: "Internal" },
                { value: "EXTERNAL", label: "External" },
                { value: "FORMS", label: "Forms" },
              ]}
            />

            <DateRangeInput
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />

            {(q || typeFilter !== "ALL" || dateFrom || dateTo) && (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setTypeFilter("ALL");
                  setDateFrom("");
                  setDateTo("");
                }}
                className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {isFiltersOpen && (
          <div className="sm:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400 animate-in fade-in slide-in-from-top-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
              <Select
                value={typeFilter}
                onChange={(val) => setTypeFilter(val as string)}
                placeholder="All Types"
                className="w-full"
                options={[
                  { value: "ALL", label: "All Types" },
                  { value: "INTERNAL", label: "Internal" },
                  { value: "EXTERNAL", label: "External" },
                  { value: "FORMS", label: "Forms" },
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
              <DateRangeInput
                from={dateFrom}
                to={dateTo}
                onFromChange={setDateFrom}
                onToChange={setDateTo}
              />
            </div>
          </div>
        )}
      </div>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<any>
          bare
          className="h-full"
          columns={columns}
          rows={rows}
          rowKey={(r, idx) => `archived-${r.id || idx}`}
          loading={loading}
          initialLoading={initialLoading}
          onRowClick={handleRowClick}
          hasMore={hasMore}
          onLoadMore={() => loadData(true)}
          gridTemplateColumns={gridTemplate}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as any);
            setSortDir(dir);
          }}
          mobileRender={(r) => (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                  {r.doctype}
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {formatDate(r.created_at)}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                {r.title}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-400">{r.code || "No Code"}</span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">{r.ownerOffice?.code || "—"}</span>
              </div>
            </div>
          )}
          emptyMessage="No documents found in the archive."
        />
      </div>
    </PageFrame>
  );
}
