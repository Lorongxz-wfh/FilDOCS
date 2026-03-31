import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  getDocumentStats,
  getWorkQueue,
  listActivityLogs,
  getDocumentVersion,
  listFinishedDocuments,
  type FinishedDocumentRow,
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
import Button from "../components/ui/Button";
import RefreshButton from "../components/ui/RefreshButton";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { CheckCircle2, Search, X, FileText, PlusCircle, ChevronDown, ChevronUp } from "lucide-react";
import StatCard from "../components/workQueue/StatCard";
import QueueCard from "../components/workQueue/QueueCard";
import FinishedCard from "../components/workQueue/FinishedCard";

// ── Skeletons ──────────────────────────────────────────────────────────────
function QueueCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3"
        >
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="h-3 rounded bg-slate-100 dark:bg-surface-400" style={{ width: `${55 + (i % 4) * 10}%` }} />
            <div className="flex items-center gap-2">
              <div className="h-2.5 rounded bg-slate-100 dark:bg-surface-400" style={{ width: "80px" }} />
              <div className="h-4 rounded bg-slate-100 dark:bg-surface-400" style={{ width: "60px" }} />
            </div>
          </div>
          <div className="h-6 w-6 rounded bg-slate-100 dark:bg-surface-400 shrink-0" />
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
type QueueTab = "all" | "active" | "done";

const MyWorkQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [userRole] = useState(getUserRole());

  const [assignedItems, setAssignedItems] = useState<WorkQueueItem[]>([]);
  const [monitoringItems, setMonitoringItems] = useState<WorkQueueItem[]>([]);
  const [finishedDocs, setFinishedDocs] = useState<FinishedDocumentRow[]>([]);
  const [finishedLoading, setFinishedLoading] = useState(false);
  const [finishedHasMore, setFinishedHasMore] = useState(false);
  const [finishedPage, setFinishedPage] = useState(1);

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

  const [search, setSearch] = useState("");

  // Pre-select tab from router state (e.g. from Work Queue "finished" link)
  const initialTab = (location.state as any)?.tab as QueueTab | undefined;
  const [tab, setTab] = useState<QueueTab>(initialTab ?? "all");

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

  // ── Load queue + stats + activity ─────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
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

        if (!alive) return;
        if (s) setStats(s);
        setRecentActivity((a as any)?.data ?? []);
        setAssignedItems((q as any)?.assigned ?? []);
        setMonitoringItems((q as any)?.monitoring ?? []);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load work queue");
      } finally {
        if (alive) {
          setLoading(false);
          setLoadingActivity(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Load finished docs ─────────────────────────────────────────────────────
  const loadFinished = useCallback(async (page: number) => {
    setFinishedLoading(true);
    try {
      const res = await listFinishedDocuments({ page, per_page: 15 });
      const incoming = res.data ?? [];
      setFinishedDocs((prev) =>
        page === 1 ? incoming : [...prev, ...incoming],
      );
      setFinishedHasMore(
        res.meta?.current_page != null &&
          res.meta?.last_page != null &&
          res.meta.current_page < res.meta.last_page,
      );
    } catch {
      /* silent */
    } finally {
      setFinishedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "done" && finishedDocs.length === 0) {
      loadFinished(1);
    }
  }, [tab]);

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

  const isAdmin = userRole === "ADMIN" || userRole === "SYSADMIN";
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

  const filterItems = (items: WorkQueueItem[]) => {
    if (!search.trim()) return items;
    const q = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.document.title?.toLowerCase().includes(q) ||
        item.document.code?.toLowerCase().includes(q),
    );
  };

  const queueCountRef = useRef<number | null>(null);

  const loadAll = useCallback(async () => {
    const [s, a, q] = await Promise.all([
      getDocumentStats().catch(() => null),
      listActivityLogs({
        scope: isAdmin ? "all" : "mine",
        per_page: 10,
        category: "workflow",
      }).catch(() => ({ data: [] })),
      getWorkQueue().catch(() => ({ assigned: [], monitoring: [] })),
    ]);
    const assigned = (q as any)?.assigned ?? [];
    const monitoring = (q as any)?.monitoring ?? [];
    queueCountRef.current = assigned.length + monitoring.length;
    if (s) setStats(s);
    setRecentActivity((a as any)?.data ?? []);
    setAssignedItems(assigned);
    setMonitoringItems(monitoring);
    if (tab === "done") {
      setFinishedDocs([]);
      setFinishedPage(1);
      await loadFinished(1);
    }
  }, [tab, loadFinished, isAdmin]);

  const { refreshing } = usePageBurstRefresh(loadAll);

  // ── Tabs config ────────────────────────────────────────────────────────────
  const tabs: { value: QueueTab; label: string; count?: number }[] = [
    {
      value: "all",
      label: "All",
      count: allItems.length || undefined,
    },
    {
      value: "active",
      label: "Active",
      count: assignedItems.length || undefined,
    },
    { value: "done", label: "Done" },
  ];

  return (
    <PageFrame
      title={isAdmin ? "Work Queue" : "My Work Queue"}
      contentClassName="flex flex-col min-h-0 gap-5 h-full"
      right={
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={async () => {
              const prevCount = queueCountRef.current;
              await loadAll();
              const nextCount = queueCountRef.current;
              if (prevCount === null) return false; // initial load — suppress toast
              if (nextCount !== prevCount) {
                const diff = (nextCount ?? 0) - (prevCount ?? 0);
                return diff > 0
                  ? `${diff} new task${diff === 1 ? "" : "s"} in your queue.`
                  : `Queue updated — ${Math.abs(diff)} task${Math.abs(diff) === 1 ? "" : "s"} resolved.`;
              }
              return "Already up to date.";
            }}
            loading={refreshing || loading}
            title="Refresh queue"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            responsive
            onClick={() => navigate("/documents/all")}
          >
            <FileText size={14} className="sm:hidden" />
            <span>All workflows</span>
          </Button>
          {canCreate && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              responsive
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", {
                  state: { fromWorkQueue: true },
                });
              }}
            >
              <PlusCircle size={14} className="sm:hidden" />
              <span>+ Create document</span>
            </Button>
          )}
        </div>
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
            label="Pending"
            value={stats?.pending ?? null}
            loading={loading}
          />
        </div>
        <StatCard
          label="Total documents"
          value={stats?.total ?? null}
          loading={loading}
        />
        <StatCard
          label="Official"
          value={stats?.distributed ?? null}
          loading={loading}
        />
      </div>

      {/* Main 2-col layout */}
      <div className="flex gap-4 flex-col lg:flex-row flex-1 min-h-0 overflow-visible lg:overflow-hidden">
        {/* Queue panel */}
        <div className="flex flex-col flex-[2] rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 min-h-[450px] lg:min-h-0 overflow-hidden">
          {/* Panel header + tabs */}
          <div className="flex shrink-0 flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 p-3 sm:px-4 sm:py-3">
            <div>
              <p className="text-[13px] sm:text-sm font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {tab === "done"
                  ? "Completed flows"
                  : tab === "active"
                    ? "Needs action"
                    : "All documents"}
              </p>
              <p className="mt-0.5 text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {tab === "done"
                  ? "Distributed documents you were involved in"
                  : tab === "active"
                    ? "Assigned to your office — action required"
                    : "All active and distributed documents"}
              </p>
            </div>

            {/* Tab switcher — horizontal scroll on mobile */}
            <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={[
                    "flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 text-[11px] sm:text-xs font-semibold rounded-md transition-all whitespace-nowrap",
                    tab === t.value
                      ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400",
                  ].join(" ")}
                >
                  {t.label}
                  {t.count != null && (
                    <span className="inline-flex items-center justify-center rounded bg-slate-200 dark:bg-surface-300 px-1.5 py-0.5 text-[9px] font-bold text-slate-600 dark:text-slate-300">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar (All / Active tabs only) */}
          {tab !== "done" && (
            <div className="shrink-0 px-3 sm:px-4 pt-3 pb-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search docs…"
                  className="w-full rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 pl-8 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-brand-400 transition"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    title="Clear"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Queue list */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {tab === "done" ? (
              finishedLoading && finishedDocs.length === 0 ? (
                <QueueCardSkeleton rows={4} />
              ) : finishedDocs.length === 0 ? (
                <div className="flex h-full min-h-40 items-center justify-center rounded-md border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded bg-slate-100 dark:bg-surface-400 text-slate-400 dark:text-slate-500">
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      No finished flows yet
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      Distributed documents you acted on will appear here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {finishedDocs.map((doc) => (
                    <FinishedCard
                      key={doc.version_id}
                      doc={doc}
                      onClick={() =>
                        navigate(`/documents/${doc.id}`, {
                          state: { from: "/work-queue" },
                        })
                      }
                    />
                  ))}
                  {finishedHasMore && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const next = finishedPage + 1;
                          setFinishedPage(next);
                          loadFinished(next);
                        }}
                        disabled={finishedLoading}
                        className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
                      >
                        {finishedLoading ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : loading ? (
              <QueueCardSkeleton rows={4} />
            ) : (
              (() => {
                const displayItems = filterItems(
                  tab === "active" ? assignedItems : allItems,
                );
                return displayItems.length === 0 ? (
                  <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
                    <div className="text-center">
                      <div className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded bg-slate-100 dark:bg-surface-400 text-slate-400 dark:text-slate-500">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {search ? "No results" : "All caught up"}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {search
                          ? "Try a different search term."
                          : tab === "active"
                            ? "No tasks assigned to your office right now."
                            : "No documents in your queue."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {displayItems.map((item) => (
                      <QueueCard
                        key={`${item.document.id}-${item.version.id}`}
                        item={item}
                        onClick={openByDocId}
                      />
                    ))}
                  </div>
                );
              })()
            )}
          </div>
        </div>

        {/* Recent activity panel — collapsible on mobile, fixed on desktop */}
        <div className={[
          "flex flex-col lg:w-72 shrink-0 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden transition-all duration-300",
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
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 text-left">
                Recent activity
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-left">
                Workflow actions
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
                className="hidden sm:block text-xs font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors"
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
              <div className="space-y-1.5 animate-pulse">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-2.5 px-1 py-1.5">
                    <div className="mt-0.5 h-3.5 w-3.5 rounded-full bg-slate-100 dark:bg-surface-400 shrink-0" />
                    <div className="flex-1 space-y-1">
                      <div
                        className="h-2.5 rounded bg-slate-100 dark:bg-surface-400"
                        style={{ width: `${50 + (i % 4) * 12}%` }}
                      />
                      <div
                        className="h-2 rounded bg-slate-100 dark:bg-surface-400"
                        style={{ width: "45%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
