import React from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/ui/loader/Skeleton";
import RefreshButton from "../components/ui/RefreshButton";

// Shared charts
import StatusDonutChart from "../components/charts/StatusDonutChart";
import VolumeTrendChart from "../components/charts/VolumeTrendChart";
import PhaseDistributionChart from "../components/charts/PhaseDistributionChart";
import StageDelayChart from "../components/charts/StageDelayChart";

// Shared dashboard components
import DashboardStatRow from "../components/dashboard/DashboardStatRow";
import DashboardPendingList from "../components/dashboard/DashboardPendingList";
import DashboardRecentActivity from "../components/dashboard/DashboardRecentActivity";

// Admin-only components
import AdminStatGrid from "../components/dashboard/AdminStatGrid";
import AdminDocumentPhaseChart from "../components/dashboard/AdminDocumentPhaseChart";
import ActivityDistributionChart from "../components/charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../components/charts/DailyActivityStackedBarChart";

import { useDashboardData } from "../hooks/useDashboardData";
import { useAnnouncements } from "../hooks/useAnnouncements";
import AnnouncementsBanner from "../components/dashboard/AnnouncementsBanner";
import { usePageBurstRefresh } from "../hooks/usePageBurstRefresh";
import { getUserRole, isQA, isAuditor } from "../lib/roleFilters";
import { getAuthUser } from "../lib/auth";
import {
  FolderOpen,
  ClipboardList,
  Inbox,
  Percent,
  Timer,
  AlertCircle,
} from "lucide-react";

// ─── Shared announcements prop ─────────────────────────────────────────────
type AnnouncementsHook = ReturnType<typeof useAnnouncements>;

// ─── Card ─────────────────────────────────────────────────────────────────
const Card: React.FC<{
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
  className?: string;
}> = ({ title, sub, action, children, className = "" }) => (
  <div
    className={`rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 ${className}`}
  >
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-surface-400 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight">
          {title}
        </p>
        {sub && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {sub}
          </p>
        )}
      </div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-400 dark:text-brand-400 transition-colors"
        >
          {action.label} →
        </button>
      )}
    </div>
    <div className="px-4 py-4">{children}</div>
  </div>
);

// ─── QA Dashboard ─────────────────────────────────────────────────────────
const QADashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
    announcements: AnnouncementsHook;
  }
