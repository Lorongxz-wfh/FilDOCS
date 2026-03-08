import React from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Alert from "../components/ui/Alert";
import Button from "../components/ui/Button";
import Skeleton from "../components/ui/loader/Skeleton";

// Shared charts
import StatusDonutChart from "../components/charts/StatusDonutChart";
import ComplianceClusterBarChart from "../components/charts/ComplianceClusterBarChart";
import VolumeTrendChart from "../components/charts/VolumeTrendChart";
import StageDelayChart from "../components/charts/StageDelayChart";

// Shared dashboard components
import DashboardGreeting from "../components/dashboard/DashboardGreeting";
import DashboardStatRow from "../components/dashboard/DashboardStatRow";
import DashboardPendingList from "../components/dashboard/DashboardPendingList";
import DashboardRecentActivity from "../components/dashboard/DashboardRecentActivity";

// Admin-only components
import AdminStatGrid from "../components/dashboard/AdminStatGrid";
import AdminUsersByRoleChart from "../components/dashboard/AdminUsersByRoleChart";
import AdminRecentUsers from "../components/dashboard/AdminRecentUsers";
import AdminActivityBarChart from "../components/dashboard/AdminActivityBarChart";

import { useDashboardData } from "../hooks/useDashboardData";
import {
  getUserRole,
  isQA,
  isOfficeStaff,
  isOfficeHead,
} from "../lib/roleFilters";

// ─── Shared card wrapper ───────────────────────────────────────────────────
const Card: React.FC<{
  title: string;
  sub?: string;
  link?: { label: string; to: string };
  children: React.ReactNode;
  className?: string;
  onLinkClick?: () => void;
}> = ({ title, sub, link, children, className = "", onLinkClick }) => (
  <div
    className={`rounded-2xl border border-slate-200 bg-white px-6 py-5 dark:border-surface-400 dark:bg-surface-500 ${className}`}
  >
    <div className="mb-4 flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        {sub && (
          <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
        )}
      </div>
      {link && (
        <button
          type="button"
          onClick={onLinkClick}
          className="shrink-0 text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
        >
          {link.label} →
        </button>
      )}
    </div>
    {children}
  </div>
);

// ─── QA Dashboard ─────────────────────────────────────────────────────────
const QADashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
  }
