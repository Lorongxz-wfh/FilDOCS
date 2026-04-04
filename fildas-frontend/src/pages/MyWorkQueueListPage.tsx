import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
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

type WFTab = "all" | "active" | "distributed";

const TABS: { value: WFTab; label: string }[] = [
  { value: "all",         label: "All" },
  { value: "active",      label: "Active" },
  { value: "distributed", label: "Distributed" },
];

const TERMINAL_STATUSES = new Set(["distributed", "cancelled", "superseded"]);

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
  const [sortBy, setSortBy] = useState<"title" | "created_at" | "code" | "updated_at" | "distributed_at">("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [rows, setRows] = useState<Document[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hasMoreRef = useRef(true);
  const firstDocIdRef = useRef<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  const statusParam = tab === "distributed" ? "Distributed" : undefined;

  const loadData = useCallback(async (isNextPage = false, silent = false) => {
    const targetPage = isNextPage ? page + 1 : 1;
    if (!isNextPage && !silent) {
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
      
      const more = res.meta?.current_page < res.meta?.last_page;
      hasMoreRef.current = more;
      setHasMore(more);
      setPage(targetPage);
      return { data: incoming };
    } catch (e: any) {
      setError(e?.message ?? "Failed to load documents.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [qDebounced, statusParam, phaseFilter, officeFilter, versionFilter, dateFrom, dateTo, sortBy, sortDir, page]);

  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    const prevFirstId = firstDocIdRef.current;
    const result = await loadData(false, true);
    const newFirstId = result?.data?.[0]?.id ?? null;
    return { changed: newFirstId !== prevFirstId };
  });

  useEffect(() => {
    loadData(false);
  }, [tab, qDebounced, phaseFilter, officeFilter, versionFilter, dateFrom, dateTo, sortBy, sortDir, loadData]);

  const displayRows = useMemo(() => {
    if (tab === "active") {
      return rows.filter((d) => !TERMINAL_STATUSES.has(d.status?.toLowerCase() ?? ""));
    }
    return rows;
  }, [rows, tab]);

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (phaseFilter) count++;
    if (officeFilter) count++;
    if (versionFilter) count++;
    if (dateFrom) count++;
    if (dateTo) count++;
    return count;
  }, [phaseFilter, officeFilter, versionFilter, dateFrom, dateTo]);

  const availableOffices = useMemo(() => {
    const map = new Map<number, string>();
    rows.forEach((row: any) => {
      const off = row.office || row.ownerOffice;
      if (off?.id && (off?.code || off?.name)) map.set(off.id, off.code || off.name);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ value: id, label }));
  }, [rows]);

  const columns: TableColumn<Document>[] = useMemo(() => {
    const isDistributed = tab === "distributed";
    const cols: TableColumn<Document>[] = [
      {
        key: isDistributed ? "distributed" : "updated",
        header: isDistributed ? "Distributed" : "Last Activity",
        sortKey: isDistributed ? "distributed_at" : "updated_at",
        align: "left",
        render: (doc) => (
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {formatDate(isDistributed ? doc.distributed_at : doc.updated_at)}
          </span>
        ),
      },
      {
        key: "title",
        header: "Name",
        sortKey: "title",
        render: (doc) => <p className="text-sm font-semibold truncate group-hover:text-brand-500">{doc.title}</p>,
      },
      {
        key: "code",
        header: "Code",
        sortKey: "code",
        render: (doc) => <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-50 dark:bg-surface-400/30 px-1.5 py-0.5 rounded-sm border border-slate-100 dark:border-surface-400/50">{doc.code || "—"}</span>,
      },
    ];
    if (!isDistributed) {
      cols.push({
        key: "status",
        header: "Status",
        render: (doc) => <StatusBadge status={doc.status} />,
      });
    }
    if (showOffice) {
      cols.push({
        key: "owner",
        header: "Office",
        render: (doc: any) => <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">{doc.office?.code || doc.ownerOffice?.code || "—"}</span>,
      });
    }
    cols.push(
      {
        key: "version",
        header: "Ver.",
        align: "center",
        render: (doc) => <span className="text-[11px] font-medium text-slate-400">v{doc.version_number}</span>,
      },
      {
        key: "created",
        header: "Date Created",
        sortKey: "created_at",
        align: "right",
        render: (doc) => <span className="text-[11px] font-medium text-slate-400 tabular-nums">{formatDate(doc.created_at)}</span>,
      }
    );
    return cols;
  }, [showOffice, tab]);

  const gridTemplateColumns = showOffice
    ? "110px minmax(200px, 1fr) 110px 120px 90px 60px 110px"
    : "110px minmax(200px, 1fr) 110px 120px 60px 110px";

  return (
    <PageFrame
      title="Workflow Documents"
      onBack={() => navigate("/work-queue")}
      breadcrumbs={[{ label: "Work Queue", to: "/work-queue" }]}
      right={
        <PageActions>
          <RefreshAction onRefresh={refresh} loading={isRefreshing} />
          {canCreate && (
            <CreateAction
              label="Create document"
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", { state: { fromWorkQueue: true } });
              }}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto hide-scrollbar">
        {TABS.map((t) => (
          <button key={t.value} type="button" onClick={() => { setTab(t.value); setPage(1); }} className={tabCls(tab === t.value)}>
            {t.label}
          </button>
        ))}
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => { setQ(val); setPage(1); }}
        placeholder="Search title, code, office..."
        activeFiltersCount={activeFiltersCount}
        onClear={() => { setQ(""); setPhaseFilter(""); setOfficeFilter(""); setVersionFilter(""); setDateFrom(""); setDateTo(""); setPage(1); }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <SelectDropdown
                value={phaseFilter}
                onChange={(val) => { setPhaseFilter((val as string) || ""); setPage(1); }}
                options={[{ value: "", label: "All Phases" }, { value: "draft", label: "Draft" }, { value: "review", label: "Review" }, { value: "approval", label: "Approval" }, { value: "finalization", label: "Finalization" }, { value: "distributed", label: "Distributed" }]}
              />
              <SelectDropdown
                value={officeFilter}
                onChange={(val) => { setOfficeFilter((val as string) || ""); setPage(1); }}
                options={[{ value: "", label: "All Offices" }, ...availableOffices]}
              />
            </div>
            <SelectDropdown
              value={versionFilter}
              onChange={(val) => { setVersionFilter((val as string) || ""); setPage(1); }}
              options={[{ value: "", label: "All Ver." }, ...[0, 1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: `v${v}` }))]}
            />
            <DateRangeInput from={dateFrom} to={dateTo} onFromChange={(val) => { setDateFrom(val); setPage(1); }} onToChange={(val) => { setDateTo(val); setPage(1); }} />
          </div>
        }
      >
        <SelectDropdown value={phaseFilter} onChange={(val) => { setPhaseFilter((val as string) || ""); setPage(1); }} className="w-32" options={[{ value: "", label: "All Phases" }, { value: "draft", label: "Draft" }, { value: "review", label: "Review" }, { value: "approval", label: "Approval" }, { value: "finalization", label: "Finalization" }, { value: "distributed", label: "Distributed" }]} />
        <SelectDropdown value={officeFilter} onChange={(val) => { setOfficeFilter((val as string) || ""); setPage(1); }} className="w-40" options={[{ value: "", label: "All Offices" }, ...availableOffices]} />
        <SelectDropdown value={versionFilter} onChange={(val) => { setVersionFilter((val as string) || ""); setPage(1); }} className="w-24" options={[{ value: "", label: "All Ver." }, ...[0, 1, 2, 3, 4, 5].map((v) => ({ value: String(v), label: `v${v}` }))]} />
        <DateRangeInput from={dateFrom} to={dateTo} onFromChange={(val) => { setDateFrom(val); setPage(1); }} onToChange={(val) => { setDateTo(val); setPage(1); }} />
      </SearchFilterBar>

      {error && <Alert variant="danger" className="mb-4">{error}</Alert>}

      <div className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
        <Table<Document>
          bare
          columns={columns}
          rows={displayRows}
          rowKey={(doc) => doc.id}
          initialLoading={initialLoading}
          loading={loading}
          gridTemplateColumns={gridTemplateColumns}
          onRowClick={(doc) => navigate(`/documents/${doc.id}`, { state: { from: "/documents/all" } })}
          hasMore={tab !== "active" && hasMore}
          onLoadMore={() => loadData(true)}
          sortBy={sortBy}
          sortDir={sortDir}
          onSortChange={(key, dir) => { setSortBy(key as any); setSortDir(dir); }}
        />
      </div>
    </PageFrame>
  );
}
