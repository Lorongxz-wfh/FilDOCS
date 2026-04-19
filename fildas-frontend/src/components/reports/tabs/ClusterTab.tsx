import React from "react";
import { Users, TrendingUp, Award, BarChart3 } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import OfficeComplianceTable from "../../charts/OfficeComplianceTable";
import ComplianceClusterBarChart from "../../charts/ComplianceClusterBarChart";

interface ClusterTabProps {
  loading: boolean;
  stats: any;
  parent: string;
}

const ClusterTab: React.FC<ClusterTabProps> = ({ loading, stats, parent }) => {
  const { offices, clusters } = stats;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-brand-500" /> Cluster Performance: {parent}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Departmental breakdown and compliance benchmarks
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportChartCard
          title="Office document breakdown"
          subtitle="Documents in review, approved, and returned per office."
          loading={loading}
        >
          <OfficeComplianceTable data={offices} loading={loading} />
        </ReportChartCard>
        <ReportChartCard
          title="Compliance Benchmarks"
          subtitle="Institutional requirement adherence per office"
          loading={loading}
        >
          <ComplianceClusterBarChart data={clusters} loading={loading} height={350} />
        </ReportChartCard>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard
          loading={loading}
          label="Cluster Leader"
          value="HR"
          icon={<Award size={16} className="text-brand-500" />}
          iconBg="bg-brand-50 dark:bg-brand-900/20"
        />
        <KpiCard
          loading={loading}
          label="Avg Processing Time"
          value="4.2d"
          icon={<TrendingUp size={16} className="text-sky-500" />}
          iconBg="bg-sky-50 dark:bg-sky-900/20"
        />
        <KpiCard
          loading={loading}
          label="Total Offices"
          value={offices?.length ?? 0}
          icon={<BarChart3 size={16} className="text-amber-500" />}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
        />
      </div>
    </div>
  );
};

export default ClusterTab;
