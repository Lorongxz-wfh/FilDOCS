import React, { useState } from "react";
import PageFrame from "../components/layout/PageFrame.tsx";
import Table, { type TableColumn } from "../components/ui/Table";
import { listDocumentRequestInbox, listDocumentRequests, listDocumentRequestIndividual, deleteDocumentRequest, type DocumentRequestProgress } from "../services/documentRequests";
import { listOffices } from "../services/documents";
import { useNavigate, useLocation } from "react-router-dom";
import { getAuthUser } from "../lib/auth.ts";
import { getUserRole } from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import CreateDocumentRequestModal from "../components/documentRequests/CreateDocumentRequestModal";
import axios from "../services/api";
import {
  LayoutList,
  TableProperties,
  Users,
  FileStack,
  Trash2,
  FileSearch,
  CheckSquare,
  Download,
} from "lucide-react";
import { Tabs } from "../components/ui/Tabs";
import { TabBar as SubTabBar } from "../components/documentRequests/shared";
import DeletedItemsView from "../components/admin/DeletedItemsView";
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
import { useBulkActions } from "../hooks/useBulkActions";
import BulkActionBar from "../components/ui/BulkActionBar";
import BulkDownloadModal from "../components/ui/BulkDownloadModal";

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

const ProgressBar: React.FC<{ progress: DocumentRequestProgress | undefined | null }> = ({
  progress,
}) => {
  if (!progress) return null;
  const { total, submitted, accepted } = progress;
  if (total === 0) return null;
  const submittedPct = Math.round((submitted / total) * 100);
  const acceptedPct = Math.round((accepted / total) * 100);
  return (
    <div className="flex items-center gap-3 min-w-0 pr-2">
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

export default function DocumentRequestListPage() {
  const me = getAuthUser();
  const role = roleLower(me);
  const adminDebugMode = useAdminDebugMode();
  const { push } = useToast();

  const isAdminUser = getUserRole() === "ADMIN" || getUserRole() === "SYSADMIN";
  const [activeTab, setActiveTab] = React.useState<"active" | "deleted">("active");

  const isQaAdmin =
    ["qa", "sysadmin"].includes(role) || (role === "admin" && adminDebugMode);

  const canCreate =
    role !== "auditor" &&
    (role !== "admin" || adminDebugMode || import.meta.env.DEV);

  const [tab, setTab] = React.useState<ViewTab>("batches");
  const [q, setQ] = React.useState("");
  const [batchStatus, setBatchStatus] = React.useState<string>("");
  const [itemStatus, setItemStatus] = React.useState<
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
    if (batchStatus) count++;
    if (itemStatus) count++;
    if (direction !== "all") count++;
    if (officeFilter) count++;
    return count;
  }, [batchStatus, itemStatus, direction, officeFilter]);

  const [rows, setRows] = React.useState<any[]>([]);
  const [page, setPage] = React.useState(1);
  const [hasMore, setHasMore] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [initialLoading, setInitialLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const qDebounced = useDebouncedValue(q, 400);
  const navigate = useNavigate();

  const handleSort = (key: string, dir: "asc" | "desc") => {
    setSortBy(key);
    setSortDir(dir);
    setPage(1);
  };

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

  const {
    selectedIds,
    isSelectMode,
    setIsSelectMode,
    toggleRow,
    toggleAll,
    clearSelection,
    selectionCount,
    getActionableCount,
  } = useBulkActions<any>(
    rows,
    (r) => r.request_id || r.id || r.recipient_id,
    (_r, action) => {
      if (action === "delete") return isAdminUser || adminDebugMode;
      return true;
    }
  );

  const [bulkDownloadOpen, setBulkDownloadOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${ids.length} requests?`)) return;

    setIsBulkProcessing(true);
    try {
      const res = await axios.post("/bulk/documents/delete", { ids, type: 'requests' });
      push({ type: "success", title: "Bulk Delete", message: res.data.message });
      setRows(prev => prev.filter(r => !ids.includes(r.request_id || r.id)));
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Bulk Delete Failed", message: e.message });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDownload = async (filename: string) => {
    const ids = Array.from(selectedIds).join(",");
    try {
      const res = await axios.get(`/bulk/documents/download?ids=${ids}&type=requests&filename=${filename}`, {
        responseType: "blob"
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename.endsWith('.zip') ? filename : `${filename}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      push({ type: "success", title: "Download Started", message: "Your batch export is being prepared." });
      setBulkDownloadOpen(false);
      clearSelection();
      setIsSelectMode(false);
    } catch (e: any) {
      push({ type: "error", title: "Download Failed", message: e.message });
    }
  };

  const hasMoreRef = React.useRef(true);
  const firstIdRef = React.useRef<number | null>(null);

  const loadData = React.useCallback(async (isNextPage = false, silent = false) => {
    const targetPage = isNextPage ? page + 1 : 1;

    if (!isNextPage && !silent) {
      setInitialLoading(true);
      hasMoreRef.current = true;
      setRows([]);
    }

    if (!hasMoreRef.current && isNextPage) return;
    if (!silent) setLoading(true);
    setError(null);

    try {
      const baseParams = {
        q: qDebounced.trim() || undefined,
        per_page: 10,
        page: targetPage,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      let data: any;

      const params = {
        ...baseParams,
        status: tab === "batches" ? (batchStatus || undefined) : (itemStatus || undefined),
        direction: direction !== "all" ? direction : undefined,
        office_id: officeFilter ? Number(officeFilter) : undefined,
      };

      if (tab === "all") {
        data = await listDocumentRequestIndividual({
          ...params,
          request_status: batchStatus || undefined,
          status: itemStatus || undefined,
        });
      } else {
        // Batches tab
        if (isQaAdmin || direction === "all" || direction === "outgoing") {
          data = await listDocumentRequests(params);
        } else {
          // Explicitly incoming
          data = await listDocumentRequestInbox(params);
        }
      }

      const incoming = Array.isArray(data?.data) ? data.data : [];
      if (targetPage === 1) {
        setRows(incoming);
        firstIdRef.current = incoming[0]?.request_id || incoming[0]?.id || null;
      } else {
        setRows((prev) => [...prev, ...incoming]);
      }

      const more =
        data?.current_page != null &&
        data?.last_page != null &&
        data.current_page < data.last_page;
      hasMoreRef.current = more;
      setHasMore(more);
      setPage(targetPage);
      return { data: incoming };
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load.");
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [tab, qDebounced, batchStatus, itemStatus, isQaAdmin, sortBy, sortDir, direction, officeFilter, canCreate, page]);

  const { refresh: refreshRequests, isRefreshing } = useSmartRefresh(async () => {
    const prevFirstId = firstIdRef.current;
    const result = await loadData(false, true);
    const newFirstId = result?.data?.[0]?.request_id || result?.data?.[0]?.id || null;
    return { changed: newFirstId !== prevFirstId };
  });

  React.useEffect(() => {
    setRows([]);
    setPage(1);
    setHasMore(true);
    setInitialLoading(true);
  }, [tab, qDebounced, batchStatus, itemStatus, isQaAdmin, sortBy, sortDir, direction, officeFilter]);

  React.useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, qDebounced, batchStatus, itemStatus, isQaAdmin, sortBy, sortDir, direction, officeFilter, activeTab]);

  React.useEffect(() => {
    listOffices().then((res) => {
      const sorted = (res || []).sort((a: any, b: any) => (a.code || a.name || "").localeCompare(b.code || b.name || ""));
      setOffices(sorted);
    });
  }, []);

  function handleBatchRowClick(row: any) {
    if (isQaAdmin || row.mode === "multi_doc") {
      navigate(`/document-requests/${row.id}`);
    } else {
      navigate(`/document-requests/${row.id}/recipients/${row.recipient_id}`);
    }
  }

  const batchColumns: TableColumn<any>[] = React.useMemo(() => {
    const cols: TableColumn<any>[] = [
      {
        key: "id",
        header: "ID",
        sortKey: "id",
        skeletonShape: "narrow",
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
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${row.direction === 'outgoing'
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
        key: "office",
        header: "Source / Target",
        skeletonShape: "narrow",
        render: (r) => {
          const isOutgoing = r.direction === 'outgoing';
          const isMulti = r.mode === 'multi_office' && isOutgoing && String(r.office_code || r.recipient_offices_code || "").includes(',');

          return (
            <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">
                {isOutgoing ? "To" : "From"}
              </span>
              <span className="text-xs font-bold text-brand-600 dark:text-brand-400 truncate max-w-35">
                {isMulti ? "Multiple Offices" : (r.office_code || r.office?.code || r.creator_office_code || "—")}
              </span>
              {isMulti && (
                <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate mt-0.5 uppercase tracking-wide">
                  {(r.office_code || r.recipient_offices_code || "").split(',').length} recipients
                </span>
              )}
            </div>
          );
        },
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

  const REQ_TABS = [
    { key: "batches", label: "Request Batches", icon: <LayoutList className="h-3.5 w-3.5" /> },
    { key: "all", label: "All Requests", icon: <TableProperties className="h-3.5 w-3.5" /> },
  ];

  const allColumns: TableColumn<any>[] = React.useMemo(() => {
    return [
      {
        key: "id",
        header: "ID",
        sortKey: "id",
        skeletonShape: "narrow",
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
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${r.direction === 'outgoing'
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
            <span className="text-[10px] text-slate-500 dark:text-slate-500 truncate max-w-30]">
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
    ];
  }, []);

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
      {isAdminUser && adminDebugMode && (
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-1 mb-px">
          <SubTabBar
            tabs={[
              { value: "active", label: "Active Requests", icon: <FileSearch size={12} /> },
              { value: "deleted", label: "Deleted", icon: <Trash2 size={12} /> },
            ]}
            active={activeTab}
            onChange={(val: any) => setActiveTab(val)}
          />
        </div>
      )}

      {activeTab === "deleted" ? (
        <div className="flex-1 min-h-0">
          <DeletedItemsView type="requests" onRestored={() => setActiveTab("active")} />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shrink-0 pr-4">
            <Tabs
              tabs={REQ_TABS}
              activeTab={tab}
              onChange={(key) => {
                setIsSelectMode(false);
                clearSelection();
                if (key === "batches") {
                  setTab("batches");
                  setQ("");
                  setBatchStatus("");
                  setItemStatus("");
                  setDirection("all");
                  setOfficeFilter("");
                } else {
                  setTab("all");
                  setBatchStatus("");
                  setItemStatus("");
                }
              }}
              id="requests"
              className="border-none"
            />
            {activeTab === "active" && (
              <Button
                variant={isSelectMode ? "primary" : "ghost"}
                size="sm"
                onClick={() => {
                  setIsSelectMode(!isSelectMode);
                  if (isSelectMode) clearSelection();
                }}
                className="flex items-center gap-2 h-8"
              >
                <CheckSquare size={14} />
                <span>{isSelectMode ? "Cancel" : "Select"}</span>
              </Button>
            )}
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
              setBatchStatus("");
              setItemStatus("");
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
                      searchable={true}
                      className="w-full"
                      options={[
                        { value: "all", label: "All directions" },
                        { value: "incoming", label: "Incoming" },
                        { value: "outgoing", label: "Outgoing" },
                      ]}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Office</label>
                    <SelectDropdown
                      value={officeFilter}
                      onChange={(val) => {
                        setOfficeFilter(val as any);
                        setPage(1);
                      }}
                      searchable={true}
                      placeholder="All offices"
                      className="w-full"
                      options={[
                        { value: "", label: "All offices" },
                        ...offices.map((o) => ({ value: o.id, label: `${o.code} - ${o.name}` })),
                      ].sort((a, b) => a.label === "All offices" ? -1 : b.label === "All offices" ? 1 : a.label.localeCompare(b.label))}
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 col-span-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Status</label>
                    <SelectDropdown
                      value={tab === "batches" ? batchStatus : itemStatus}
                      onChange={(val) => {
                        if (tab === "batches") setBatchStatus(val as any);
                        else setItemStatus(val as any);
                        setPage(1);
                      }}
                      searchable={true}
                      placeholder="All statuses"
                      className="w-full"
                      options={
                        tab === "batches"
                          ? [
                            { value: "", label: "All statuses" },
                            { value: "open", label: "Open" },
                            { value: "closed", label: "Closed" },
                            { value: "cancelled", label: "Cancelled" },
                          ].sort((a, b) => a.label === "All statuses" ? -1 : b.label === "All statuses" ? 1 : a.label.localeCompare(b.label))
                          : [
                            { value: "", label: "All statuses" },
                            { value: "pending", label: "Pending" },
                            { value: "submitted", label: "Submitted" },
                            { value: "accepted", label: "Accepted" },
                            { value: "rejected", label: "Rejected" },
                          ].sort((a, b) => a.label === "All statuses" ? -1 : b.label === "All statuses" ? 1 : a.label.localeCompare(b.label))
                      }
                    />
                  </div>
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
              searchable={true}
              className="w-40"
              options={[
                { value: "all", label: "All directions" },
                { value: "incoming", label: "Incoming" },
                { value: "outgoing", label: "Outgoing" },
              ]}
            />

            <SelectDropdown
              value={officeFilter}
              onChange={(val) => {
                setOfficeFilter(val as any);
                setPage(1);
              }}
              searchable={true}
              placeholder="All Offices"
              className="w-48"
              options={[
                { value: "", label: "All Offices" },
                ...offices.map((o) => ({ value: o.id, label: `${o.code} - ${o.name}` })),
              ].sort((a, b) => a.label === "All Offices" ? -1 : b.label === "All Offices" ? 1 : a.label.localeCompare(b.label))}
            />

            <SelectDropdown
              value={tab === "batches" ? batchStatus : itemStatus}
              onChange={(val) => {
                if (tab === "batches") setBatchStatus(val as any);
                else setItemStatus(val as any);
                setPage(1);
              }}
              searchable={true}
              placeholder="Status"
              className="w-40"
              options={
                tab === "batches"
                  ? [
                    { value: "", label: "All Status" },
                    { value: "open", label: "Open" },
                    { value: "closed", label: "Closed" },
                    { value: "cancelled", label: "Cancelled" },
                  ].sort((a, b) => a.label === "All Status" ? -1 : b.label === "All Status" ? 1 : a.label.localeCompare(b.label))
                  : [
                    { value: "", label: "All Status" },
                    { value: "pending", label: "Pending" },
                    { value: "submitted", label: "Submitted" },
                    { value: "accepted", label: "Accepted" },
                    { value: "rejected", label: "Rejected" },
                  ].sort((a, b) => a.label === "All Status" ? -1 : b.label === "All Status" ? 1 : a.label.localeCompare(b.label))
              }
            />
          </SearchFilterBar>

          {error && !loading && <Alert variant="danger" className="mt-4 mx-4">{error}</Alert>}

          <div className="flex-1 min-h-0 min-w-0 flex flex-col">
            <AnimatePresence mode="wait">
              <motion.div
                key={tab + qDebounced + batchStatus + itemStatus}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-h-0 rounded-sm border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden"
              >
                {tab === "batches" ? (
                  <Table<any>
                    bare
                    className="h-full"
                    columns={batchColumns}
                    rows={rows}
                    rowKey={(r: any, idx) => r.id || `batch-${idx}`}
                    onRowClick={handleBatchRowClick}
                    loading={loading}
                    initialLoading={initialLoading}
                    emptyMessage={q || batchStatus ? "No requests match your filters." : "No requests found."}
                    hasMore={hasMore}
                    onLoadMore={() => setPage((p) => p + 1)}
                    gridTemplateColumns={adminDebugMode ? "50px 80px 90px minmax(150px, 1fr) 140px 90px 75px 95px 40px" : "50px 80px 90px minmax(150px, 1fr) 140px 90px 75px 95px"}
                    selectable={isSelectMode}
                    selectedIds={selectedIds}
                    onToggleRow={toggleRow}
                    onToggleAll={toggleAll}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortChange={handleSort}
                  />
                ) : (
                  <Table<any>
                    bare
                    className="h-full"
                    columns={allColumns}
                    rows={rows}
                    rowKey={(r: any, idx) => r.recipient_id || r.item_id || `indiv-${idx}`}
                    onRowClick={(r) => {
                      if (r.row_type === "item") {
                        navigate(`/document-requests/${r.request_id}/items/${r.item_id}`);
                      } else {
                        navigate(`/document-requests/${r.request_id}/recipients/${r.recipient_id}`);
                      }
                    }}
                    loading={loading}
                    initialLoading={initialLoading}
                    emptyMessage="No individual requests found."
                    hasMore={hasMore}
                    onLoadMore={() => setPage((p) => p + 1)}
                    gridTemplateColumns="50px 80px minmax(180px, 1fr) 80px 85px 100px 110px"
                    selectable={isSelectMode}
                    selectedIds={selectedIds}
                    onToggleRow={toggleRow}
                    onToggleAll={toggleAll}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortChange={handleSort}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </>
      )}

      <CreateDocumentRequestModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      // onCreated={() => refreshRequests()}
      />

      <Modal
        open={deletingId !== null}
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
          Are you sure you want to delete this request batch? This action is reversible by admins in dev mode.
        </p>
      </Modal>

      <BulkActionBar
        selectedCount={selectionCount}
        onClear={clearSelection}
        actions={[
          {
            label: "Download",
            icon: <Download size={14} />,
            onClick: () => setBulkDownloadOpen(true),
            variant: "secondary",
            count: selectionCount
          },
          {
            label: "Delete",
            icon: <Trash2 size={14} />,
            onClick: handleBulkDelete,
            variant: "danger",
            count: getActionableCount("delete"),
            loading: isBulkProcessing
          }
        ]}
      />

      <BulkDownloadModal
        open={bulkDownloadOpen}
        onClose={() => setBulkDownloadOpen(false)}
        selectedCount={selectionCount}
        onConfirm={handleBulkDownload}
        defaultPrefix="Request_Exports"
      />
    </PageFrame>
  );
}
