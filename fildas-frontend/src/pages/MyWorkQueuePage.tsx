import React, { useCallback, useEffect, useState } from "react";
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
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import InlineSpinner from "../components/ui/loader/InlineSpinner";
import SkeletonList from "../components/ui/loader/SkeletonList";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { RefreshCw, CheckCircle2, FileText, Search, X } from "lucide-react";

// ── Stat card ──────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string;
  value: number | null;
  loading: boolean;
  color: "sky" | "slate" | "emerald";
}> = ({ label, value, loading, color }) => {
  const colorMap = {
    sky: "text-sky-600 dark:text-sky-400",
    slate: "text-slate-800 dark:text-slate-100",
    emerald: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className="flex-1 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-5 py-4">
      <div className={`text-3xl font-bold tabular-nums ${colorMap[color]}`}>
        {loading ? (
          <InlineSpinner className="h-6 w-6 border-2" />
        ) : (
          (value ?? 0)
        )}
      </div>
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
    </div>
  );
};

// ── Queue item card ────────────────────────────────────────────────────────
const QueueCard: React.FC<{
  item: WorkQueueItem;
  onClick: (id: number) => void;
}> = ({ item, onClick }) => {
  const doc = item.document;
  const ver = item.version;

  const statusColor = (s: string) => {
    const sl = s.toLowerCase();
    if (sl.includes("draft"))
      return "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
    if (sl.includes("review"))
      return "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400";
    if (sl.includes("approval"))
      return "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400";
    if (sl.includes("distribut"))
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400";
    return "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400";
  };

  return (
    <button
      type="button"
      onClick={() => onClick(doc.id)}
      className="w-full text-left flex items-center gap-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3 transition hover:border-sky-300 dark:hover:border-sky-700 hover:shadow-sm"
    >
      <div className="shrink-0">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColor(ver.status)}`}
        >
          {ver.status}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {doc.title}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {doc.code} · v{ver.version_number}
        </p>
      </div>
      <div className="shrink-0">
        {item.can_act ? (
          <span className="inline-flex items-center gap-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
            Action needed →
          </span>
        ) : (
          <span className="inline-flex items-center rounded-lg bg-slate-50 dark:bg-surface-400 border border-slate-200 dark:border-surface-400 px-2.5 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Monitoring
          </span>
        )}
      </div>
    </button>
  );
};

// ── Finished doc card ──────────────────────────────────────────────────────
const FinishedCard: React.FC<{
  doc: FinishedDocumentRow;
  onClick: () => void;
}> = ({ doc, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full text-left flex items-center gap-4 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3 transition hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-sm group"
  >
    <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30">
      <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
        {doc.title}
      </p>
      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
        {doc.code ?? "—"} · v{doc.version_number}
        {doc.owner_office_code && ` · ${doc.owner_office_code}`}
      </p>
    </div>
    <div className="shrink-0 flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-2.5 w-2.5" />
        Distributed
      </span>
      {doc.distributed_at && (
        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {new Date(doc.distributed_at).toLocaleDateString()}
        </span>
      )}
    </div>
  </button>
);

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
        const [s, a] = await Promise.all([
          getDocumentStats(),
          // Workflow-only events for recent activity
          listActivityLogs({
            scope: "mine",
            per_page: 10,
            category: "workflow",
          }),
        ]);

        if (!alive) return;
        setStats(s);
        setRecentActivity((a as any)?.data ?? []);

        const q = await getWorkQueue();
        if (!alive) return;
        setAssignedItems(q.assigned ?? []);
        setMonitoringItems(q.monitoring ?? []);
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

  const canCreate =
    isQA(userRole) || isOfficeStaff(userRole) || isOfficeHead(userRole);

  // Combined + filtered lists
  const allItems = React.useMemo(() => {
    const seen = new Set<string>();
    return [...assignedItems, ...monitoringItems].filter((item) => {
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

  const loadAll = useCallback(async () => {
    const [s, a] = await Promise.all([
      getDocumentStats(),
      listActivityLogs({ scope: "mine", per_page: 10, category: "workflow" }),
    ]);
    setStats(s);
    setRecentActivity((a as any)?.data ?? []);
    const q = await getWorkQueue();
    setAssignedItems(q.assigned ?? []);
    setMonitoringItems(q.monitoring ?? []);
    if (tab === "done") {
      setFinishedDocs([]);
      setFinishedPage(1);
      await loadFinished(1);
    }
  }, [tab, loadFinished]);

  const { refresh, refreshing } = usePageBurstRefresh(loadAll);

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
      title="My Work Queue"
      contentClassName="flex flex-col min-h-0 gap-5"
      right={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing || loading}
            title="Refresh queue"
            className="flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/documents")}
          >
            Library
          </Button>
          {canCreate && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                markWorkQueueSession();
                navigate("/documents/create", {
                  state: { fromWorkQueue: true },
                });
              }}
            >
              + Create document
            </Button>
          )}
        </div>
      }
    >
      {/* Error */}
      {error && (
        <div className="shrink-0 rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 px-4 py-3 text-sm text-rose-700 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        <StatCard
          label="Pending"
          value={stats?.pending ?? null}
          loading={loading}
          color="sky"
        />
        <StatCard
          label="Total documents"
          value={stats?.total ?? null}
          loading={loading}
          color="slate"
        />
        <StatCard
          label="Official"
          value={stats?.distributed ?? null}
          loading={loading}
          color="emerald"
        />
      </div>

      {/* Main 2-col layout */}
      <div
        className="flex gap-5 flex-col lg:flex-row lg:min-h-0"
        style={{ height: "calc(100vh - 275px)" }}
      >
        {/* Queue panel */}
        <div className="flex flex-col flex-1 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
          {/* Panel header + tabs */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-5 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {tab === "done" ? "Completed flows" : tab === "active" ? "Needs action" : "All documents"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {tab === "done"
                  ? "Distributed documents you were involved in"
                  : tab === "active"
                  ? "Assigned to your office — action required"
                  : "All assigned + monitored documents"}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-1">
              {tabs.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTab(t.value)}
                  className={[
                    "rounded-md px-3 py-1 text-xs font-medium capitalize transition",
                    tab === t.value
                      ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-surface-400"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                  ].join(" ")}
                >
                  {t.label}
                  {t.count != null && (
                    <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                      {t.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Search bar (All / Active tabs only) */}
          {tab !== "done" && (
            <div className="shrink-0 px-5 pt-3 pb-0">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by title or code…"
                  className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 pl-9 pr-8 py-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:focus:ring-sky-900/30 transition"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Queue list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === "done" ? (
              finishedLoading && finishedDocs.length === 0 ? (
                <SkeletonList rows={4} rowClassName="h-14 rounded-xl" />
              ) : finishedDocs.length === 0 ? (
                <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400 text-slate-400 dark:text-slate-500 text-lg">
                      <CheckCircle2 className="h-5 w-5" />
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
                        className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition"
                      >
                        {finishedLoading ? "Loading…" : "Load more"}
                      </button>
                    </div>
                  )}
                </div>
              )
            ) : loading ? (
              <SkeletonList rows={4} rowClassName="h-14 rounded-xl" />
            ) : (() => {
              const displayItems = filterItems(
                tab === "active" ? assignedItems : allItems,
              );
              return displayItems.length === 0 ? (
                <div className="flex h-full min-h-40 items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-lg">
                      ✓
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
            })()}
          </div>
        </div>

        {/* Recent activity panel — workflow only */}
        <div className="flex flex-col lg:w-80 shrink-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden max-h-96 lg:max-h-none">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent activity
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Workflow actions
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                navigate("/my-activity", {
                  state: { category: "workflow" },
                })
              }
              className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              View all
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loadingActivity ? (
              <SkeletonList rows={5} rowClassName="h-12 rounded-lg" />
            ) : recentActivity.length === 0 ? (
              <div className="flex h-full min-h-30 items-center justify-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No workflow activity yet.
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {recentActivity.slice(0, 8).map((l: any) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => openActivity(l)}
                    className="w-full text-left rounded-lg px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-surface-400"
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
