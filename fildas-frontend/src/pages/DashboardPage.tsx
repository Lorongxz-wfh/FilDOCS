import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import InlineSpinner from "../components/ui/loader/InlineSpinner";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import Button from "../components/ui/Button";

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
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { getUserRole, isQA, isAuditor } from "../lib/roleFilters";
import { getAuthUser } from "../lib/auth";
import {
  FolderOpen,
  Calendar,
  CalendarDays,
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
  loading?: boolean;
  hasData?: boolean;
}> = ({ title, sub, action, children, className = "" }) => {

  return (
    <div
      className={`rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden ${className}`}
    >
      <div className={`flex items-start justify-between gap-3 border-b border-slate-100 dark:border-surface-400 p-3 sm:px-4 sm:py-3`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
              {title}
            </p>
          </div>
          {sub && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {sub}
            </p>
          )}
        </div>
        {action && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={action.onClick}
            className="font-bold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
          >
            {action.label} →
          </Button>
        )}
      </div>
      <div className={`p-3 sm:p-4 transition-opacity duration-200`}>
        {children}
      </div>
    </div>
  );
};

// ─── QA Dashboard ─────────────────────────────────────────────────────────
const QADashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
    announcements: AnnouncementsHook;
    onCarouselScroll?: React.UIEventHandler<HTMLDivElement>;
    activeIndex?: number;
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
  onCarouselScroll,
  activeIndex = 0,
}) => {
  const chartCount = 3; // Document volume, Pipeline state, Stage delay (mobile)
  
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
        onStatClick={(label) => {
          if (label === "Action needed" || label === "In progress") navigate("/work-queue");
          if (label === "Total documents" || label === "Distributed") navigate("/documents");
          if (label === "Pending requests") navigate("/document-requests");
        }}
      />

      <div className="relative group">
        <div 
          onScroll={onCarouselScroll}
          className="flex sm:grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory hide-scrollbar pb-1 sm:pb-0"
        >
          <Card
            title="Document volume"
            sub="Created vs distributed trend"
            action={{
              label: "View reports",
              onClick: () => navigate("/reports"),
            }}
            className="min-w-[88vw] sm:min-w-0 snap-center lg:col-span-2"
            loading={loading}
            hasData={!!report.volume_series?.length}
          >
            <VolumeTrendChart
              data={report.volume_series}
              height={window.innerWidth < 640 ? 150 : 200}
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
            className="min-w-[88vw] sm:min-w-0 snap-center"
            loading={loading}
            hasData={!!report.phase_distribution?.length}
          >
            <PhaseDistributionChart
              data={report.phase_distribution ?? []}
              variant="donut"
              height={window.innerWidth < 640 ? 150 : 200}
              loading={loading}
            />
          </Card>

          <Card
            title="Stage delay"
            sub="Median hold time per workflow phase"
            action={{
              label: "View reports",
              onClick: () => navigate("/reports"),
            }}
            className="min-w-[88vw] sm:min-w-0 snap-center lg:hidden"
            loading={loading}
            hasData={!!report.stage_delays_by_phase?.length}
          >
            <StageDelayChart
              data={report.stage_delays_by_phase ?? []}
              height={150}
              loading={loading}
            />
          </Card>
        </div>

        {/* Carousel Indicators */}
        <div className="flex sm:hidden justify-center gap-1.5 mt-2">
          {[...Array(chartCount)].map((_, i) => (
            <div 
              key={i} 
              className={`h-1 rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-4 bg-sky-500" : "w-1.5 bg-slate-200 dark:bg-surface-400"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Desktop-only Stage Delay if not in carousel-span above */}
      <div className="hidden lg:grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DashboardPendingList items={pendingActions} loading={loading} hasData={!!pendingActions?.length} />
        <Card
          title="Stage delay"
          sub="Median hold time per workflow phase"
          action={{
            label: "View reports",
            onClick: () => navigate("/reports"),
          }}
          loading={loading}
          hasData={!!report.stage_delays_by_phase?.length}
        >
          <StageDelayChart
            data={report.stage_delays_by_phase ?? []}
            height={200}
            loading={loading}
          />
        </Card>
      </div>

      {/* Mobile-only Pending list */}
      <div className="lg:hidden mt-1">
        <DashboardPendingList items={pendingActions} loading={loading} hasData={!!pendingActions?.length} />
      </div>

      <Card
        title="Recent activity"
        sub="Latest actions in the system."
        loading={loading}
        hasData={!!recentActivity?.length}
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
    onCarouselScroll?: React.UIEventHandler<HTMLDivElement>;
    activeIndex?: number;
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
  onCarouselScroll,
  activeIndex = 0,
}) => {
    const chartCount = 1; // Just one donut chart for office currently, but let's keep it consistent
    const inboxCount = pendingRequestsInboxCount ?? 0;

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
          onStatClick={(label) => {
            if (label === "Action needed" || label === "In progress") navigate("/work-queue");
            if (label === "My documents" || label === "Distributed") navigate("/documents");
            if (label === "Pending requests") navigate("/document-requests");
          }}
        />

        {/* Document summary + pending work queue */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="relative group">
            <div 
              onScroll={onCarouselScroll}
              className="flex sm:grid grid-cols-1 gap-4 lg:grid-cols-1 overflow-x-auto sm:overflow-visible snap-x snap-mandatory hide-scrollbar pb-1 sm:pb-0"
            >
              <Card
                title="My document summary"
                sub="Status of documents created by your office."
                action={{
                  label: "Open library",
                  onClick: () => navigate("/documents"),
                }}
                className="min-w-[88vw] sm:min-w-0 snap-center"
                loading={loading}
                hasData={!!stats}
              >
                <StatusDonutChart
                  segments={donutSegments}
                  centerValue={stats?.total ?? 0}
                  centerLabel="total"
                  size={160}
                  loading={loading}
                />
              </Card>
            </div>
            
            <div className="flex sm:hidden justify-center gap-1.5 mt-2">
              {[...Array(chartCount)].map((_, i) => (
                <div 
                  key={i} 
                  className={`h-1 rounded-full transition-all duration-300 ${
                    i === activeIndex ? "w-4 bg-sky-500" : "w-1.5 bg-slate-200 dark:bg-surface-400"
                  }`}
                />
              ))}
            </div>
          </div>

          <DashboardPendingList items={pendingActions} loading={loading} hasData={!!pendingActions?.length} />
        </div>

        {/* Recent activity */}
        <Card
          title="Recent activity"
          sub="Latest actions on your office's documents."
          loading={loading}
          hasData={!!recentActivity?.length}
        >
          <DashboardRecentActivity logs={recentActivity} loading={loading} hasData={!!recentActivity?.length} />
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

    <Card
      title="Admin overview"
      sub="System-wide document statistics"
      loading={loading}
      hasData={!!adminStats}
    >
      <AdminStatGrid data={adminStats} loading={loading && !adminStats} />
    </Card>

    {/* Charts Carousel/Grid */}
    <div className="flex sm:grid grid-cols-1 gap-4 lg:grid-cols-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory hide-scrollbar pb-1 sm:pb-0">
      <Card
        title="Documents by phase"
        sub="Current workflow stage of all documents."
        action={{
          label: "Open library",
          onClick: () => navigate("/documents"),
        }}
        className="min-w-[85vw] sm:min-w-0 snap-center lg:col-span-2"
        loading={loading}
        hasData={!!adminStats?.documents.by_phase}
      >
        <AdminDocumentPhaseChart
          byPhase={adminStats?.documents.by_phase}
          height={window.innerWidth < 640 ? 160 : 200}
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
        className="min-w-[85vw] sm:min-w-0 snap-center"
        loading={loading}
        hasData={!!adminStats?.activity.distribution?.length}
      >
        <ActivityDistributionChart
          data={adminStats?.activity.distribution ?? []}
          height={window.innerWidth < 640 ? 160 : 200}
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
      loading={loading}
      hasData={!!adminStats?.activity.daily_trend?.length}
    >
      <DailyActivityStackedBarChart
        data={adminStats?.activity.daily_trend ?? []}
        height={200}
        loading={loading && !adminStats?.activity.daily_trend?.length}
      />
    </Card>

    <Card
      title="Recent activity"
      sub="Latest actions across the system."
      loading={loading}
      hasData={!!recentActivity?.length}
    >
      <DashboardRecentActivity logs={recentActivity} loading={loading} hasData={!!recentActivity?.length} />
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
          className={`min-w-0 rounded-md border border-slate-200 bg-white px-4 py-3.5 text-left transition-all hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:hover:bg-surface-400 ${loading && stats ? "opacity-60" : "opacity-100"}`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
                Distributed Documents
              </p>
              {loading && stats && (
                <InlineSpinner size="xs" variant="neutral" />
              )}
            </div>
            <span className="shrink-0 text-emerald-400 dark:text-emerald-400">
              <FolderOpen className="h-4 w-4" />
            </span>
          </div>
          {loading && !stats ? (
            <div
              className="shrink-0 rounded-full border-[14px] border-slate-100 dark:border-surface-400"
              style={{ width: 160, height: 160 }}
            />
          ) : (
            <p className="mt-2.5 text-2xl font-display font-bold tabular-nums leading-none text-slate-900 dark:text-slate-100">
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
            loading={loading}
            hasData={!!recentActivity?.length}
          >
            <DashboardRecentActivity logs={recentActivity} loading={loading} hasData={!!recentActivity?.length} />
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
  const { period, setPeriod } = dashData;
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";

  const announcements = useAnnouncements();

  usePageBurstRefresh(() => {
    dashData.reload();
  });

  const { refresh, isRefreshing } = useSmartRefresh(async () => {
    const result = await dashData.reload();
    let message = "Dashboard updated.";
    if (!result.changed) message = "Everything is up to date.";
    else if (result.delta > 0)
      message = `${result.delta} new pending task${result.delta === 1 ? "" : "s"} found.`;
    else if (result.delta < 0)
      message = `Queue updated — ${Math.abs(result.delta)} task${Math.abs(result.delta) === 1 ? "" : "s"} resolved.`;

    return {
      changed: result.changed,
      message,
    };
  });

  const user = getAuthUser();
  const firstName =
    user?.first_name?.trim() || user?.full_name?.split(" ")[0] || "there";

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const [activeChartIndex, setActiveChartIndex] = React.useState(0);
  const handleCarouselScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const scrollLeft = container.scrollLeft;
    const width = container.clientWidth;
    if (width > 0) {
      setActiveChartIndex(Math.round(scrollLeft / width));
    }
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
      {/* ── Page header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-surface-400 dark:bg-surface-600 px-4 sm:px-5 py-3 sm:py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 leading-none">
              {today}
            </p>
            <h1 className="mt-1 text-sm sm:text-base font-display font-bold text-slate-900 dark:text-slate-100 leading-tight truncate">
              {greeting}<span className="hidden sm:inline">, {firstName}</span>
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Period Toggle */}
            <div className="flex items-center rounded-sm border border-slate-200 bg-white p-0.5 dark:border-surface-400 dark:bg-surface-500 relative">
              <button
                type="button"
                onClick={() => setPeriod("today")}
                className={`relative px-2 sm:px-2.5 py-1 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors rounded-xs flex items-center justify-center min-w-[32px] sm:min-w-0 z-0 ${
                  period === "today"
                    ? "text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="Today"
              >
                {period === "today" && (
                  <motion.div
                    layoutId="active-period"
                    className="absolute inset-0 bg-sky-50 dark:bg-sky-950/30 rounded-xs -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <div className="md:hidden relative flex items-center justify-center z-10">
                  <Calendar className="h-4 w-4 stroke-[2.5]" />
                  <span className="absolute text-[7px] font-black pt-1.5 leading-none">1</span>
                </div>
                <span className="hidden md:inline z-10">Today</span>
              </button>
              
              <button
                type="button"
                onClick={() => setPeriod("this_week")}
                className={`relative px-2 sm:px-2.5 py-1 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors rounded-xs flex items-center justify-center min-w-[32px] sm:min-w-0 z-0 ${
                  period === "this_week"
                    ? "text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="This Week"
              >
                {period === "this_week" && (
                  <motion.div
                    layoutId="active-period"
                    className="absolute inset-0 bg-sky-50 dark:bg-sky-950/30 rounded-xs -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <div className="md:hidden relative flex items-center justify-center z-10">
                  <Calendar className="h-4 w-4 stroke-[2.5]" />
                  <span className="absolute text-[7px] font-black pt-1.5 leading-none">7</span>
                </div>
                <span className="hidden md:inline z-10">Week</span>
              </button>

              <button
                type="button"
                onClick={() => setPeriod("all")}
                className={`relative px-2 sm:px-2.5 py-1 text-[10px] sm:text-[10px] font-bold uppercase tracking-wider transition-colors rounded-xs flex items-center justify-center min-w-[32px] sm:min-w-0 z-0 ${
                  period === "all"
                    ? "text-sky-600 dark:text-sky-400 shadow-xs"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
                title="All Time"
              >
                {period === "all" && (
                  <motion.div
                    layoutId="active-period"
                    className="absolute inset-0 bg-sky-50 dark:bg-sky-950/30 rounded-xs -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.4 }}
                  />
                )}
                <CalendarDays className="h-4 w-4 md:hidden stroke-[2.5] z-10" />
                <span className="hidden md:inline z-10">All</span>
              </button>
            </div>


            <PageActions>
              <RefreshAction onRefresh={refresh} loading={isRefreshing} />
            </PageActions>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-surface-600/50">
        <div className="px-3.5 sm:px-5 py-4 space-y-3.5 sm:space-y-4">
          {isAdmin ? (
            <AdminDashboard {...dashData} navigate={navigate} announcements={announcements} />
          ) : isAuditor(role) ? (
            <AuditorDashboard {...dashData} navigate={navigate} announcements={announcements} />
          ) : isQA(role) ? (
            <QADashboard 
              {...dashData} 
              navigate={navigate} 
              announcements={announcements} 
              onCarouselScroll={handleCarouselScroll} 
              activeIndex={activeChartIndex}
            />
          ) : (
            <OfficeDashboard {...dashData} navigate={navigate} role={role} announcements={announcements} />
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
