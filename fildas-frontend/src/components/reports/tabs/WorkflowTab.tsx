import React from "react";
import { FileText, CheckCircle2, Activity, Clock, TrendingUp } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import VolumeTrendChart from "../../charts/VolumeTrendChart";
import DocumentTypeChart from "../../charts/DocumentTypeChart";
import OfficeCreationChart from "../../charts/OfficeCreationChart";
import WorkflowFunnelChart from "../../charts/WorkflowFunnelChart";
import ReturnByStageChart from "../../charts/ReturnByStageChart";
import Skeleton from "../../ui/loader/Skeleton";
import { type Bucket } from "../ReportFilters";

interface WorkflowTabProps {
  loading: boolean;
  bucket: Bucket;
  stats: any;
  ongoingCount: number;
}

const WorkflowTab: React.FC<WorkflowTabProps> = ({
  loading,
  bucket,
  stats,
  ongoingCount,
}) => {
  const {
    kpis,
    volumeSeries,
    doctypeDist,
    creationByOffice,
    lifecycleFunnel,
    routingSplit,
    revisionStats,
  } = stats;

  return (
    <div className="flex flex-col gap-6">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          loading={loading}
          label="Total created"
          value={kpis.total_created}
          sub="All document versions created"
          icon={<FileText size={16} className="text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-900/30"
        />
        <KpiCard
          loading={loading}
          label="Distributed"
          value={kpis.total_approved_final}
          sub="Fully completed and distributed"
          icon={<CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          loading={loading}
          label="Active"
          value={ongoingCount}
          sub="Documents currently in progress"
          icon={<Activity size={16} className="text-amber-600 dark:text-amber-400" />}
          iconBg="bg-amber-50 dark:bg-amber-900/30"
        />
        <KpiCard
          loading={loading}
          label="Avg cycle time"
          value={`${kpis.cycle_time_avg_days}d`}
          sub="Draft to distributed, avg days"
          icon={<Clock size={16} className="text-slate-500 dark:text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-surface-400"
        />
      </div>

      {/* Volume trend + Document type donut */}
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
              subtitle="Documents created vs distributed per period"
              loading={loading}
            >
              <VolumeTrendChart data={volumeSeries} height={220} loading={loading} />
            </ReportChartCard>
          </div>
          <div className="min-w-[85vw] lg:min-w-0 lg:col-span-1 snap-center">
            <ReportChartCard
              title="By document type"
              subtitle="Internal · External · Forms split"
              loading={loading}
            >
              <DocumentTypeChart data={doctypeDist} height={160} loading={loading} />
            </ReportChartCard>
          </div>
        </div>
      </div>

      {/* Office creation + companion visual */}
      <div className="relative group/snap">
        <div className="sm:hidden absolute right-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none animate-pulse-slow">
          <div className="bg-white/80 dark:bg-surface-600/80 backdrop-blur-sm p-1.5 rounded-full shadow-md border border-slate-200 dark:border-surface-400">
            <TrendingUp size={12} className="text-sky-500 rotate-90" />
          </div>
        </div>
        <div className="grid grid-flow-col lg:grid-flow-row lg:grid-cols-2 gap-4 lg:gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth">
          <div className="min-w-[85vw] lg:min-w-0 snap-center">
            <ReportChartCard
              title="Documents by office"
              subtitle="Ranked by creation volume"
              loading={loading}
            >
              <OfficeCreationChart data={creationByOffice} height={220} loading={loading} />
            </ReportChartCard>
          </div>
          <div className="min-w-[85vw] lg:min-w-0 snap-center">
            <ReportChartCard
              title="Return rate by stage"
              subtitle="Where documents get sent back most"
              loading={loading}
            >
              <ReturnByStageChart data={revisionStats.by_stage ?? []} variant="horizontal" height={220} loading={loading} />
            </ReportChartCard>
          </div>
        </div>
      </div>

      {/* Lifecycle funnel */}
      <ReportChartCard
        title="Document lifecycle funnel"
        subtitle="How many documents pass each stage — creation date range applied"
        loading={loading}
      >
        <WorkflowFunnelChart data={lifecycleFunnel} loading={loading} />
      </ReportChartCard>

      {/* Routing split + Revision stats */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <ReportChartCard
          title="Routing mode"
          subtitle="Documents using default vs custom routing"
          loading={loading}
        >
          <div className="flex flex-col gap-2">
            {[
              { label: "Default flow", value: routingSplit.default_flow, color: "bg-sky-400" },
              { label: "Custom flow", value: routingSplit.custom_flow, color: "bg-violet-400" },
            ].map(({ label, value, color }) => {
              const total = routingSplit.default_flow + routingSplit.custom_flow || 1;
              const pct = Math.round((value / total) * 100);
              return (
                <div key={label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 dark:text-slate-300 font-medium">{label}</span>
                    <span className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                      {value} <span className="text-slate-400 dark:text-slate-500 font-normal">({pct}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </ReportChartCard>

        <ReportChartCard
          title="Revision stats"
          subtitle="How often documents are revised after distribution"
          loading={loading}
        >
          <div className="grid grid-cols-2 gap-3 h-full">
            <div className="flex flex-col items-center justify-center rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 py-4 px-3 text-center">
              {loading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-amber-500 dark:text-amber-400 leading-none">
                  {revisionStats.docs_on_v2_plus}
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                docs revised
                <br />
                (v2 or later)
              </p>
            </div>
            <div className="flex flex-col items-center justify-center rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 py-4 px-3 text-center">
              {loading ? (
                <Skeleton className="h-7 w-12 mb-1" />
              ) : (
                <p className="text-2xl font-bold tabular-nums text-violet-500 dark:text-violet-400 leading-none">
                  {revisionStats.avg_versions}
                </p>
              )}
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 leading-tight">
                avg versions
                <br />
                per document
              </p>
            </div>
          </div>
        </ReportChartCard>
      </div>
    </div>
  );
};

export default WorkflowTab;
