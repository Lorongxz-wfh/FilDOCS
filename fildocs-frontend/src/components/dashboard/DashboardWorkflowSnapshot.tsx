import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader } from "../ui/Card";
import ComplianceClusterBarChart from "../charts/ComplianceClusterBarChart";
import { ChartSkeleton } from "../ui/loader/ChartSkeleton";
import type { ComplianceReportResponse } from "../../services/documents";

type Props = {
  report: ComplianceReportResponse | null;
  loading: boolean;
};

const DashboardWorkflowSnapshot: React.FC<Props> = ({ report, loading }) => {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader 
        title="Workflow snapshot" 
        subtitle="Document status by office cluster." 
        right={
          <button
            type="button"
            onClick={() => navigate("/reports")}
            className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400"
          >
            Full reports →
          </button>
        }
      />
      <CardBody>
        {loading ? (
          <ChartSkeleton type="bar" height={220} className="w-full" />
        ) : (
          <ComplianceClusterBarChart
            height={220}
            data={report?.clusters ?? []}
          />
        )}
      </CardBody>
    </Card>
  );
};

export default DashboardWorkflowSnapshot;
