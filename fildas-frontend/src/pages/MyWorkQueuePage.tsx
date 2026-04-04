import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDocumentStats,
  getWorkQueue,
  listActivityLogs,
  getDocumentVersion,
} from "../services/documents";
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
import { FileText, ChevronDown, ChevronUp } from "lucide-react";
import StatCard from "../components/workQueue/StatCard";
import QueueCard from "../components/workQueue/QueueCard";
import SkeletonList from "../components/ui/loader/SkeletonList";

// ── Main page ──────────────────────────────────────────────────────────────

const MyWorkQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [userRole] = useState(getUserRole());

  const [assignedItems, setAssignedItems] = useState<WorkQueueItem[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<WorkQueueItem[]>([]);
  const [stats, setStats] = useState<{
    total: number;
    pending: number;
    distributed: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isActivityOpen, setIsActivityOpen] = useState(false);

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

  // ── Load queue + stats + activity ─────────────────────────────────────────
  const loadAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [s, a, q] = await Promise.all([
        getDocumentStats().catch(() => null),
        listActivityLogs({
          scope: isAdmin ? "all" : "mine",
          per_page: 10,
          category: "workflow",
        }).catch(() => ({ data: [] })),
        getWorkQueue().catch(() => ({ assigned: [], monitoring: [] })),
      ]);

      if (s) setStats(s);
      setRecentActivity((a as any)?.data ?? []);
      setAssignedItems((q as any)?.assigned ?? []);
      setMonitoringItems((q as any)?.monitoring ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load work queue");
    } finally {
      setLoading(false);
      setLoadingActivity(false);
    }
  }, [isAdmin]);

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
  const canCreate =
    isQA(userRole) ||
    isOfficeStaff(userRole) ||
    isOfficeHead(userRole) ||
    (isAdmin && adminDebugMode);

  // Combined + filtered lists
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

  return (
    <PageFrame
      title={isAdmin ? "Work Queue" : "My Work Queue"}
      contentClassName="flex flex-col min-h-0 gap-5 h-full overflow-hidden"
      right={
        <PageActions>
          <RefreshAction
            onRefresh={async () => {
              await loadAll();
              return "Dashboard updated.";
            }}
            loading={refreshing || loading}
          />
          <button
            type="button"
            onClick={() => navigate("/documents/all")}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-400 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-300 transition-colors"
          >
            <FileText className="h-3.5 w-3.5" />
            All workflows
          </button>
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
    >
      {/* Error */}
      {error && (
        <div className="shrink-0 rounded-md border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 shrink-0 px-0.5">
        <div className="col-span-2 sm:col-span-1">
          <StatCard
            label="Action Needed"
            value={actionNeededCount}
            loading={loading}
          />
        </div>
        <StatCard
          label="Ongoing"
          value={allItems.length}
          loading={loading}
        />
        <StatCard
          label="Official/Distributed"
          value={stats?.distributed ?? null}
          loading={loading}
        />
      </div>

      {/* Main 2-col layout */}
      <div className="flex gap-4 flex-col lg:flex-row flex-1 min-h-0 overflow-hidden pb-4">
        {/* Queue panel */}
        <div className="flex flex-col flex-[2] rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 sm:py-3.5">
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight uppercase tracking-wider">
                Active workflows
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                Ongoing documents requiring immediate attention or monitoring.
              </p>
            </div>
          </div>

          {/* Queue list container with fading effect */}
          <div className="relative flex flex-col h-[480px] overflow-hidden bg-slate-50/30 dark:bg-surface-500/20">
            <div className="flex-1 px-4 py-4 space-y-1.5 overflow-hidden">
              {loading ? (
                <SkeletonList variant="card" rows={4} />
              ) : (
                <>
                  {sortedItems.slice(0, 5).map((item: WorkQueueItem) => (
                    <QueueCard
                      key={`${item.document.id}-${item.version.id}`}
                      item={item}
                      onClick={openByDocId}
                    />
                  ))}
                </>
              )}
            </div>

            {/* Subtle Fading overlay + Ultra-Minimal Sleek Button */}
            <div className="absolute inset-x-0 bottom-0 pointer-events-none flex flex-col items-center justify-end h-32 bg-gradient-to-t from-white dark:from-surface-500 via-white/80 dark:via-surface-500/80 to-transparent">
              <div className="pb-6 pointer-events-auto">
                <button
                  type="button"
                  onClick={() => navigate("/documents/all")}
                  className="flex items-center gap-2 px-4 py-1.5 border border-slate-300 dark:border-surface-300 bg-white dark:bg-surface-400 rounded-sm text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.15em] shadow-xs hover:bg-slate-50 dark:hover:bg-surface-300 transition-all active:scale-95"
                >
                  <FileText className="h-3 w-3" />
                  Open all workflows
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent activity panel — fixed on desktop */}
        <div className={[
          "flex flex-col lg:w-80 shrink-0 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden transition-all duration-300",
          isActivityOpen ? "max-h-[500px]" : "max-h-12 lg:max-h-none"
        ].join(" ")}>
          <div
            role="button"
            tabIndex={window.innerWidth < 1024 ? 0 : -1}
            onClick={() => {
              if (window.innerWidth < 1024) {
                setIsActivityOpen(!isActivityOpen);
              }
            }}
            onKeyDown={(e) => {
              if (window.innerWidth < 1024 && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setIsActivityOpen(!isActivityOpen);
              }
            }}
            className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-4 py-3 cursor-pointer lg:cursor-default"
          >
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-left uppercase tracking-wider">
                Recent activity
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-left uppercase tracking-tight">
                LATEST SYSTEM ACTIONS
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate("/my-activity", {
                    state: { category: "workflow" },
                  });
                }}
                className="hidden sm:block text-[11px] font-bold text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors uppercase"
              >
                View all →
              </button>
              <div className="lg:hidden">
                {isActivityOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </div>
          </div>

          <div className={[
            "flex-1 overflow-y-auto px-3 py-3 lg:block",
            isActivityOpen ? "block" : "hidden"
          ].join(" ")}>
            {loadingActivity ? (
              <SkeletonList variant="activity" rows={5} />
            ) : recentActivity.length === 0 ? (
              <div className="flex h-full min-h-30 items-center justify-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No workflow activity yet.
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                {recentActivity.slice(0, 8).map((l: any) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => openActivity(l)}
                    className="w-full text-left rounded-md px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-surface-400"
                  >
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {l.label || l.event}
                    </p>
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                        {l.event}
                      </p>
                      <p className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500">
                        {formatWhen(l.created_at)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageFrame>
  );
};

export default MyWorkQueuePage;