> = ({
  stats,
  pending,
  monitoring,
  recentActivity,
  report,
  loading,
  navigate,
}) => {
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
    <div className="space-y-5">
      <DashboardStatRow
        role="QA"
        stats={stats}
        pendingCount={pending.length}
        monitoringCount={monitoring.length}
        loading={loading}
      />

      {/* Row 1: Volume trend + Stage delay */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="Document volume"
          sub="Created vs approved per month."
          link={{ label: "Full reports", to: "/reports" }}
          onLinkClick={() => navigate("/reports")}
        >
          {loading ? (
            <Skeleton className="h-44 w-full rounded-xl" />
          ) : (
            <VolumeTrendChart data={report.volume_series} height={180} />
          )}
        </Card>
        <Card
          title="Stage delay"
          sub="Average processing time per workflow stage."
          link={{ label: "Full reports", to: "/reports" }}
          onLinkClick={() => navigate("/reports")}
        >
          {loading ? (
            <Skeleton className="h-44 w-full rounded-xl" />
          ) : (
            <StageDelayChart data={report.stage_delays} height={180} />
          )}
        </Card>
      </div>

      {/* Row 2: Donut + Cluster bar */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="Document summary"
          sub="Status breakdown across all documents."
          link={{ label: "Open library", to: "/documents" }}
          onLinkClick={() => navigate("/documents")}
        >
          {loading ? (
            <div className="flex items-center gap-6">
              <Skeleton className="h-40 w-40 rounded-full" />
              <div className="space-y-3 flex-1">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
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
        <Card
          title="Workflow by cluster"
          sub="Document status per office cluster."
          link={{ label: "Full reports", to: "/reports" }}
          onLinkClick={() => navigate("/reports")}
        >
          {loading ? (
            <Skeleton className="h-44 w-full rounded-xl" />
          ) : (
            <ComplianceClusterBarChart height={180} data={report.clusters} />
          )}
        </Card>
      </div>

      {/* KPI strip */}
      {report.kpis && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            {
              label: "Total created",
              value: report.kpis.total_created,
              suffix: "",
            },
            {
              label: "Final approved",
              value: report.kpis.total_approved_final,
              suffix: "",
            },
            {
              label: "First-pass yield",
              value: report.kpis.first_pass_yield_pct.toFixed(1),
              suffix: "%",
            },
            {
              label: "Ping-pong ratio",
              value: report.kpis.pingpong_ratio.toFixed(2),
              suffix: "x",
            },
            {
              label: "Avg cycle time",
              value: report.kpis.cycle_time_avg_days.toFixed(1),
              suffix: "d",
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-500"
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {kpi.label}
              </p>
              {loading ? (
                <Skeleton className="mt-2 h-6 w-16" />
              ) : (
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                  {kpi.value}
                  <span className="text-sm font-normal text-slate-400">
                    {kpi.suffix}
                  </span>
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Row 3: Pending + Activity */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DashboardPendingList items={pending} loading={loading} />
        <DashboardRecentActivity logs={recentActivity} loading={loading} />
      </div>
    </div>
  );
};

// ─── Office Dashboard ──────────────────────────────────────────────────────
const OfficeDashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
    role: ReturnType<typeof getUserRole>;
  }
> = ({ stats, pending, recentActivity, loading, navigate, role }) => {
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
    <div className="space-y-5">
      <DashboardStatRow
        role={role}
        stats={stats}
        pendingCount={pending.length}
        monitoringCount={0}
        loading={loading}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="My document summary"
          sub="Status of documents assigned to your office."
          link={{ label: "Open library", to: "/documents" }}
          onLinkClick={() => navigate("/documents")}
        >
          {loading ? (
            <div className="flex items-center gap-6">
              <Skeleton className="h-40 w-40 rounded-full" />
              <div className="space-y-3 flex-1">
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

        <Card title="Quick actions">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "View my documents", path: "/documents", icon: "📄" },
              { label: "Work queue", path: "/work-queue", icon: "📋" },
              {
                label: "Document requests",
                path: "/document-requests",
                icon: "📨",
              },
              { label: "Activity logs", path: "/activity-logs", icon: "🕒" },
            ].map((item) => (
              <button
                key={item.path}
                type="button"
                onClick={() => navigate(item.path)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100 dark:border-surface-400 dark:bg-surface-600 dark:hover:bg-surface-400"
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DashboardPendingList items={pending} loading={loading} />
        <DashboardRecentActivity logs={recentActivity} loading={loading} />
      </div>
    </div>
  );
};

// ─── Admin Dashboard ───────────────────────────────────────────────────────
const AdminDashboard: React.FC<
  ReturnType<typeof useDashboardData> & {
    navigate: ReturnType<typeof useNavigate>;
  }
> = ({ adminStats, recentActivity, loading, navigate }) => (
  <div className="space-y-5">
    <AdminStatGrid data={adminStats} loading={loading} />

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card
        title="System activity"
        sub="Total actions logged per month."
        link={{ label: "View all activity", to: "/activity-logs" }}
        onLinkClick={() => navigate("/activity-logs")}
      >
        {loading ? (
          <Skeleton className="h-44 w-full rounded-xl" />
        ) : (
          <AdminActivityBarChart
            data={adminStats?.activity_series ?? []}
            height={180}
          />
        )}
      </Card>
      <Card
        title="Users by role"
        sub="Distribution of user roles in the system."
        link={{ label: "Manage users", to: "/admin/users" }}
        onLinkClick={() => navigate("/admin/users")}
      >
        {loading ? (
          <div className="flex items-center gap-6">
            <Skeleton className="h-36 w-36 rounded-full" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
        ) : (
          <AdminUsersByRoleChart data={adminStats?.users.by_role ?? []} />
        )}
      </Card>
    </div>

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card
        title="Recent registrations"
        sub="Latest user accounts created."
        link={{ label: "Manage users", to: "/admin/users" }}
        onLinkClick={() => navigate("/admin/users")}
      >
        <AdminRecentUsers
          users={adminStats?.users.recent ?? []}
          loading={loading}
        />
      </Card>
      <DashboardRecentActivity logs={recentActivity} loading={loading} />
    </div>
  </div>
);

// ─── Root ──────────────────────────────────────────────────────────────────
const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const role = getUserRole();
  const dashData = useDashboardData(role);
  const { loading, error } = dashData;

  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const canCreate = isQA(role) || isOfficeStaff(role) || isOfficeHead(role);

  return (
    <PageFrame
      title="Dashboard"
      right={
        canCreate ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate("/documents/create")}
          >
            + New document
          </Button>
        ) : undefined
      }
      contentClassName="space-y-5"
    >
      {error && <Alert variant="danger">{error}</Alert>}
      <DashboardGreeting
        pendingCount={dashData.pending.length}
        loading={loading}
      />

      {isAdmin ? (
        <AdminDashboard {...dashData} navigate={navigate} />
      ) : isQA(role) ? (
        <QADashboard {...dashData} navigate={navigate} />
      ) : (
        <OfficeDashboard {...dashData} navigate={navigate} role={role} />
      )}
    </PageFrame>
  );
};

export default DashboardPage;
