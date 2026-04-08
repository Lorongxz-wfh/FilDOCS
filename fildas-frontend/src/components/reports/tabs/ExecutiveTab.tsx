import React from "react";
import { ShieldCheck, TrendingUp, Landmark, FileCheck } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import VolumeTrendChart from "../../charts/VolumeTrendChart";
import PhaseDistributionChart from "../../charts/PhaseDistributionChart";

interface ExecutiveTabProps {
  loading: boolean;
  stats: any;
}

const ExecutiveTab: React.FC<ExecutiveTabProps> = ({ loading, stats }) => {
  const { kpis, volumeSeries, phaseDist, creationByOffice } = stats;

  const yieldRating = kpis.first_pass_yield_pct > 90 ? "Excellence" : kpis.first_pass_yield_pct > 75 ? "Target" : "Monitoring";
  const officesCount = creationByOffice?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
         <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
               <ShieldCheck className="h-5 w-5 text-brand-500" />
               Institutional Executive Summary
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">High-level institutional health and efficiency metrics</p>
         </div>
         <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-4 py-2">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block tracking-wider">Quality Score</span>
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
               {loading ? "..." : `${kpis.first_pass_yield_pct}%`}
            </span>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard
            loading={loading}
            label="Ping-Pong Ratio"
            value={kpis.pingpong_ratio}
            sub="Avg return events per doc"
            icon={<TrendingUp size={16} className="text-sky-500" />}
            iconBg="bg-sky-50 dark:bg-sky-900/20"
          />
          <KpiCard
            loading={loading}
            label="Total Archives"
            value={kpis.total_approved_final}
            sub="Official university records"
            icon={<Landmark size={16} className="text-stone-500" />}
            iconBg="bg-stone-50 dark:bg-stone-900/20"
          />
          <KpiCard
            loading={loading}
            label="Yield Rating"
            value={yieldRating}
            sub="First-pass distribution rate"
            icon={<FileCheck size={16} className="text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-900/20"
          />
          <KpiCard
            loading={loading}
            label="Active Offices"
            value={officesCount}
            sub="Participating departments"
            icon={<ShieldCheck size={16} className="text-brand-500" />}
            iconBg="bg-brand-50 dark:bg-brand-900/20"
          />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2">
            <ReportChartCard
               title="Institutional Document Flux"
               subtitle="System-wide document lifecycle trends"
               loading={loading}
            >
               <VolumeTrendChart data={volumeSeries} height={300} loading={loading} />
            </ReportChartCard>
         </div>
         <div className="lg:col-span-1">
            <ReportChartCard
               title="University Pulse"
               subtitle="Where are we moving right now?"
               loading={loading}
            >
               <PhaseDistributionChart data={phaseDist} variant="donut" height={300} loading={loading} />
            </ReportChartCard>
         </div>
      </div>
    </div>
  );
};

export default ExecutiveTab;
