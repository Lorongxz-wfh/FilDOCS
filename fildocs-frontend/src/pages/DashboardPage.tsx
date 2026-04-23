import React from "react";
import { useNavigate } from "react-router-dom";
import Skeleton from "../components/ui/loader/Skeleton";
import DatePresetSwitcher, { type PresetOption } from "../components/ui/DatePresetSwitcher";
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
import { Card, CardHeader, CardBody } from "../components/ui/Card";

// Admin-only components
import AdminStatGrid from "../components/dashboard/AdminStatGrid";
import AdminDocumentPhaseChart from "../components/dashboard/AdminDocumentPhaseChart";
import ActivityDistributionChart from "../components/charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../components/charts/DailyActivityStackedBarChart";

import { useDashboardData } from "../hooks/useDashboardData";
import { useAnnouncements } from "../hooks/useAnnouncements";
import AnnouncementsBanner from "../components/dashboard/AnnouncementsBanner";
import { useSmartRefresh } from "../hooks/useSmartRefresh";
import { getUserRole, isQA, isAuditor } from "../lib/roleFilters";
import { getAuthUser } from "../lib/auth";
import {
  FolderOpen,
  Calendar,
  CalendarDays,
} from "lucide-react";

const DASHBOARD_PRESETS: PresetOption[] = [
  {
    value: "today",
    label: "Today",
    mobileIcon: <Calendar className="h-4 w-4 stroke-[2.5]" />,
    mobileBadge: "1"
  },
  {
    value: "this_week",
    label: "Week",
    mobileIcon: <Calendar className="h-4 w-4 stroke-[2.5]" />,
    mobileBadge: "7"
  },
  {
    value: "all",
    label: "All",
    mobileIcon: <CalendarDays className="h-4 w-4 stroke-[2.5]" />
  },
];

// ─── Shared announcements prop ─────────────────────────────────────────────
type AnnouncementsHook = ReturnType<typeof useAnnouncements>;

