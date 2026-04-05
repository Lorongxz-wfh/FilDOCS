import React from "react";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import PageFrame from "../components/layout/PageFrame.tsx";
import Table, { type TableColumn } from "../components/ui/Table";
import {
  listDocumentRequestInbox,
  listDocumentRequests,
  listDocumentRequestIndividual,
  deleteDocumentRequest,
  type DocumentRequestProgress,
} from "../services/documentRequests";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth.ts";
import CreateDocumentRequestModal from "../components/documentRequests/CreateDocumentRequestModal";
import api from "../services/api";
import {
  LayoutList,
  TableProperties,
  Users,
  FileStack,
  Trash2,
} from "lucide-react";
import { Tabs } from "../components/ui/Tabs";
import { PageActions, CreateAction, RefreshAction } from "../components/ui/PageActions";
import { formatDate } from "../utils/formatters";
import MiddleTruncate from "../components/ui/MiddleTruncate";
import { StatusBadge, TypePill } from "../components/ui/Badge";
import Alert from "../components/ui/Alert";
import SearchFilterBar from "../components/ui/SearchFilterBar";
import SelectDropdown from "../components/ui/SelectDropdown";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "../components/ui/toast/ToastContext";
import Modal from "../components/ui/Modal";
import Button from "../components/ui/Button";


type ViewTab = "batches" | "all";

function roleLower(me: any) {
  const raw =
    (typeof me?.role === "string" ? me?.role : me?.role?.name) ??
    me?.role_name ??
    "";
  return String(raw).trim().toLowerCase();
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}

