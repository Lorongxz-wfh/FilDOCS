import React from "react";
import { FileText, CheckCircle2, Activity, TrendingUp, History, Percent, Clock, RotateCcw } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import VolumeTrendChart from "../../charts/VolumeTrendChart";
import PhaseDistributionChart from "../../charts/PhaseDistributionChart";
import StageDelayChart from "../../charts/StageDelayChart";
import ActivityDistributionChart from "../../charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../../charts/DailyActivityStackedBarChart";
import { type Bucket } from "../ReportFilters";

interface OverviewTabProps {
  loading: boolean;
  activityLoading: boolean;
  qaMode: boolean;
  role: string | null;
  bucket: Bucket;
  stats: any;
  ongoingCount: number;
  activityReport: any;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  loading,
  activityLoading,
  qaMode,
  role,
  bucket,
  stats,
  ongoingCount,
  activityReport,
}) => {
  const {
    kpis,
    volumeSeries,
    phaseDist,
    stageDelaysByPhase,
  } = stats;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <KpiCard
          loading={loading}
          label="All documents"
          value={kpis.total_created}
          sub="All versions ever created"
          icon={<FileText size={16} className="text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-900/30"
        />
        <KpiCard
          loading={loading}
          label="Distributed"
          value={kpis.total_approved_final}
          sub="Latest versions fully distributed"
          icon={<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          loading={loading}
          label="Ongoing"
          value={ongoingCount}
          sub="Documents currently in progress"
          icon={<Activity size={16} className="text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
        />
      </div>

      {/* Volume trend + Phase donut side by side */}
      <div className="relative group/snap">
        <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
          <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
            <TrendingUp size={12} className="text-sky-500 rotate-90" />
          </div>
        </div>
        <div className="grid grid-flow-col lg:grid-flow-row lg:grid-cols-3 gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
          <div className="min-w-[85vw] lg:min-w-0 lg:col-span-2 snap-center">
            <ReportChartCard
              title={`Document volume · ${bucket}`}
              subtitle="Created vs distributed per period"
              loading={loading}
            >
              <VolumeTrendChart data={volumeSeries} height={220} loading={loading} />
            </ReportChartCard>
          </div>
          <div className="min-w-[85vw] lg:min-w-0 lg:col-span-1 snap-center">
            <ReportChartCard
              title="Documents by phase"
              subtitle="Current status of documents in selected period"
              loading={loading}
            >
              <PhaseDistributionChart data={phaseDist} variant="donut" height={220} />
            </ReportChartCard>
          </div>
        </div>
      </div>

      {/* Secondary KPI row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          loading={loading}
          label="First pass yield"
          value={`${kpis.first_pass_yield_pct}%`}
          sub="Docs distributed with zero returns"
          icon={<Percent size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          loading={loading}
          label="Avg cycle time"
          value={`${kpis.cycle_time_avg_days}d`}
          sub="Draft to distributed, avg days"
          icon={<Clock size={16} className="text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-900/30"
        />
        <KpiCard
          loading={loading}
          label="Ping-pong ratio"
          value={kpis.pingpong_ratio}
          sub="Avg return events per document"
          icon={<RotateCcw size={16} className="text-rose-500 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-900/30"
        />
      </div>

      {/* Stage delays by phase */}
      <ReportChartCard
        title="Stage delay by phase"
        subtitle="Median task hold time per workflow phase"
        loading={loading}
      >
        <StageDelayChart data={stageDelaysByPhase} height={160} loading={loading} />
      </ReportChartCard>

      {/* Activity Summary */}
      {(qaMode || role === "ADMIN" || role === "SYSADMIN") && (
        <div className="relative group/snap">
          <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
            <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
              <History size={12} className="text-amber-500 rotate-90" />
            </div>
          </div>
          <div className="grid grid-flow-col lg:grid-flow-row lg:grid-cols-2 gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
            <div className="min-w-[85vw] lg:min-w-0 snap-center">
              <ReportChartCard
                title="System Activity Breakdown"
                subtitle="Distribution by category in selected period"
                loading={activityLoading}
              >
                <ActivityDistributionChart
                  data={activityReport?.distribution ?? []}
                  height={180}
                  loading={activityLoading}
                />
              </ReportChartCard>
            </div>
            <div className="min-w-[85vw] lg:min-w-0 snap-center">
              <ReportChartCard
                title="Activity Trend"
                subtitle="Daily volume across categories"
                loading={activityLoading}
              >
                <DailyActivityStackedBarChart
                  data={activityReport?.daily_trend ?? []}
                  height={180}
                  loading={activityLoading}
                />
              </ReportChartCard>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
