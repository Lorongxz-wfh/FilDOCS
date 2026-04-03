import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listDocumentsPage,
} from "../services/documents";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Table from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import { formatDate } from "../utils/formatters";
import { buildArchiveColumns } from "./documentLibrary/DocumentLibraryColumns";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import SelectDropdown from "../components/ui/SelectDropdown";
import DateRangeInput from "../components/ui/DateRangeInput";

export default function ArchivePage() {
  const navigate = useNavigate();
  
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"created_at" | "title">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  const columns = useMemo(() => buildArchiveColumns(), []);
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
        <PageActions>
          <RefreshAction
            onRefresh={async () => { await loadData(false); }}
            loading={refreshing || loading}
          />
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 h-full"
    >
      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search archive..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setQ("");
          setTypeFilter("ALL");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Type</label>
              <SelectDropdown
                value={typeFilter}
                onChange={(val) => setTypeFilter((val as string) || "ALL")}
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
        }
      >
        <SelectDropdown
          value={typeFilter}
          onChange={(val) => setTypeFilter((val as string) || "ALL")}
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
      </SearchFilterBar>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<any>
          bare
          className="h-full"
          columns={columns}
          rows={rows}
          rowKey={(r, idx) => `archived-${r.id || idx}`}
          loading={loading}
          initialLoading={initialLoading}
          emptyMessage={q || typeFilter !== "ALL" || dateFrom || dateTo ? "No archived documents match your filters." : "No archived documents found."}
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
        />
      </div>
    </PageFrame>
  );
}