// ── 3-layer progress bar ───────────────────────────────────────────────────
const ProgressBar: React.FC<{ progress: DocumentRequestProgress | undefined | null }> = ({
  progress,
}) => {
  if (!progress) return null;
  const { total, submitted, accepted } = progress;
  if (total === 0) return null;
  const submittedPct = Math.round((submitted / total) * 100);
  const acceptedPct = Math.round((accepted / total) * 100);
  return (
    <div className="flex items-center gap-3 min-w-0 pr-4">
      <div className="relative flex-1 h-2 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden shadow-inner">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-sky-200 dark:bg-sky-700/50 transition-all duration-500"
          style={{ width: `${submittedPct}%` }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-500 dark:bg-brand-400 transition-all duration-500 shadow-sm"
          style={{ width: `${acceptedPct}%` }}
        />
      </div>
      <span className="shrink-0 text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums w-12 text-right">
        {total > 0 ? Math.round((accepted / total) * 100) : 0}%
      </span>
    </div>
  );
};

// ── Mode badge ─────────────────────────────────────────────────────────────
function ModeBadge({ mode }: { mode: string }) {
  const isMultiDoc = mode === "multi_doc";
  return (
    <TypePill
      label={isMultiDoc ? "Multi-doc" : "Multi-office"}
      icon={
        isMultiDoc ? (
          <FileStack className="h-2.5 w-2.5" />
        ) : (
          <Users className="h-2.5 w-2.5" />
        )
      }
    />
  );
}

// ── Reusable Cells ────────────────────────────────────────────────────────────

function NormalText({ children, secondary = false }: { children: React.ReactNode; secondary?: boolean }) {
  return (
    <span className={`text-xs ${secondary ? "text-slate-500 dark:text-slate-400" : "font-medium text-slate-700 dark:text-slate-300"}`}>
      {children || "—"}
    </span>
  );
}

function TypeText({ type }: { type: string }) {
  return (
    <span className="text-xs text-slate-500 dark:text-slate-400 capitalize">
      {type?.toLowerCase() || "—"}
    </span>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DocumentRequestListPage() {
  const me = getAuthUser();
  const role = roleLower(me);
  const adminDebugMode = useAdminDebugMode();
  const { push } = useToast();
  const isQaAdmin =
    ["qa", "sysadmin"].includes(role) || (role === "admin" && adminDebugMode);
  
  const canCreate =
    role !== "auditor" &&
    (role !== "admin" || adminDebugMode || import.meta.env.DEV);

  const [tab, setTab] = React.useState<ViewTab>("batches");
  const [q, setQ] = React.useState("");
  const [status, setStatus] = React.useState<
    "" | "open" | "closed" | "cancelled"
  >("");
  const [recipientStatus, setRecipientStatus] = React.useState<
    "" | "pending" | "submitted" | "accepted" | "rejected"
  >("");
  const [officeFilter, setOfficeFilter] = React.useState<number | "">("");
  const [offices, setOffices] = React.useState<any[]>([]);
  const location = useLocation();
  const [createOpen, setCreateOpen] = React.useState(
    () => (location.state as any)?.openModal === true,
  );
  const [direction, setDirection] = React.useState<"all" | "incoming" | "outgoing">("all");
  const [sortBy, setSortBy] = React.useState<string>("created_at");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (status) count++;
    if (recipientStatus) count++;
    if (direction !== "all") count++;
    if (officeFilter) count++;
    return count;
  }, [status, recipientStatus, direction, officeFilter]);

  const [rows, setRows] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const qDebounced = useDebouncedValue(q, 400);
  const navigate = useNavigate();

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      await deleteDocumentRequest(deletingId);
      push({ type: "success", title: "Deleted", message: "Document Request has been soft-deleted." });
      setRows(prev => prev.filter(r => (r.request_id || r.id) !== deletingId));
      setDeletingId(null);
    } catch (e: any) {
      push({ type: "error", title: "Delete failed", message: e.message });
    } finally {
      setIsDeleting(false);
    }
  };

  const loadData = React.useCallback(async (pageNum: number, silent = false) => {
    if (!silent) setInitialLoading(true);
    setLoading(true);
    setError(null);
    try {
      const baseParams = {
        q: qDebounced.trim() || undefined,
        per_page: 10,
        page: pageNum,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      let data: any;

      if (tab === "all") {
        data = await listDocumentRequestIndividual({
          ...baseParams,
          request_status: isQaAdmin ? status || undefined : undefined,
          status: recipientStatus || undefined,
          direction: direction !== "all" ? direction : undefined,
          office_id: officeFilter ? Number(officeFilter) : undefined,
        });
      } else if (isQaAdmin) {
        data = await listDocumentRequests({
          ...baseParams,
          status: status || undefined,
          direction: direction !== "all" ? direction : undefined,
          office_id: officeFilter ? Number(officeFilter) : undefined,
        });
      } else if (direction === "outgoing") {
        data = await listDocumentRequests({
          ...baseParams,
          status: status || undefined,
          direction: "outgoing",
        });
      } else if (direction === "incoming") {
        data = await listDocumentRequestInbox({
          ...baseParams,
          direction: "incoming",
        });
      } else {
        data = canCreate ? await listDocumentRequests(baseParams) : await listDocumentRequestInbox(baseParams);
      }

      const incoming = Array.isArray(data?.data) ? data.data : [];
      setRows((prev) => (pageNum === 1 ? incoming : [...prev, ...incoming]));
      const more =
        data?.current_page != null &&
        data?.last_page != null &&
        data.current_page < data.last_page;
      setHasMore(more);
      return { data: incoming, changed: true };
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [tab, qDebounced, status, recipientStatus, isQaAdmin, sortBy, sortDir, direction, officeFilter, canCreate]);

  const { refresh: refreshRequests, isRefreshing } = useSmartRefresh(async () => {
    const result = await loadData(1, true);
    return { changed: !!result?.data?.length };
  });

  React.useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [tab, qDebounced, status, recipientStatus, isQaAdmin, sortBy, sortDir, direction, officeFilter]);

  React.useEffect(() => {
    loadData(page, rows.length > 0);
  }, [page, tab, qDebounced, status, recipientStatus, isQaAdmin, sortBy, sortDir, direction, officeFilter]);

  React.useEffect(() => {
    if (isQaAdmin) {
      api.get("/document-requests/active-offices").then((res) => {
        setOffices(res.data || []);
      });
    }
  }, [isQaAdmin]);

  function handleBatchRowClick(row: any) {
    if (isQaAdmin || row.mode === "multi_doc") {
      navigate(`/document-requests/${row.id}`);
    } else {
      navigate(`/document-requests/${row.id}/recipients/${row.recipient_id}`);
    }
  }

  function handleRecipientRowClick(row: any) {
    if (row.row_type === "item") {
      navigate(`/document-requests/${row.request_id}/items/${row.item_id}`);
    } else {
      navigate(
        `/document-requests/${row.request_id}/recipients/${row.recipient_id}`,
      );
    }
  }

  const batchColumns: TableColumn<any>[] = React.useMemo(() => {
    const cols: TableColumn<any>[] = [
      {
        key: "id",
        header: "ID",
        skeletonShape: "narrow",
        align: "center",
        render: (row) => (
          <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
            #{row.id}
          </span>
        ),
      },
      {
        key: "direction",
        header: "Direction",
        skeletonShape: "narrow",
        render: (row) => (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            row.direction === 'outgoing' 
              ? "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400" 
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          }`}>
            {row.direction || 'outgoing'}
          </span>
        ),
      },
      {
        key: "mode",
        header: "Batch Type",
        skeletonShape: "narrow",
        render: (row) => <ModeBadge mode={row.mode} />,
      },
      {
        key: "title",
        header: "Batch Request",
        sortKey: "title",
        skeletonShape: "text",
        render: (row) => (
          <div className="min-w-0 pr-4">
            <MiddleTruncate
              text={row.title}
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
            />
          </div>
        ),
      },
      {
        key: "office",
        header: "Source / Target",
        skeletonShape: "narrow",
        render: (r) => {
          const isOutgoing = r.direction === 'outgoing';
          const isMulti = r.mode === 'multi_office' && isOutgoing && r.office_code?.includes(',');
          
          return (
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                {isOutgoing ? "To" : "From"}
              </span>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 truncate max-w-[140px]">
                {isMulti ? "Multiple Offices" : r.office_code}
              </span>
              {isMulti && (
                <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate mt-0.5 uppercase tracking-wide">
                  {r.office_code?.split(',').length} recipients
                </span>
              )}
            </div>
          );
        },
      },
      {
        key: "progress",
        header: "Progress",
        skeletonShape: "narrow",
        render: (row) => {
          const displayProgress =
            isQaAdmin || row.mode === "multi_doc"
              ? row.progress
              : {
                total: 1,
                submitted:
                  row.recipient_status === "submitted" ||
                    row.recipient_status === "accepted"
                    ? 1
                    : 0,
                accepted: row.recipient_status === "accepted" ? 1 : 0,
              };
          return <ProgressBar progress={displayProgress} />;
        }
      },
      {
        key: "status",
        header: "Status",
        skeletonShape: "badge",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "dates",
        header: "Deadline",
        sortKey: "due_at",
        skeletonShape: "narrow",
        align: "right",
        render: (row) => (
          <NormalText secondary>
            {row.due_at ? formatDate(row.due_at) : formatDate(row.created_at)}
          </NormalText>
        ),
      },
    ];

    if (adminDebugMode) {
      cols.push({
        key: "actions",
        header: "Action",
        align: "right",
        render: (row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeletingId(row.request_id || row.id);
            }}
            className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            title="Delete Request"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ),
      });
    }

    return cols;
  }, [isQaAdmin, adminDebugMode]);

  const batchGrid = adminDebugMode 
    ? "50px 90px 110px minmax(200px, 1fr) 130px 170px 100px 120px 50px"
    : "50px 90px 110px minmax(200px, 1fr) 130px 170px 100px 120px";

  const allColumns: TableColumn<any>[] = React.useMemo(() => {
    return [
      {
        key: "id",
        header: "ID",
        skeletonShape: "narrow",
        align: "center",
        render: (r) => (
          <span className="text-[10px] font-bold font-mono text-slate-400 dark:text-slate-500">
            #{r.request_id || r.id}
          </span>
        ),
      },
      {
        key: "direction",
        header: "Direction",
        skeletonShape: "narrow",
        render: (r) => (
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
            r.direction === 'outgoing' 
              ? "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400" 
              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
          }`}>
            {r.direction || 'outgoing'}
          </span>
        ),
      },
      {
        key: "title",
        header: "Document Requested",
        sortKey: "title",
        skeletonShape: "text",
        render: (r) => (
          <div className="min-w-0 pr-4">
            <MiddleTruncate
              text={r.item_title ?? r.batch_title}
              className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-brand-500 transition-colors"
            />
            {r.item_title && r.batch_title && (
              <MiddleTruncate
                text={r.batch_title}
                className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5"
              />
            )}
          </div>
        ),
      },
      {
        key: "item_status",
        header: "Status",
        skeletonShape: "badge",
        render: (r) => <StatusBadge status={r.item_status || "Pending"} />,
      },
      {
        key: "mode",
        header: "Batch Type",
        skeletonShape: "narrow",
        render: (r) => <TypeText type={r.batch_mode || "REQUEST"} />,
      },
      {
        key: "office",
        header: "Office",
        skeletonShape: "narrow",
        render: (r) => (
          <div className="flex flex-col">
            <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
              {r.office_code}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate max-w-[120px]">
              {r.office_name}
            </span>
          </div>
        ),
      },
      {
        key: "due",
        header: "Deadline",
        sortKey: "due_at",
        skeletonShape: "narrow",
        align: "right",
        render: (r) => (
          <NormalText secondary>
            {r.due_at ? formatDate(r.due_at) : formatDate(r.created_at)}
          </NormalText>
        ),
      },
      {
        key: "batch_due",
        header: "Batch Deadline",
        sortKey: "batch_due_at",
        skeletonShape: "narrow",
        align: "right",
        render: (r) => (
          <NormalText secondary>
            {r.batch_due_at ? formatDate(r.batch_due_at) : "—"}
          </NormalText>
        ),
      },
    ];
  }, []);

  const gridCols = "50px 90px minmax(150px, 1fr) 90px 90px 110px 130px 130px";

  const REQ_TABS = [
    { key: "batches", label: "Request Batches", icon: <LayoutList className="h-3.5 w-3.5" /> },
    { key: "all", label: "All Requests", icon: <TableProperties className="h-3.5 w-3.5" /> },
  ];

  return (
    <PageFrame
      title="Requests"
      onBack={() => navigate("/work-queue")}
      breadcrumbs={[{ label: "Work Queue", to: "/work-queue" }]}
      right={
        <PageActions>
          <RefreshAction
            onRefresh={refreshRequests}
            loading={isRefreshing}
          />
          {canCreate && (
            <CreateAction
              label="Create request"
              onClick={() => setCreateOpen(true)}
            />
          )}
        </PageActions>
      }
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
    >
      <div className="flex items-center border-b border-slate-200 dark:border-surface-400 shrink-0 overflow-x-auto hide-scrollbar">
        <Tabs 
          tabs={REQ_TABS} 
          activeTab={tab} 
          onChange={(key) => {
            if (key === "batches") {
              setTab("batches");
              setQ("");
              setStatus("");
              setRecipientStatus("");
              setDirection("all");
              setOfficeFilter("");
            } else {
              setTab("all");
              setStatus("");
            }
          }} 
          id="requests" 
          className="border-none"
        />
      </div>

      <SearchFilterBar
        search={q}
        setSearch={(val) => {
          setQ(val);
          setPage(1);
        }}
        placeholder="Search title/description…"
        activeFiltersCount={activeFiltersCount}
        onClear={() => {
          setQ("");
          setStatus("");
          setRecipientStatus("");
          setDirection("all");
          setOfficeFilter("");
          setPage(1);
        }}
        mobileFilters={
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Direction</label>
                <SelectDropdown
                  value={direction}
                  onChange={(val) => {
                    setDirection(val as any);
                    setPage(1);
                  }}
                  className="w-full"
                  options={[
                    { value: "all", label: "All directions" },
                    { value: "incoming", label: "Incoming" },
                    { value: "outgoing", label: "Outgoing" },
                  ]}
                />
              </div>

              {isQaAdmin && (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Office</label>
                  <SelectDropdown
                    value={officeFilter}
                    onChange={(val) => {
                      setOfficeFilter(val as any);
                      setPage(1);
                    }}
                    placeholder="All offices"
                    className="w-full"
                    options={[
                      { value: "", label: "All offices" },
                      ...offices.map((o) => ({ value: o.id, label: `${o.code} - ${o.name}` })),
                    ]}
                  />
                </div>
              )}

              {tab === "batches" && isQaAdmin && (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Batch Progress</label>
                  <SelectDropdown
                    value={status}
                    onChange={(val) => {
                      setStatus(val as any);
                      setPage(1);
                    }}
                    className="w-full"
                    options={[
                      { value: "", label: "All statuses" },
                      { value: "open", label: "Open" },
                      { value: "closed", label: "Closed" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                  />
                </div>
              )}
              
              {tab === "all" && (
                <div className="flex flex-col gap-1.5 col-span-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Item Progress</label>
                  <SelectDropdown
                    value={recipientStatus}
                    onChange={(val) => {
                      setRecipientStatus(val as any);
                      setPage(1);
                    }}
                    className="w-full"
                    options={[
                      { value: "", label: "All progress" },
                      { value: "pending", label: "Pending" },
                      { value: "submitted", label: "Submitted" },
                      { value: "accepted", label: "Accepted" },
                      { value: "rejected", label: "Rejected" },
                      { value: "cancelled", label: "Cancelled" },
                    ]}
                  />
                </div>
              )}
            </div>
          </div>
        }
      >
        <SelectDropdown
          value={direction}
          onChange={(val) => {
            setDirection(val as any);
            setPage(1);
          }}
          className="w-40"
          options={[
            { value: "all", label: "All directions" },
            { value: "incoming", label: "Incoming" },
            { value: "outgoing", label: "Outgoing" },
          ]}
        />

        {isQaAdmin && (
          <SelectDropdown
            value={officeFilter}
            onChange={(val) => {
              setOfficeFilter(val as any);
              setPage(1);
            }}
            placeholder="All Offices"
            className="w-48"
            options={[
              { value: "", label: "All Offices" },
              ...offices.map((o) => ({ value: o.id, label: o.code })),
            ]}
          />
        )}

        {tab === "batches" && isQaAdmin && (
          <SelectDropdown
            value={status}
            onChange={(val) => {
              setStatus(val as any);
              setPage(1);
            }}
            className="w-32"
            options={[
              { value: "", label: "All statuses" },
              { value: "open", label: "Open" },
              { value: "closed", label: "Closed" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        )}

        {tab === "all" && (
          <SelectDropdown
            value={recipientStatus}
            onChange={(val) => {
              setRecipientStatus(val as any);
              setPage(1);
            }}
            className="w-32"
            options={[
              { value: "", label: "All progress" },
              { value: "pending", label: "Pending" },
              { value: "submitted", label: "Submitted" },
              { value: "accepted", label: "Accepted" },
              { value: "rejected", label: "Rejected" },
              { value: "cancelled", label: "Cancelled" },
            ]}
          />
        )}
      </SearchFilterBar>

      {error && !loading && <Alert variant="danger" className="mt-4 mx-4">{error}</Alert>}

      <div className="flex-1 min-h-0 min-w-0 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab + qDebounced + status + recipientStatus}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden"
          >
            {tab === "batches" && (
              <Table<any>
                bare
                className="h-full"
                columns={batchColumns}
                rows={rows}
                rowKey={(r: any, idx) => r.id || `batch-${idx}`}
                onRowClick={handleBatchRowClick}
                loading={loading}
                initialLoading={initialLoading}
                emptyMessage={q || status ? "No requests match your filters." : "No requests found."}
                hasMore={hasMore}
                onLoadMore={() => setPage((p) => p + 1)}
                mobileRender={(r) => (
                  <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-1">
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300">
                          {r.mode || r.batch_mode || "REQUEST"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          r.direction === 'outgoing' 
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                          {r.direction || 'outgoing'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {formatDate(r.due_at || r.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                      {r.title || r.item_title || r.batch_title}
                    </p>
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {r.office_code || r.office_name || "—"}
                      </span>
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                        {r.status || r.item_status || "Open"}
                      </span>
                    </div>
                  </div>
                )}
                gridTemplateColumns={batchGrid}
                sortBy={sortBy}
                sortDir={sortDir as any}
                onSortChange={(key, dir) => {
                  setSortBy(key);
                  setSortDir(dir);
                }}
              />
            )}

            {tab === "all" && (
              <Table<any>
                bare
                className="h-full"
                columns={allColumns}
                rows={rows}
                rowKey={(r: any, idx) => `${r.row_type}-${r.row_id}-${idx}`}
                onRowClick={handleRecipientRowClick}
                loading={loading}
                initialLoading={initialLoading}
                emptyMessage={q || status || recipientStatus ? "No matches found." : "No requests found."}
                hasMore={hasMore}
                onLoadMore={() => setPage((p) => p + 1)}
                mobileRender={(r) => (
                  <div className="px-4 py-3 bg-white dark:bg-surface-500 border-b border-slate-100 dark:border-surface-400">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex gap-1">
                        <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-400">
                          {r.batch_mode || "REQUEST"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          r.direction === 'outgoing' 
                            ? "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" 
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        }`}>
                          {r.direction || 'outgoing'}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {formatDate(r.due_at || r.created_at)}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-0.5">
                      {r.item_title ?? r.batch_title}
                    </p>
                    <div className="flex items-center justify-between gap-2 overflow-hidden">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {r.office_code || r.office_name || "—"}
                      </span>
                      <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 shrink-0">
                        {r.item_status || "Pending"}
                      </span>
                    </div>
                  </div>
                )}
                gridTemplateColumns={gridCols}
                sortBy={sortBy}
                sortDir={sortDir as any}
                onSortChange={(key, dir) => {
                  setSortBy(key);
                  setSortDir(dir);
                }}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <Modal
        open={!!deletingId}
        onClose={() => setDeletingId(null)}
        title="Confirm Deletion"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeletingId(null)}>Cancel</Button>
            <Button variant="danger" loading={isDeleting} onClick={handleDelete}>Delete Request</Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Are you sure you want to delete this document request? This action is reversible by system administrators but will remove the item from all active workspaces.
        </p>
      </Modal>

      <CreateDocumentRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </PageFrame>
  );
}