// ─── Dashboard Helper Components Removed (Migrated to src/components/ui/Card.tsx) ────────────────

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
  allTimeRequestsCount,
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
          pendingCount={pending.length}
          pendingWorkflowsCount={stats?.pending_workflows ?? 0}
          openRequestsCount={pendingRequestsCount}
          allTimeWorkflowsCount={stats?.all_time_total ?? 0}
          allTimeRequestsCount={allTimeRequestsCount}
          loading={loading}
          onStatClick={(label) => {
            if (label === "Action needed" || label === "Pending workflows") navigate("/work-queue");
            if (label === "Total workflows" || label === "Distributed") navigate("/documents");
            if (label === "Open requests" || label === "Total requests") navigate("/document-requests");
          }}
        />

        <div className="relative group">
          <div
            onScroll={onCarouselScroll}
            className="flex sm:grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory hide-scrollbar pb-1 sm:pb-0"
          >
            <Card className="min-w-[88vw] sm:min-w-0 snap-center lg:col-span-2">
              <CardHeader 
                title="Document volume" 
                subtitle="Created vs distributed trend" 
                right={
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate("/reports")}
                    className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
                  >
                    View reports →
                  </Button>
                }
              />
              <CardBody className="h-[150px] sm:h-[200px]">
                <VolumeTrendChart
                  data={report.volume_series}
                  height={window.innerWidth < 640 ? 150 : 200}
                  loading={loading}
                />
              </CardBody>
            </Card>

            <Card className="min-w-[88vw] sm:min-w-0 snap-center">
              <CardHeader 
                title="Pipeline state" 
                subtitle="Docs by current phase" 
                right={
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate("/documents")}
                    className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
                  >
                    View library →
                  </Button>
                }
              />
              <CardBody className="h-[150px] sm:h-[200px]">
                <PhaseDistributionChart
                  data={report.phase_distribution ?? []}
                  variant="donut"
                  height={window.innerWidth < 640 ? 150 : 200}
                  loading={loading}
                />
              </CardBody>
            </Card>

            <Card className="min-w-[88vw] sm:min-w-0 snap-center lg:hidden">
              <CardHeader 
                title="Stage delay" 
                subtitle="Median hold time per workflow phase" 
                right={
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => navigate("/reports")}
                    className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
                  >
                    View reports →
                  </Button>
                }
              />
              <CardBody className="h-[150px]">
                <StageDelayChart
                  data={report.stage_delays_by_phase ?? []}
                  height={150}
                  loading={loading}
                />
              </CardBody>
            </Card>
          </div>

          {/* Carousel Indicators */}
          <div className="flex sm:hidden justify-center gap-1.5 mt-2">
            {[...Array(chartCount)].map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${i === activeIndex ? "w-4 bg-sky-500" : "w-1.5 bg-slate-200 dark:bg-surface-400"
                  }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop-only Stage Delay if not in carousel-span above */}
        <div className="hidden lg:grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DashboardPendingList items={pendingActions} loading={loading} hasData={!!pendingActions?.length} />
          <Card>
            <CardHeader 
              title="Stage delay" 
              subtitle="Median hold time per workflow phase" 
              right={
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={() => navigate("/reports")}
                  className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
                >
                  View reports →
                </Button>
              }
            />
            <CardBody className="h-[200px]">
              <StageDelayChart
                data={report.stage_delays_by_phase ?? []}
                height={200}
                loading={loading}
              />
            </CardBody>
          </Card>
        </div>

        {/* Mobile-only Pending list */}
        <div className="lg:hidden mt-1">
          <DashboardPendingList items={pendingActions} loading={loading} hasData={!!pendingActions?.length} />
        </div>

        <DashboardRecentActivity logs={recentActivity} loading={loading} />
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
  announcements,
  pendingRequestsCount,
  allTimeRequestsCount,
  pending,
  onCarouselScroll,
  activeIndex = 0,
}) => {
    const chartCount = 1; // Just one donut chart for office currently, but let's keep it consistent

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
          pendingCount={pending.length}
          pendingWorkflowsCount={stats?.pending_workflows ?? 0}
          openRequestsCount={pendingRequestsCount}
          allTimeWorkflowsCount={stats?.all_time_total ?? 0}
          allTimeRequestsCount={allTimeRequestsCount}
          loading={loading}
          onStatClick={(label) => {
            if (label === "Action needed" || label === "Pending workflows") navigate("/work-queue");
            if (label === "Total workflows" || label === "Distributed") navigate("/documents");
            if (label === "Open requests" || label === "Total requests") navigate("/document-requests");
          }}
        />

        {/* Document summary + pending work queue */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
          <div className="relative group lg:h-full">
            <div
              onScroll={onCarouselScroll}
              className="flex sm:grid grid-cols-1 gap-4 lg:grid-cols-1 overflow-x-auto sm:overflow-visible snap-x snap-mandatory hide-scrollbar pb-1 sm:pb-0 h-full"
            >
              <Card className="min-w-[88vw] sm:min-w-0 snap-center h-full">
                <CardHeader 
                  title="My document summary" 
                  subtitle="Status of documents created by your office." 
                  right={
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => navigate("/documents")}
                      className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
                    >
                      Open library →
                    </Button>
                  }
                />
                <CardBody>
                  <StatusDonutChart
                    segments={donutSegments}
                    centerValue={stats?.total ?? 0}
                    centerLabel="total"
                    size={160}
                    loading={loading}
                  />
                </CardBody>
              </Card>
            </div>

            <div className="flex sm:hidden justify-center gap-1.5 mt-2">
              {[...Array(chartCount)].map((_, i) => (
                <div
                  key={i}
                  className={`h-1 rounded-full transition-all duration-300 ${i === activeIndex ? "w-4 bg-sky-500" : "w-1.5 bg-slate-200 dark:bg-surface-400"
                    }`}
                />
              ))}
            </div>
          </div>

          <div className="h-full">
            <DashboardPendingList items={pendingActions} loading={loading} hasData={!!pendingActions?.length} />
          </div>
        </div>

        {/* Recent activity */}
        <DashboardRecentActivity logs={recentActivity} loading={loading} hasData={!!recentActivity?.length} />
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

    <Card>
      <CardHeader 
        title="Admin overview" 
        subtitle="System-wide document statistics" 
      />
      <CardBody>
        <AdminStatGrid data={adminStats} loading={loading && !adminStats} />
      </CardBody>
    </Card>

    {/* Charts Carousel/Grid */}
    <div className="flex sm:grid grid-cols-1 gap-4 lg:grid-cols-3 overflow-x-auto sm:overflow-visible snap-x snap-mandatory hide-scrollbar pb-1 sm:pb-0">
      <Card className="min-w-[85vw] sm:min-w-0 snap-center lg:col-span-2">
        <CardHeader 
          title="Documents by phase" 
          subtitle="Current workflow stage of all documents." 
          right={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => navigate("/documents")}
              className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
            >
              Open library →
            </Button>
          }
        />
        <CardBody>
          <AdminDocumentPhaseChart
            byPhase={adminStats?.documents.by_phase}
            height={window.innerWidth < 640 ? 160 : 200}
            loading={loading}
          />
        </CardBody>
      </Card>

      <Card className="min-w-[85vw] sm:min-w-0 snap-center">
        <CardHeader 
          title="Action Breakdown" 
          subtitle="System activity distribution." 
          right={
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => navigate("/reports")}
              className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
            >
              View reports →
            </Button>
          }
        />
        <CardBody>
          <ActivityDistributionChart
            data={adminStats?.activity.distribution ?? []}
            height={window.innerWidth < 640 ? 160 : 200}
            loading={loading}
          />
        </CardBody>
      </Card>
    </div>

    <Card>
      <CardHeader 
        title="System Activity Trend" 
        subtitle="Categorized system actions last 14 days." 
        right={
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => navigate("/reports")}
            className="font-semibold text-sky-600 dark:text-sky-400 p-0 hover:bg-transparent"
          >
            View full report →
          </Button>
        }
      />
      <CardBody>
        <DailyActivityStackedBarChart
          data={adminStats?.activity.daily_trend ?? []}
          height={200}
          loading={loading && !adminStats?.activity.daily_trend?.length}
        />
      </CardBody>
    </Card>

    <DashboardRecentActivity logs={recentActivity} loading={loading} hasData={!!recentActivity?.length} />
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
        <Card 
          onClick={() => navigate("/documents")}
          hoverable
        >
          <CardBody>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Distributed Documents
                </p>
                {loading && stats && (
                  <Skeleton className="h-3 w-8" />
                )}
              </div>
              <FolderOpen className="h-4 w-4 text-emerald-400" />
            </div>
            {loading && !stats ? (
              <div className="h-8 w-16 bg-slate-100 dark:bg-surface-400 animate-pulse mt-2 rounded" />
            ) : (
              <p className="mt-2 text-2xl font-display font-semibold text-slate-900 dark:text-slate-100">
                {stats?.distributed ?? 0}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              open library to view documents
            </p>
          </CardBody>
        </Card>
      </div>

      {/* Info + global activity feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="text-center">
          <CardBody className="py-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-50 text-sky-500 dark:bg-sky-950/30 dark:text-sky-400">
              <FolderOpen className="h-7 w-7" />
            </div>
            <h2 className="mt-4 text-sm font-semibold text-slate-900 dark:text-slate-100">
              Read-only Auditor access
            </h2>
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
              Browse and download all fully distributed documents across all offices.
            </p>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => navigate("/documents")}
              className="mt-5 mx-auto"
            >
              Go to Library
            </Button>
          </CardBody>
        </Card>

        <DashboardRecentActivity logs={recentActivity} loading={loading} hasData={!!recentActivity?.length} />
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

  // Page burst refresh deprecated in favor of clean single WebSocket updates.

  useSmartRefresh(async () => {
    // Page-wide synchronized refresh
    const [dashResult] = await Promise.all([
      dashData.reload(),
      announcements.reload()
    ]);

    let message = "Dashboard synchronized.";
    if (!dashResult.changed) message = "Dashboard is up to date.";
    else if (dashResult.delta > 0)
      message = `${dashResult.delta} new pending task${dashResult.delta === 1 ? "" : "s"} found.`;
    else if (dashResult.delta < 0)
      message = `Queue updated — ${Math.abs(dashResult.delta)} task${Math.abs(dashResult.delta) === 1 ? "" : "s"} resolved.`;

    return {
      changed: dashResult.changed,
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400 dark:text-slate-500 leading-none">
              {today}
            </p>
            <h1 className="mt-1 text-sm sm:text-base font-display font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
              {greeting}<span className="hidden sm:inline">, {firstName}</span>
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {/* Period Toggle */}
            <DatePresetSwitcher
              options={DASHBOARD_PRESETS}
              value={period}
              onChange={(val) => setPeriod(val)}
              layoutId="active-period"
            />
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
