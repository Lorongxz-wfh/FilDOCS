import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { useNavigate } from "react-router-dom";
import { listDocumentsPage, type Document } from "../services/documents";
import { getUserRole, isQA, isSysAdmin } from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import PageFrame from "../components/layout/PageFrame";
import Table, { type TableColumn } from "../components/ui/Table";
import Alert from "../components/ui/Alert";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import { formatDate } from "../utils/formatters";
import SelectDropdown from "../components/ui/SelectDropdown";
import DateRangeInput from "../components/ui/DateRangeInput";
import { tabCls } from "../utils/formStyles";
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";

import { StatusBadge } from "../components/ui/Badge";

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
  const [phaseFilter, setPhaseFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<"title" | "created_at" | "code">(
    "created_at",
  );
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (phaseFilter) count++;
    if (officeFilter) count++;
    if (versionFilter) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [phaseFilter, officeFilter, versionFilter, dateFrom, dateTo]);

  const [rows, setRows] = useState<Document[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMoreRef = useRef(true);
  const manualRefreshInProgress = useRef(false);
  const firstDocIdRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const statusParam = tab === "done" ? "Distributed" : undefined;

  // Main data loader
  const loadData = useCallback(async (isNextPage = false) => {
    if (manualRefreshInProgress.current) return;
    
    const targetPage = isNextPage ? page + 1 : 1;
    if (!isNextPage) {
        setInitialLoading(true);
        hasMoreRef.current = true;
    }

    if (!hasMoreRef.current && isNextPage) return;

    setLoading(true);
    setError(null);
    try {
      const res = await listDocumentsPage({
        page: targetPage,
        perPage: 12,
        q: qDebounced.trim() || undefined,
        status: statusParam,
        phase: phaseFilter || undefined,
        owner_office_id: officeFilter ? Number(officeFilter) : undefined,
        version_number: versionFilter ? Number(versionFilter) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });

      const incoming = res.data ?? [];
      if (targetPage === 1) {
        setRows(incoming);
        firstDocIdRef.current = incoming[0]?.id ?? null;
      } else {
        setRows((prev) => [...prev, ...incoming]);
      }
      
      const more =
        res.meta?.current_page != null &&
        res.meta?.last_page != null &&
        res.meta.current_page < res.meta.last_page;
      hasMoreRef.current = more;
      setHasMore(more);
      setPage(targetPage);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load documents.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, statusParam, phaseFilter, officeFilter, versionFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  // Initial load or filter/sort change
  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, phaseFilter, officeFilter, versionFilter, dateFrom, dateTo, sortBy, sortDir]);

  const reload = useCallback(() => {
    loadData(false);
  }, [loadData]);

  const { refreshing } = usePageBurstRefresh(reload);

  const refresh = useCallback(async (): Promise<string | void> => {
    const prevFirstId = firstDocIdRef.current;
    manualRefreshInProgress.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await listDocumentsPage({
        page: 1,
        perPage: 12,
        q: qDebounced.trim() || undefined,
        status: statusParam,
        phase: phaseFilter || undefined,
        owner_office_id: officeFilter ? Number(officeFilter) : undefined,
        version_number: versionFilter ? Number(versionFilter) : undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        sort_by: sortBy,
        sort_dir: sortDir,
      });
      const incoming = res.data ?? [];
      firstDocIdRef.current = incoming[0]?.id ?? null;
      setRows(incoming);
      setPage(1);
      
      const more =
        res.meta?.current_page != null &&
        res.meta?.last_page != null &&
        res.meta.current_page < res.meta.last_page;
      hasMoreRef.current = more;
      setHasMore(more);
      
      setInitialLoading(false);
      if (prevFirstId === null) return;
      return incoming[0]?.id !== prevFirstId
        ? "Documents updated."
        : "Already up to date.";
    } catch (e: any) {
      setError(e?.message ?? "Failed to load documents.");
      throw e;
    } finally {
      setLoading(false);
      manualRefreshInProgress.current = false;
    }
  }, [qDebounced, statusParam, phaseFilter, officeFilter, versionFilter, dateFrom, dateTo, sortBy, sortDir]);

  const displayRows = useMemo(() => {
    if (tab === "active") {
      return rows.filter((d) => !TERMINAL_STATUSES.has(d.status?.toLowerCase() ?? ""));
    }
    return rows;
  }, [rows, tab]);

  const hasFilters = q || phaseFilter || officeFilter || versionFilter || dateFrom || dateTo;

  // Dynamic office options from current row set
  const availableOffices = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
      const off = row.office || row.ownerOffice;
      if (off?.id && (off?.code || off?.name)) map.set(off.id, off.code || off.name);
    });
    return Array.from(map.entries()).map(([id, label]) => ({
      value: id,
      label,
    }));
  }, [rows]);


  // ── Table columns ──────────────────────────────────────────────────────────
  const columns: TableColumn<Document>[] = useMemo(() => {
    const cols: TableColumn<Document>[] = [
      {
        key: "code",
        header: "Code",
        sortKey: "code",
        skeletonShape: "narrow",
        render: (doc) => (
          <span className="font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
            {doc.code || "—"}
          </span>
        ),
      },
      {
        key: "title",
        header: "Document Title",
        skeletonShape: "text",
        sortKey: "title",
        render: (doc) => (
          <div className="min-w-0 pr-4">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-500 transition-colors">
              {doc.title}
            </p>
          </div>
        ),
      },
      {
        key: "status",
        header: "Status",
        skeletonShape: "badge",
        render: (doc) => <StatusBadge status={doc.status} />,
      },
      {
        key: "type",
        header: "Type",
        skeletonShape: "badge",
        render: (doc) => (
          <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
            {doc.doctype || "—"}
          </span>
        ),
      },
    ];

    if (showOffice) {
      cols.push({
        key: "owner",
        header: "Office",
        skeletonShape: "text",
        render: (doc: any) => (
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {doc.office?.code || doc.ownerOffice?.code || "—"}
          </span>
        ),
      });
    }

    cols.push(
      {
        key: "version",
        header: "Ver.",
        skeletonShape: "badge",
        align: "center",
        render: (doc) => (
          <span className="text-xs text-slate-500 dark:text-slate-400">
            v{doc.version_number}
          </span>
        ),
      },
      {
        key: "created",
        header: "Date Created",
        skeletonShape: "narrow",
        sortKey: "created_at",
        align: "right",
        render: (doc) => (
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {formatDate(doc.created_at)}
          </span>
        ),
      },
    );

    return cols;
  }, [showOffice]);

  const gridTemplateColumns = showOffice
    ? "130px 1fr 200px 80px 80px 60px 140px"
    : "130px 1fr 200px 80px 60px 140px";

  return (
    <PageFrame
      title="Workflow Documents"
      onBack={() => navigate("/work-queue")}
      breadcrumbs={[{ label: "Work Queue", to: "/work-queue" }]}
      right={
        <PageActions>
          <RefreshAction
            onRefresh={refresh}
            loading={loading || refreshing}
          />
          {canCreate && (
            <CreateAction
              label="Create document"
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", {
                  state: { fromWorkQueue: true },
                });
              }}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto hide-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={tabCls(tab === t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Filter bar - updated for mobile responsiveness */}
      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search title, code, office..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setQ("");
          setPhaseFilter("");
          setOfficeFilter("");
          setVersionFilter("");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Phase</label>
                <SelectDropdown
                  value={phaseFilter}
                  onChange={(val) => {
                    setPhaseFilter((val as string) || "");
                    setPage(1);
                  }}
                  className="w-full"
                  options={[
                    { value: "", label: "All Phases" },
                    { value: "draft", label: "Draft" },
                    { value: "review", label: "Review" },
                    { value: "approval", label: "Approval" },
                    { value: "finalization", label: "Finalization" },
                    { value: "distributed", label: "Distributed" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Office</label>
                <SelectDropdown
                  value={officeFilter}
                  onChange={(val) => {
                    setOfficeFilter((val as string) || "");
                    setPage(1);
                  }}
                  className="w-full"
                  options={[
                    { value: "", label: "All Offices" },
                    ...availableOffices,
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Version</label>
              <SelectDropdown
                value={versionFilter}
                onChange={(val) => {
                  setVersionFilter((val as string) || "");
                  setPage(1);
                }}
                className="w-full"
                options={[
                  { value: "", label: "All Ver." },
                  ...[0, 1, 2, 3, 4, 5].map((v) => ({
                    value: String(v),
                    label: `v${v}`,
                  })),
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
              <DateRangeInput
                from={dateFrom}
                to={dateTo}
                onFromChange={(val) => {
                  setDateFrom(val);
                  setPage(1);
                }}
                onToChange={(val) => {
                  setDateTo(val);
                  setPage(1);
                }}
              />
            </div>
          </div>
        }
      >
        <SelectDropdown
          value={phaseFilter}
          onChange={(val) => {
            setPhaseFilter((val as string) || "");
            setPage(1);
          }}
          placeholder="All Phases"
          className="w-32"
          options={[
            { value: "", label: "All Phases" },
            { value: "draft", label: "Draft" },
            { value: "review", label: "Review" },
            { value: "approval", label: "Approval" },
            { value: "finalization", label: "Finalization" },
            { value: "distributed", label: "Distributed" },
          ]}
        />

        <SelectDropdown
          value={officeFilter}
          onChange={(val) => {
            setOfficeFilter((val as string) || "");
            setPage(1);
          }}
          placeholder="All Offices"
          className="w-40"
          options={[
            { value: "", label: "All Offices" },
            ...availableOffices,
          ]}
        />

        <SelectDropdown
          value={versionFilter}
          onChange={(val) => {
            setVersionFilter((val as string) || "");
            setPage(1);
          }}
          placeholder="All Ver."
          className="w-24"
          options={[
            { value: "", label: "All Ver." },
            ...[0, 1, 2, 3, 4, 5].map((v) => ({
              value: String(v),
              label: `v${v}`,
            })),
          ]}
        />

        <DateRangeInput
          from={dateFrom}
          to={dateTo}
          onFromChange={(val) => {
            setDateFrom(val);
            setPage(1);
          }}
          onToChange={(val) => {
            setDateTo(val);
            setPage(1);
          }}
        />
      </SearchFilterBar>

      {error && (
        <div className="shrink-0 pb-3">
          <Alert variant="danger">{error}</Alert>
        </div>
      )}

      {/* Table card */}
      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<Document>
          bare
          className="h-full"
          columns={columns}
          rows={displayRows}
          rowKey={(doc) => doc.id}
          initialLoading={initialLoading}
          loading={loading}
          gridTemplateColumns={gridTemplateColumns}
          mobileRender={(doc: any) => (
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                    {doc.doctype || "DOC"}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400">v{doc.version_number}</span>
                </div>
                <span className="text-[10px] text-slate-400 tabular-nums">
                  {formatDate(doc.created_at)}
                </span>
              </div>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                {doc.title}
              </p>
              <div className="flex items-center justify-between gap-2 overflow-hidden">
                <div className="flex items-center gap-2 truncate">
                  {doc.code && <span className="text-[10px] font-mono text-slate-400 shrink-0">{doc.code}</span>}
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {doc.office?.code || doc.ownerOffice?.code || "—"}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                  {doc.status}
                </span>
              </div>
            </div>
          )}
          emptyMessage={
            tab === "active"
              ? "No active documents."
              : tab === "done"
                ? "No completed documents yet."
                : hasFilters
                  ? "No documents match your filters."
                  : "No workflow documents found."
          }
          onRowClick={(doc) =>
            navigate(`/documents/${doc.id}`, {
              state: {
                from: "/documents/all",
                breadcrumbs: [
                  { label: "Work Queue", to: "/work-queue" },
                  { label: "All Documents", to: "/documents/all" },
                ],
              },
            })
          }
          hasMore={tab !== "active" && hasMore}
          onLoadMore={() => loadData(true)}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => {
            setSortBy(key as typeof sortBy);
            setSortDir(dir);
          }}
        />
      </div>
    </PageFrame>
  );
}
