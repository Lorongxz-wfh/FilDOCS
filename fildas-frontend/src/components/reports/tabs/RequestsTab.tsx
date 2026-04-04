import React from "react";
import { Send, CheckCircle2, Activity, AlertCircle, Ban, TrendingUp, RotateCcw } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import VolumeTrendChart from "../../charts/VolumeTrendChart";
import PhaseDistributionChart from "../../charts/PhaseDistributionChart";
import { type Bucket } from "../ReportFilters";

interface RequestsTabProps {
  requestsLoading: boolean;
  requestsReport: any;
  bucket: Bucket;
}

const RequestsTab: React.FC<RequestsTabProps> = ({
  requestsLoading,
  requestsReport,
  bucket,
}) => {
  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          loading={requestsLoading}
          label="Total requests"
          value={requestsReport?.kpis.total ?? 0}
          sub="All requests submitted"
          icon={<Send size={16} className="text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-900/30"
        />
        <KpiCard
          loading={requestsLoading}
          label="Accepted"
          value={requestsReport?.kpis.closed ?? 0}
          sub="Requests fulfilled and closed"
          icon={<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          loading={requestsLoading}
          label="Pending"
          value={requestsReport?.kpis.open ?? 0}
          sub="Currently open requests"
          icon={<Activity size={16} className="text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
        />
        <KpiCard
          loading={requestsLoading}
          label="Overdue"
          value={requestsReport?.kpis.overdue ?? 0}
          sub="Past expected response date"
          icon={<AlertCircle size={16} className="text-rose-500 dark:text-rose-400" />}
          iconBg="bg-rose-50 dark:bg-rose-900/30"
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          loading={requestsLoading}
          label="Cancelled"
          value={requestsReport?.kpis.cancelled ?? 0}
          sub="Requests withdrawn by requester"
          icon={<Ban size={16} className="text-slate-500 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-surface-400"
        />
        <KpiCard
          loading={requestsLoading}
          label="Acceptance rate"
          value={`${requestsReport?.kpis.acceptance_rate ?? 0}%`}
          sub="Accepted out of total submitted"
          icon={<TrendingUp size={16} className="text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-900/30"
        />
        <KpiCard
          loading={requestsLoading}
          label="Avg resubmissions"
          value={requestsReport?.kpis.avg_resubmissions ?? 0}
          sub="Avg attempts per request"
          icon={<RotateCcw size={16} className="text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
        />
      </div>

      {/* Volume trend + Status donut */}
      <div className="grid grid-flow-col lg:grid-flow-row lg:grid-cols-3 gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="min-w-[85vw] lg:min-w-0 lg:col-span-2 snap-center">
          <ReportChartCard
            title={`Request volume · ${bucket}`}
            subtitle="Requests created vs accepted per period"
            loading={requestsLoading}
          >
            <VolumeTrendChart
              data={(requestsReport?.volume_series ?? []).map((d: any) => ({
                label: d.label,
                created: d.created,
                approved_final: d.approved_final,
              }))}
              height={220}
              loading={requestsLoading}
            />
          </ReportChartCard>
        </div>
        <div className="min-w-[85vw] lg:min-w-0 lg:col-span-1 snap-center">
          <ReportChartCard
            title="Request status"
            subtitle="Open · Closed · Cancelled breakdown"
            loading={requestsLoading}
          >
            <PhaseDistributionChart data={requestsReport?.status_distribution ?? []} variant="donut" height={220} />
          </ReportChartCard>
        </div>
      </div>
    </div>
  );
};

export default RequestsTab;
