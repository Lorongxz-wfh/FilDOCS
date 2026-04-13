import React, { useCallback, useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  getWorkQueue,
  listActivityLogs,
  getDocumentVersion,
} from "../services/documents";
import {
  listDocumentRequestIndividual,
  listDocumentRequestInbox,
  getDocumentRequestStats,
} from "../services/documentRequests";
import type { WorkQueueItem } from "../services/types";
import type { DocumentRequestStats as ReqStatsType } from "../services/documentRequests";

import {
  getUserRole,
  isQA,
  isOfficeStaff,
  isOfficeHead,
} from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";
import { friendlyEvent } from "../utils/activityFormatters";
import PageFrame from "../components/layout/PageFrame";
import { PageActions, RefreshAction, CreateAction } from "../components/ui/PageActions";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { FileText, ClipboardList, LayoutTemplate } from "lucide-react";
import StatCard from "../components/workQueue/StatCard";
import QueueCard from "../components/workQueue/QueueCard";
import RequestQueueCard from "../components/workQueue/RequestQueueCard";
import SkeletonList from "../components/ui/loader/SkeletonList";
import EmptyState from "../components/ui/EmptyState";

// ── Main page ──────────────────────────────────────────────────────────────

const WorkQueueHubPage: React.FC = () => {
  const navigate = useNavigate();
  const [userRole] = useState(getUserRole());

  const [assignedItems, setAssignedItems] = useState<WorkQueueItem[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<WorkQueueItem[]>([]);
  const [requestItems, setRequestItems] = useState<any[]>([]);
  const [requestStats, setRequestStats] = useState<ReqStatsType | null>(null);


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
  const lastIdsRef = useRef<string>("");
  const lastActivityIdRef = useRef<number | string>(0);

  // ── Load queue + stats + activity ─────────────────────────────────────────
  const loadAll = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [alf_actions, q, r, r_stats] = await Promise.all([
        listActivityLogs({
          scope: isAdmin ? "all" : "office",
          per_page: 10, // Decreased to reduce payload size
          category: "actions",
        }).catch(() => ({ data: [] })),
        getWorkQueue().catch(() => ({ assigned: [], monitoring: [] })),
        (isQaAdmin
          ? listDocumentRequestIndividual({ per_page: 15, status: "open" })
          : listDocumentRequestInbox({ per_page: 15, status: "open" })
        ).catch(() => ({ data: [], total: 0 })),
        getDocumentRequestStats().catch(() => null),
      ]);

      const newAssigned = (q as any)?.assigned ?? [];
      const newActivity = (alf_actions as any)?.data ?? [];

      setRecentActivity(newActivity);
      setAssignedItems(newAssigned);
      setMonitoringItems((q as any)?.monitoring ?? []);
      setRequestItems((r as any)?.data ?? []);
      setRequestStats(r_stats as any);

      // Detect if data actually changed using refs to avoid loop
      const nextIds = newAssigned.map((i: any) => `${i.document.id}-${i.version.id}`).join(',');
      const nextActivityId = newActivity[0]?.id;
      
      const changed = lastIdsRef.current !== nextIds || lastActivityIdRef.current !== nextActivityId;
      
      lastIdsRef.current = nextIds;
      lastActivityIdRef.current = nextActivityId;

      return changed;

    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard data");
      return false;
    } finally {
      setLoading(false);
      setLoadingActivity(false);
    }
  }, [isAdmin, isQaAdmin]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Real-time synchronization ─────────────────────────────────────────────
  useRealtimeUpdates({
    onWorkflowUpdate: () => {
      console.debug("[WorkQueueHub] Workflow update received, refreshing...");
      loadAll(true);
    },
    onWorkspaceChange: () => {
      console.debug("[WorkQueueHub] Workspace update received, refreshing...");
      loadAll(true);
    },
  });


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

  const canCreateRequest =
    userRole !== "AUDITOR" &&
    (userRole !== "ADMIN" || adminDebugMode || import.meta.env.DEV);

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
  const requestActionNeeded = requestStats?.action_required ?? 0;


  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    const changed = await loadAll(true);
    return {
      changed,
      message: changed ? "Work queue synchronized." : "Queue is up to date.",
    };
  });

  return (
    <PageFrame
      title="Work Queue Hub"
      contentClassName="flex flex-col min-h-0 gap-5 h-full overflow-hidden"
      right={
        <PageActions>
          <RefreshAction
            onRefresh={refresh}
            loading={isRefreshing || loading}
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
        <div className="flex flex-col gap-4 min-w-0 lg:flex-[3.5]">
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Active Flows" value={allItems.length} loading={loading} />
              <StatCard label="Action Required" value={actionNeededCount} loading={loading} />
            </div>
          </div>


          <div className="relative flex flex-col flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden min-h-0 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
                  Active Documents
                </h2>
              </div>
              {canCreateDoc && (
                <CreateAction
                  label="Document"
                  onClick={() => {
                    markWorkQueueSession();
                    navigate("/documents/create", {
                      state: { fromWorkQueue: true },
                    });
                  }}
                />
              )}
            </div>

            <div className="flex-1 px-4 pt-4 pb-3 space-y-1.5 overflow-hidden bg-slate-50/20 dark:bg-surface-500/10">
              {loading ? (
                <SkeletonList variant="card" rows={3} />
              ) : sortedItems.length === 0 ? (
                <EmptyState
                  label="No active document workflows"
                  description="All your document tasks have been resolved or forwarded."
                  className="py-10"
                />
              ) : (
                <div className="flex flex-col gap-1.5 focus-within:z-20">
                  {sortedItems.map((item: WorkQueueItem) => (
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
            {!loading && sortedItems.length > 2 && (
              <div className="absolute bottom-[61px] left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-surface-500 via-white/40 dark:via-surface-500/40 to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom View All Button */}
            <div className="shrink-0 flex justify-center py-4 border-t border-slate-50/50 dark:border-surface-400/30">
              <button
                onClick={() => navigate("/documents/all")}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-surface-400 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors uppercase tracking-wider"
              >
                <FileText className="h-3.5 w-3.5" />
                View all documents
              </button>
            </div>
          </div>
        </div>

        {/* Column 2: Requests */}
        <div className="flex flex-col gap-4 min-w-0 lg:flex-[3.5]">
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Active Requests" value={requestStats?.active ?? 0} loading={loading} />
              <StatCard label="Action Required" value={requestActionNeeded} loading={loading} />
            </div>
          </div>


          <div className="relative flex flex-col flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden min-h-0 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
                  Active Requests
                </h2>
              </div>
              {canCreateRequest && (
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

            <div className="flex-1 px-4 pt-4 pb-1 space-y-1.5 overflow-hidden bg-slate-50/20 dark:bg-surface-500/10">
              {loading ? (
                <SkeletonList variant="card" rows={3} />
              ) : requestItems.length === 0 ? (
                <EmptyState
                  label="No open document requests"
                  description="No pending requests found in your queue."
                  className="py-10"
                />
              ) : (
                <div className="flex flex-col gap-1.5 focus-within:z-20">
                  {requestItems.map((item: any) => (
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
            {!loading && requestItems.length > 2 && (
              <div className="absolute bottom-[61px] left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-surface-500 via-white/40 dark:via-surface-500/40 to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom View All Button */}
            <div className="shrink-0 flex justify-center py-4 border-t border-slate-50/50 dark:border-surface-400/30">
              <button
                onClick={() => navigate("/document-requests")}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-surface-400 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors uppercase tracking-wider"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                View all requests
              </button>
            </div>
          </div>
        </div>

        {/* Column 3: Activity */}
        <div className="flex flex-col gap-4 min-w-0 lg:flex-[2]">
          <div className="flex flex-col gap-1.5 shrink-0">
            <div className="flex flex-col">
              <StatCard label="Ongoing Progress" value={allItems.length + (requestStats?.active ?? 0)} loading={loading} />
            </div>
          </div>


          <div className="relative flex flex-col flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden min-h-0 shadow-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
              <div className="flex items-center gap-2">
                <LayoutTemplate className="h-4 w-4 text-slate-400" />
                <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
                  Recent Activity
                </h2>
              </div>
            </div>

            <div className="flex-1 px-3 pt-3 pb-1 overflow-hidden">
              {loadingActivity ? (
                <SkeletonList variant="activity" rows={6} />
              ) : recentActivity.length === 0 ? (
                <EmptyState
                  label="No recent activity"
                  className="py-10"
                />
              ) : (
                <div className="space-y-0.5 focus-within:z-20">
                  {recentActivity.map((l: any, idx) => {
                    const docName = l.document 
                      ? (l.document.code ? `${l.document.code} — ${l.document.title}` : l.document.title)
                      : (l.meta?.filename || l.meta?.original_filename || "System Action");

                    return (
                      <motion.button
                        key={l.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ 
                          duration: 0.3, 
                          delay: idx * 0.05,
                          ease: [0.23, 1, 0.32, 1] 
                        }}
                        whileHover={{ x: 4 }}
                        type="button"
                        onClick={() => openActivity(l)}
                        className="w-full text-left rounded-md px-3 py-2.5 transition-colors hover:bg-slate-50 dark:hover:bg-surface-400 group"
                      >
                        {/* Action - Header */}
                        <p className="text-[12px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-tight group-hover:text-brand-600 dark:group-hover:text-brand-400 transition-colors">
                          {friendlyEvent(l.event)}
                        </p>

                        {/* Doc Context | Time - Subheader */}
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium overflow-hidden">
                          <span className="truncate max-w-[75%]">
                            {docName}
                          </span>
                          <span className="shrink-0 opacity-40">|</span>
                          <span className="tabular-nums whitespace-nowrap opacity-80">
                            {formatWhen(l.created_at)}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fading Edge Mask */}
            {!loadingActivity && recentActivity.length > 3 && (
              <div className="absolute bottom-[61px] left-0 right-0 h-10 bg-gradient-to-t from-white dark:from-surface-500 via-white/40 dark:via-surface-500/40 to-transparent pointer-events-none z-10" />
            )}

            {/* Bottom View All Button */}
            <div className="shrink-0 flex justify-center py-4 border-t border-slate-50/50 dark:border-surface-400/30">
              <button
                onClick={() => navigate("/my-activity")}
                className="flex items-center gap-2 px-4 py-2 rounded-md border border-slate-200 dark:border-surface-400 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors uppercase tracking-wider"
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

export default WorkQueueHubPage;
