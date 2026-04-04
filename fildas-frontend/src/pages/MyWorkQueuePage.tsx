import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getWorkQueue,
  listActivityLogs,
  getDocumentVersion,
} from "../services/documents";
import { listDocumentRequestIndividual, listDocumentRequestInbox } from "../services/documentRequests";
import type { WorkQueueItem } from "../services/documents";
import {
  getUserRole,
  isQA,
  isOfficeStaff,
  isOfficeHead,
} from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import PageFrame from "../components/layout/PageFrame";
import { PageActions, RefreshAction, CreateAction } from "../components/ui/PageActions";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { FileText, ClipboardList, LayoutTemplate } from "lucide-react";
import StatCard from "../components/workQueue/StatCard";
import QueueCard from "../components/workQueue/QueueCard";
import RequestQueueCard from "../components/workQueue/RequestQueueCard";
import SkeletonList from "../components/ui/loader/SkeletonList";

// ── Main page ──────────────────────────────────────────────────────────────

const MyWorkQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [userRole] = useState(getUserRole());

  const [assignedItems, setAssignedItems] = useState<WorkQueueItem[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<WorkQueueItem[]>([]);
  const [requestItems, setRequestItems] = useState<any[]>([]);
  const [requestStats, setRequestStats] = useState<{ open: number; total: number } | null>(null);

  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatWhen = (iso?: string | null) => {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  };

  const isAdmin = userRole === "ADMIN" || userRole === "SYSADMIN";
  const isQaAdmin = isQA(userRole) || isAdmin;

  // ── Load queue + stats + activity ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [alf_workflow, alf_request, q, r] = await Promise.all([
        listActivityLogs({
          scope: isAdmin ? "all" : "mine",
          per_page: 8,
          category: "workflow",
        }).catch(() => ({ data: [] })),
        listActivityLogs({
          scope: isAdmin ? "all" : "mine",
          per_page: 8,
          category: "request",
        }).catch(() => ({ data: [] })),
        getWorkQueue().catch(() => ({ assigned: [], monitoring: [] })),
        (isQaAdmin 
          ? listDocumentRequestIndividual({ per_page: 5, request_status: "open" }) 
          : listDocumentRequestInbox({ per_page: 5 })
        ).catch(() => ({ data: [], total: 0 })),
      ]);

      const mergedActivity = [
        ...((alf_workflow as any)?.data ?? []),
        ...((alf_request as any)?.data ?? []),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
       .slice(0, 12);

      setRecentActivity(mergedActivity);
      setAssignedItems((q as any)?.assigned ?? []);
      setMonitoringItems((q as any)?.monitoring ?? []);
      setRequestItems((r as any)?.data ?? []);
      setRequestStats({ open: (r as any)?.total ?? 0, total: (r as any)?.total ?? 0 });
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard data");
    } finally {
      setLoading(false);
      setLoadingActivity(false);
    }
  }, [isAdmin, isQaAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const { refreshing } = usePageBurstRefresh(loadAll);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openByDocId = (docId: number) =>
    navigate(`/documents/${docId}`, { state: { from: "/work-queue" } });

  const openByVersionId = async (versionId: number) => {
    const { document } = await getDocumentVersion(versionId);
    navigate(`/documents/${document.id}`, { state: { from: "/work-queue" } });
  };

  const openActivity = async (l: any) => {
    const verId = Number(l?.document_version_id ?? 0);
    const docId = Number(l?.document_id ?? 0);
    if (verId) return openByVersionId(verId);
    if (docId) return openByDocId(docId);
  };

  const adminDebugMode = useAdminDebugMode();
  const canCreateDoc =
    isQA(userRole) ||
    isOfficeStaff(userRole) ||
    isOfficeHead(userRole) ||
    (isAdmin && adminDebugMode);

  // Combined + filtered Workflow lists
  const allItems = React.useMemo(() => {
    const seen = new Set<string>();
    return [...assignedItems, ...monitoringItems].filter((item) => {
      if (!item?.document?.id || !item?.version?.id) return false;
      const key = `${item.document.id}-${item.version.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [assignedItems, monitoringItems]);

  const sortedItems = [...allItems].sort(
    (a, b) => new Date(b.version.updated_at).getTime() - new Date(a.version.updated_at).getTime()
  );

  const actionNeededCount = allItems.filter(i => i.can_act).length;
  // For requests, actionable depends on the inbox/individual list fetched
  // If QA/Admin, actionable might be a subset, but for this simplified view, we use the inbox total
  const requestActionNeeded = isQaAdmin ? requestItems.filter(r => (r.item_status || r.status) === "Pending").length : requestItems.length;

  return (
    <PageFrame
      title="Work Queue Hub"
      contentClassName="flex flex-col min-h-0 gap-5 h-full overflow-hidden"
      right={
        <PageActions>
          <RefreshAction
            onRefresh={async () => {
              await loadAll();
              return "Hub updated.";
            }}
            loading={refreshing || loading}
          />
        </PageActions>
      }
    >
      {/* Error */}
      {error && (
        <div className="shrink-0 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400 font-medium font-display">
          {error}
        </div>
      )}

      {/* Main Grid Layout (Proportional Columns on LG, Single Column on Mobile) */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0 pb-2 overflow-y-auto lg:overflow-hidden">
        
        {/* Column 1: Workflows */}
        <div className="flex flex-col gap-4 min-h-0 lg:flex-[3.5] shrink-0">
          <div className="flex flex-col gap-1.5 shrink-0">
            <p className="text-[11px] font-display font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] ml-1">Workflow Overview</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Active Flows" value={allItems.length} loading={loading} />
              <StatCard label="Action Required" value={actionNeededCount} loading={loading} />
            </div>
          </div>
          
          <div className="relative flex flex-col flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden min-h-0 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-display font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                  Active Workflows
                </p>
              </div>
              {canCreateDoc && (
                <CreateAction
                  label="Workflow"
                  onClick={() => {
                    markWorkQueueSession();
                    navigate("/documents/create", {
                      state: { fromWorkQueue: true },
                    });
                  }}
                />
              )}
            </div>

            <div className="flex-1 px-4 py-4 space-y-1.5 overflow-hidden bg-slate-50/20 dark:bg-surface-500/10">
              {loading ? (
                <SkeletonList variant="card" rows={3} />
              ) : sortedItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No active document workflows found.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {sortedItems.slice(0, window.innerWidth < 1024 ? 3 : 5).map((item: WorkQueueItem) => (
                    <QueueCard
                      key={`${item.document.id}-${item.version.id}`}
                      item={item}
                      onClick={openByDocId}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fading Edge Mask */}
            {!loading && sortedItems.length > 3 && (
              <div className="absolute bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom View All Button */}
            <div className="shrink-0 flex justify-center p-4 border-t border-slate-50/50 dark:border-surface-400/30">
              <button 
                onClick={() => navigate("/documents/all")}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-surface-400 text-[10px] font-display font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors uppercase tracking-[0.1em]"
              >
                <FileText className="h-3.5 w-3.5" />
                View all workflows
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Requests */}
        <div className="flex flex-col gap-4 min-h-0 lg:flex-[3.5] shrink-0">
          <div className="flex flex-col gap-1.5 shrink-0">
            <p className="text-[11px] font-display font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] ml-1">Requests Overview</p>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Active Requests" value={requestStats?.open ?? 0} loading={loading} />
              <StatCard label="Action Required" value={requestActionNeeded} loading={loading} />
            </div>
          </div>

          <div className="relative flex flex-col flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden min-h-0 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-display font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                  Active Requests
                </p>
              </div>
              {canCreateDoc && (
                <CreateAction
                  label="Request"
                  onClick={() => {
                    navigate("/document-requests", {
                      state: { openModal: true },
                    });
                  }}
                />
              )}
            </div>

            <div className="flex-1 px-4 py-4 space-y-1.5 overflow-hidden bg-slate-50/20 dark:bg-surface-500/10">
              {loading ? (
                <SkeletonList variant="card" rows={3} />
              ) : requestItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No open document requests found.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {requestItems.slice(0, window.innerWidth < 1024 ? 3 : 5).map((item: any) => (
                    <RequestQueueCard
                      key={item.id || item.request_id}
                      item={item}
                      onClick={(id) => navigate(`/document-requests/${id}`)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Fading Edge Mask */}
            {!loading && requestItems.length > 3 && (
              <div className="absolute bottom-16 left-0 right-0 h-16 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom View All Button */}
            <div className="shrink-0 flex justify-center p-4 border-t border-slate-50/50 dark:border-surface-400/30">
              <button 
                onClick={() => navigate("/document-requests")}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-surface-400 text-[10px] font-display font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors uppercase tracking-[0.1em]"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                View all requests
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Activity */}
        <div className="flex flex-col gap-4 min-h-0 lg:flex-[2] shrink-0">
          <div className="flex flex-col gap-1.5 shrink-0">
            <p className="text-[11px] font-display font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-[0.12em] ml-1">System Health</p>
            <div className="flex flex-col">
              <StatCard label="Ongoing Progress" value={allItems.length + (requestStats?.open ?? 0)} loading={loading} />
            </div>
          </div>

          <div className="relative flex flex-col flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden min-h-0 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-display font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                  Recent Activity
                </p>
              </div>
            </div>

            <div className="flex-1 px-3 py-3 overflow-hidden">
              {loadingActivity ? (
                <SkeletonList variant="activity" rows={6} />
              ) : recentActivity.length === 0 ? (
                <div className="flex h-full min-h-30 items-center justify-center">
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    No recent creation/request activity found.
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {recentActivity.slice(0, window.innerWidth < 1024 ? 6 : 8).map((l: any) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => openActivity(l)}
                      className="w-full text-left rounded-md px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-surface-400"
                    >
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate capitalize font-display">
                        {l.label || l.event}
                      </p>
                      <div className="flex items-center justify-between mt-0.5 gap-2">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate lowercase opacity-70">
                          {l.event}
                        </p>
                        <p className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 font-medium tabular-nums font-display">
                          {formatWhen(l.created_at)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Fading Edge Mask */}
            {!loadingActivity && recentActivity.length > 5 && (
              <div className="absolute bottom-16 left-0 right-0 h-24 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom View All Button */}
            <div className="shrink-0 flex justify-center p-4 border-t border-slate-50/50 dark:border-surface-400/30">
              <button 
                onClick={() => navigate("/my-activity")}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-surface-400 text-[10px] font-display font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors uppercase tracking-[0.1em]"
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                View all activity
              </button>
            </div>
          </div>
        </div>
      </div>
    </PageFrame>
  );
};

export default MyWorkQueuePage;
