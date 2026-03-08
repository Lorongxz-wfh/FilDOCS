import React from "react";
import { useNavigate } from "react-router-dom";
import { CardBody, CardHeader } from "../ui/Card";
import ComplianceClusterBarChart from "../charts/ComplianceClusterBarChart";
import Skeleton from "../ui/loader/Skeleton";
import type { ComplianceReportResponse } from "../../services/documents";

type Props = {
  report: ComplianceReportResponse | null;
  loading: boolean;
};

const DashboardWorkflowSnapshot: React.FC<Props> = ({ report, loading }) => {
  const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Workflow snapshot
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Document status by office cluster.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Full reports →
          </button>
        </div>
      </CardHeader>
      <CardBody>
        {loading ? (
          <Skeleton className="h-56 w-full rounded-xl" />
        ) : (
          <ComplianceClusterBarChart
            height={220}
            data={report?.clusters ?? []}
          />
        )}
      </CardBody>
    </div>
  );
};

export default DashboardWorkflowSnapshot;
