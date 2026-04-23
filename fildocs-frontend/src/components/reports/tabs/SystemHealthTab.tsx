import React from "react";
import { ShieldCheck, Zap, HeartPulse, Terminal, AlertTriangle } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import ActivityDistributionChart from "../../charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../../charts/DailyActivityStackedBarChart";
import SubmissionAttemptsChart from "../../charts/SubmissionAttemptsChart";

interface SystemHealthTabProps {
  loading: boolean;
  activityReport: any;
}

const SystemHealthTab: React.FC<SystemHealthTabProps> = ({ loading, activityReport }) => {
  // Extract stats from activityReport
  const activityData = activityReport?.distribution ?? [];
  const trendData = activityReport?.daily_trend ?? [];
  const alerts = activityReport?.alerts ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Primary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <KpiCard
          loading={loading}
          label="System Status"
          value="Operational"
          icon={<ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          loading={loading}
          label="Activity Load"
          value={activityReport?.total_actions ?? 0}
          icon={<Zap size={16} className="text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
        />
        <KpiCard
          loading={loading}
          label="Top Contributor"
          value={activityReport?.top_actors?.length ? activityReport.top_actors[0].office : "None"}
          icon={<HeartPulse size={16} className="text-rose-600 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Distribution */}
        <div className="lg:col-span-1">
          <ReportChartCard title="Activity Centers" subtitle="Distribution of actions by type" loading={loading} skeletonType="donut">
            <ActivityDistributionChart data={activityData} height={280} loading={loading} />
          </ReportChartCard>
        </div>

        {/* Traffic Trend */}
        <div className="lg:col-span-2">
          <ReportChartCard
            title="System Traffic"
            subtitle="Categorized activity volume (14-day trend)"
            loading={loading}
            action={
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surface-400 text-[10px] font-semibold text-slate-500 uppercase">
                <Terminal size={10} /> Live Logs
              </div>
            }
          >
            <DailyActivityStackedBarChart data={trendData} height={280} loading={loading} />
          </ReportChartCard>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reliability Chart */}
        <ReportChartCard
          title="Engine Reliability"
          subtitle="Success vs. failed automated processing"
          loading={loading}
        >
          <SubmissionAttemptsChart data={activityReport?.submission_attempts ?? []} height={220} loading={loading} />
        </ReportChartCard>

        {/* Technical Alerts Summary */}
        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-surface-400 dark:bg-surface-500">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-emerald-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-50">System Logs</h3>
          </div>

          <div className="space-y-2 min-h-[100px] flex flex-col justify-center">
            {!alerts.length ? (
              <div className="text-center py-4">
                <p className="text-xs text-slate-400 font-medium">No critical system events detected in current period.</p>
              </div>
            ) : (
              alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-start justify-between gap-3 group">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 h-1.5 w-1.5 rounded-full ${
                        alert.type === "warning" ? "bg-amber-500" : "bg-sky-500"
                      }`}
                    />
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors">
                      {alert.msg}
                    </p>
                  </div>
                  <span className="text-[10px] whitespace-nowrap text-slate-400 font-medium">{alert.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemHealthTab;