> = ({
  stats,
  pending,
  report,
  recentActivity,
  pendingRequestsCount,
  pendingActions,
  loading,
  navigate,
  announcements,
}) => {
  const kpiCards = [
    {
      label: "Waiting on QA",
      value: report.waiting_on_qa ?? 0,
      sub: "docs on QA's desk now",
      icon: <AlertCircle className="h-4 w-4" />,
      iconCls: "text-rose-400 dark:text-rose-400",
      valueCls:
        (report.waiting_on_qa ?? 0) > 0
          ? "text-rose-600 dark:text-rose-400"
          : "text-slate-900 dark:text-slate-100",
    },
    {
      label: "First-pass yield",
      value: `${report.kpis.first_pass_yield_pct}%`,
      sub: "no returns, clean flow",
      icon: <Percent className="h-4 w-4" />,
      iconCls: "text-emerald-400 dark:text-emerald-400",
      valueCls: "text-slate-900 dark:text-slate-100",
    },
    {
      label: "Avg cycle time",
      value: `${report.kpis.cycle_time_avg_days}d`,
      sub: "draft to distributed",
      icon: <Timer className="h-4 w-4" />,
      iconCls: "text-sky-400 dark:text-sky-400",
      valueCls: "text-slate-900 dark:text-slate-100",
    },
  ];

  return (
    <div className="space-y-4">
      <AnnouncementsBanner
        announcements={announcements.announcements}
        loading={announcements.loading}
        onDeleted={() => announcements.reload()}
      />

      <DashboardStatRow
        role="QA"
        stats={stats}
        pendingCount={pending.length}
        pendingRequestsCount={pendingRequestsCount}
        loading={loading}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpiCards.map((k) => (
          <div
            key={k.label}
            className="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3.5 dark:border-surface-400 dark:bg-surface-500"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {k.label}
              </p>
              <span className={`shrink-0 ${k.iconCls}`}>{k.icon}</span>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-7 w-14" />
            ) : (
              <p
                className={`mt-2.5 text-2xl font-bold tabular-nums leading-none ${k.valueCls}`}
              >
                {k.value}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              {k.sub}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card
          title="Document volume"
          sub="Created vs distributed per month"
          action={{
            label: "View reports",
            onClick: () => navigate("/reports"),
          }}
          className="lg:col-span-2"
        >
          <VolumeTrendChart
            data={report.volume_series}
            height={200}
            loading={loading}
          />
        </Card>
        <Card
          title="Pipeline state"
          sub="Docs by current phase"
          action={{
            label: "View library",
            onClick: () => navigate("/documents"),
          }}
        >
          <PhaseDistributionChart
            data={report.phase_distribution ?? []}
            variant="donut"
            height={200}
            loading={loading}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardPendingList items={pendingActions} loading={loading} />
        <Card
          title="Stage delay"
          sub="Median hold time per workflow phase"
          action={{
            label: "View reports",
            onClick: () => navigate("/reports"),
          }}
        >
          <StageDelayChart
            data={report.stage_delays_by_phase ?? []}
            height={200}
            loading={loading}
          />
        </Card>
      </div>

      <Card
        title="Recent activity"
        sub="Latest actions in the system."
        action={{
          label: "View all",
          onClick: () => navigate("/activity-logs"),
        }}
      >
        <DashboardRecentActivity logs={recentActivity} loading={loading} />
      </Card>
    </div>
  );
};

// ─── Office Dashboard ──────────────────────────────────────────────────────
const OfficeDashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
    role: ReturnType<typeof getUserRole>;
    announcements: AnnouncementsHook;
  }
> = ({
  stats,
  pendingActions,
  recentActivity,
  loading,
  navigate,
  role,
  announcements,
  pendingRequestsInboxCount,
  pending,
}) => {
  const inboxCount = pendingRequestsInboxCount ?? 0;
  const totalPendingActions = pendingActions.length;

  const kpiCards = [
    {
      label: "Pending actions",
      value: totalPendingActions,
      sub: "tasks + requests combined",
      icon: <ClipboardList className="h-4 w-4" />,
      iconCls: "text-brand-400 dark:text-brand-400",
      valueCls:
        totalPendingActions > 0
          ? "text-brand-600 dark:text-brand-400"
          : "text-slate-900 dark:text-slate-100",
      onClick: () => navigate("/work-queue"),
    },
    {
      label: "Doc requests",
      value: inboxCount,
      sub: "pending in your inbox",
      icon: <Inbox className="h-4 w-4" />,
      iconCls: "text-violet-400 dark:text-violet-400",
      valueCls:
        inboxCount > 0
          ? "text-violet-600 dark:text-violet-400"
          : "text-slate-900 dark:text-slate-100",
      onClick: () => navigate("/document-requests"),
    },
    {
      label: "My documents",
      value: stats?.total ?? 0,
      sub: "created by your office",
      icon: <FolderOpen className="h-4 w-4" />,
      iconCls: "text-sky-400 dark:text-sky-400",
      valueCls: "text-slate-900 dark:text-slate-100",
      onClick: () => navigate("/documents"),
    },
  ];

  const donutSegments = [
    { label: "Distributed", value: stats?.distributed ?? 0, color: "#10b981" },
    { label: "In progress", value: stats?.pending ?? 0, color: "#f59e0b" },
    {
      label: "Draft / other",
      value: Math.max(
        0,
        (stats?.total ?? 0) - (stats?.distributed ?? 0) - (stats?.pending ?? 0),
      ),
      color: "#94a3b8",
    },
  ];

  return (
    <div className="space-y-4">
      <AnnouncementsBanner
        announcements={announcements.announcements}
        loading={announcements.loading}
        onDeleted={() => announcements.reload()}
      />

      <DashboardStatRow
        role={role}
        stats={stats}
        pendingCount={pending.length}
        pendingRequestsCount={inboxCount}
        loading={loading}
      />

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {kpiCards.map((k) => (
          <button
            key={k.label}
            type="button"
            onClick={k.onClick}
            className="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:hover:bg-surface-400"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
                {k.label}
              </p>
              <span className={`shrink-0 ${k.iconCls}`}>{k.icon}</span>
            </div>
            {loading ? (
              <Skeleton className="mt-3 h-7 w-14" />
            ) : (
              <p
                className={`mt-2.5 text-2xl font-bold tabular-nums leading-none ${k.valueCls}`}
              >
                {k.value}
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
              {k.sub}
            </p>
          </button>
        ))}
      </div>

      {/* Document summary + pending work queue */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="My document summary"
          sub="Status of documents created by your office."
          action={{
            label: "Open library",
            onClick: () => navigate("/documents"),
          }}
        >
          {loading ? (
            <div className="flex items-center gap-6">
              <Skeleton className="h-40 w-40 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          ) : (
            <StatusDonutChart
              segments={donutSegments}
              centerValue={stats?.total ?? 0}
              centerLabel="total"
              size={160}
            />
          )}
        </Card>

        <DashboardPendingList items={pendingActions} loading={loading} />
      </div>

      {/* Recent activity */}
      <Card
        title="Recent activity"
        sub="Latest actions on your office's documents."
        action={{
          label: "View all",
          onClick: () => navigate("/activity-logs"),
        }}
      >
        <DashboardRecentActivity logs={recentActivity} loading={loading} />
      </Card>
    </div>
  );
};

// ─── Admin Dashboard ───────────────────────────────────────────────────────
const AdminDashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
    announcements: AnnouncementsHook;
  }
> = ({ adminStats, recentActivity, loading, navigate, announcements }) => (
  <div className="space-y-4">
    <AnnouncementsBanner
      announcements={announcements.announcements}
      loading={announcements.loading}
      onDeleted={() => announcements.reload()}
    />

    <AdminStatGrid data={adminStats} loading={loading} />

    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card
        title="Documents by phase"
        sub="Current workflow stage of all documents."
        action={{
          label: "Open library",
          onClick: () => navigate("/documents"),
        }}
        className="lg:col-span-2"
      >
        <AdminDocumentPhaseChart
          byPhase={adminStats?.documents.by_phase}
          height={200}
          loading={loading}
        />
      </Card>

      <Card
        title="Action Breakdown"
        sub="System activity distribution."
        action={{
          label: "View reports",
          onClick: () => navigate("/reports"),
        }}
      >
        <ActivityDistributionChart
          data={adminStats?.activity.distribution ?? []}
          height={200}
          loading={loading}
        />
      </Card>
    </div>

    <Card
      title="System Activity Trend"
      sub="Categorized system actions last 14 days."
      action={{
        label: "View full report",
        onClick: () => navigate("/reports"),
      }}
    >
      <DailyActivityStackedBarChart
        data={adminStats?.activity.daily_trend ?? []}
        height={200}
        loading={loading}
      />
    </Card>

    <Card
      title="Recent activity"
      sub="Latest actions across the system."
      action={{ label: "View all", onClick: () => navigate("/activity-logs") }}
    >
      <DashboardRecentActivity logs={recentActivity} loading={loading} />
    </Card>
  </div>
);

// ─── Auditor Dashboard ─────────────────────────────────────────────────────
const AuditorDashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
    announcements: AnnouncementsHook;
  }
> = ({ stats, recentActivity, loading, navigate, announcements }) => {
  return (
    <div className="space-y-4">
      <AnnouncementsBanner
        announcements={announcements.announcements}
        loading={announcements.loading}
        onDeleted={() => announcements.reload()}
      />

      {/* Stat card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => navigate("/documents")}
          className="min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3.5 text-left transition-colors hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:hover:bg-surface-400"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">
              Distributed Documents
            </p>
            <span className="shrink-0 text-emerald-400 dark:text-emerald-400">
              <FolderOpen className="h-4 w-4" />
            </span>
          </div>
          {loading ? (
            <Skeleton className="mt-3 h-7 w-14" />
          ) : (
            <p className="mt-2.5 text-2xl font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
              {stats?.distributed ?? 0}
            </p>
          )}
          <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
            open library to view documents
          </p>
        </button>
      </div>

      {/* Info + global activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-md border border-slate-200 bg-white px-8 py-10 text-center dark:border-surface-400 dark:bg-surface-500">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950/30 dark:text-sky-400">
            <FolderOpen className="h-7 w-7" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
            Read-only Auditor access
          </h2>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
            Browse and download all fully distributed documents across all offices.
          </p>
          <button
            type="button"
            onClick={() => navigate("/documents")}
            className="cursor-pointer mt-5 rounded border border-transparent bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-600 dark:hover:bg-brand-400"
          >
            Go to Library
          </button>
        </div>

        <div className="lg:col-span-2">
          <Card
            title="System-wide activity"
            sub="Live feed of global document actions."
            action={{ label: "View log", onClick: () => navigate("/activity-logs") }}
          >
            <DashboardRecentActivity logs={recentActivity} loading={loading} />
          </Card>
        </div>
      </div>
    </div>
  );
};

// ─── Root ──────────────────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const role = getUserRole();
  const dashData = useDashboardData(role);
  const { loading } = dashData;
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const [refreshing, setRefreshing] = React.useState(false);

  const announcements = useAnnouncements();

  usePageBurstRefresh(() => {
    dashData.reload();
  });

  const handleRefresh = async (): Promise<string | false> => {
    setRefreshing(true);
    try {
      const result = await dashData.reload();
      if (!result.changed) return "Everything is up to date.";
      if (result.delta > 0)
        return `${result.delta} new pending task${result.delta === 1 ? "" : "s"} found.`;
      if (result.delta < 0)
        return `Queue updated — ${Math.abs(result.delta)} task${Math.abs(result.delta) === 1 ? "" : "s"} resolved.`;
      return "Dashboard updated.";
    } finally {
      setRefreshing(false);
    }
  };

  const user = getAuthUser();
  const firstName =
    user?.first_name?.trim() || user?.full_name?.split(" ")[0] || "there";
  const initials =
    (user?.full_name ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const pendingCount = dashData.pendingActions.length;

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-surface-400 dark:bg-surface-600 px-5 py-3.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md overflow-hidden bg-slate-100 dark:bg-surface-400 text-sm font-semibold text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-300">
              {(user as any)?.profile_photo_url ? (
                <img
                  src={(user as any).profile_photo_url}
                  alt={user?.full_name ?? ""}
                  className="h-full w-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-400 dark:text-slate-500">
                Dashboard &middot; {today}
              </p>
              <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                {greeting}, {firstName}
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {!loading &&
              (pendingCount > 0 ? (
                <div className="hidden sm:flex items-center gap-1.5 rounded border border-rose-200 bg-rose-50 px-2.5 py-1 dark:border-rose-900 dark:bg-rose-950/15">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                  </span>
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-300">
                    {pendingCount} pending
                  </span>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-1.5 rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1 dark:border-emerald-900 dark:bg-emerald-950/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    All caught up
                  </span>
                </div>
              ))}

            <RefreshButton
              onRefresh={handleRefresh}
              loading={refreshing || loading}
              title="Refresh dashboard"
            />
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-4 space-y-4">
          {isAdmin ? (
            <AdminDashboard
              {...dashData}
              navigate={navigate}
              announcements={announcements}
            />
          ) : isAuditor(role) ? (
            <AuditorDashboard
              {...dashData}
              navigate={navigate}
              announcements={announcements}
            />
          ) : isQA(role) ? (
            <QADashboard
              {...dashData}
              navigate={navigate}
              announcements={announcements}
            />
          ) : (
            <OfficeDashboard
              {...dashData}
              navigate={navigate}
              role={role}
              announcements={announcements}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
