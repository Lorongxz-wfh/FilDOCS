import React, { useEffect, useState } from "react";
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
import PageFrame from "../components/layout/PageFrame";
import Button from "../components/ui/Button";
import InlineSpinner from "../components/ui/loader/InlineSpinner";
import SkeletonList from "../components/ui/loader/SkeletonList";
import { markWorkQueueSession } from "../lib/guards/RequireFromWorkQueue";

// ── Stat card ──────────────────────────────────────────────────────────────────

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

// ── Queue item card ────────────────────────────────────────────────────────────

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
      {/* Status pill */}
      <div className="shrink-0">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusColor(ver.status)}`}
        >
          {ver.status}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
          {doc.title}
        </p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
          {doc.code} · v{ver.version_number}
        </p>
      </div>

      {/* Action badge */}
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

// ── Main page ──────────────────────────────────────────────────────────────────

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
  const [tab, setTab] = useState<"assigned" | "monitoring">("assigned");

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

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const roleNow = getUserRole();

        const [s, a] = await Promise.all([
          getDocumentStats(),
          listActivityLogs({ scope: "mine", per_page: 10 }),
        ]);

        if (!alive) return;
        setStats(s);
        setRecentActivity((a as any)?.data ?? []);

        if (roleNow !== "ADMIN") {
          const q = await getWorkQueue();
          if (!alive) return;
          setAssignedItems(q.assigned ?? []);
          setMonitoringItems(q.monitoring ?? []);
        }
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
  const showMonitoring = isQA(userRole);
  const activeItems = tab === "assigned" ? assignedItems : monitoringItems;

  return (
    <PageFrame
      title="My Work Queue"
      contentClassName="flex flex-col min-h-0 gap-5"
      right={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate("/documents")}
          >
            Document library
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

      {/* Queue + Activity — 2 col on large screens */}
      <div
        className="flex gap-5 flex-col lg:flex-row lg:min-h-0"
        style={{ height: "calc(100vh - 275px)" }}
      >
        {/* Work queue panel */}
        <div className="flex flex-col flex-1 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Pending actions
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Items requiring your attention
              </p>
            </div>

            {/* Tabs — only show if QA (has monitoring) */}
            {showMonitoring && (
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 p-1">
                {(["assigned", "monitoring"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTab(t)}
                    className={[
                      "rounded-md px-3 py-1 text-xs font-medium capitalize transition",
                      tab === t
                        ? "bg-white dark:bg-surface-500 text-slate-900 dark:text-slate-100 shadow-sm border border-slate-200 dark:border-surface-400"
                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200",
                    ].join(" ")}
                  >
                    {t}
                    {t === "assigned" && assignedItems.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-sky-100 dark:bg-sky-950/40 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-400">
                        {assignedItems.length}
                      </span>
                    )}
                    {t === "monitoring" && monitoringItems.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                        {monitoringItems.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Count badge for non-QA */}
            {!showMonitoring && assignedItems.length > 0 && (
              <span className="inline-flex items-center rounded-full border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/40 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400">
                {assignedItems.length} pending
              </span>
            )}
          </div>

          {/* Queue list */}
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {loading ? (
              <SkeletonList rows={4} rowClassName="h-14 rounded-xl" />
            ) : activeItems.length === 0 ? (
              <div className="flex h-full min-h-[160px] items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600">
                <div className="text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-lg">
                    ✓
                  </div>
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    All caught up
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                    {tab === "assigned"
                      ? "No assigned tasks right now."
                      : "No monitored documents right now."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeItems.map((item) => (
                  <QueueCard
                    key={`${item.document.id}-${item.version.id}`}
                    item={item}
                    onClick={openByDocId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent activity panel */}
        <div className="flex flex-col lg:w-80 shrink-0 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden max-h-96 lg:max-h-none">
          {/* Panel header */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 dark:border-surface-400 px-5 py-4">
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Recent activity
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Your latest actions
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/my-activity")}
              className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              View all
            </button>
          </div>

          {/* Activity list */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {loadingActivity ? (
              <SkeletonList rows={5} rowClassName="h-12 rounded-lg" />
            ) : recentActivity.length === 0 ? (
              <div className="flex h-full min-h-[120px] items-center justify-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  No activity yet.
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
