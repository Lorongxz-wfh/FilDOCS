import React from "react";
import { History } from "lucide-react";
import ReportChartCard from "../ReportChartCard";
import ActivityDistributionChart from "../../charts/ActivityDistributionChart";
import DailyActivityStackedBarChart from "../../charts/DailyActivityStackedBarChart";

interface ActivityTabProps {
  activityLoading: boolean;
  activityReport: any;
}

const ActivityTab: React.FC<ActivityTabProps> = ({
  activityLoading,
  activityReport,
}) => {
  return (
    <div className="flex flex-col gap-6">
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
                height={220}
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
                height={220}
                loading={activityLoading}
              />
            </ReportChartCard>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityTab;
