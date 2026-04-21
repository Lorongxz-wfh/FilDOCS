import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getAuthUser } from "../../lib/auth";
import PageFrame from "../../components/layout/PageFrame";
import ActivityCalendar from "../../components/activityLogs/ActivityCalendar";
import ActivityDetailModal from "../../components/activityLogs/ActivityDetailModal";
import Alert from "../../components/ui/Alert";
import { useActivityLogs } from "../../hooks/useActivityLogs";
import ActivityLogsHeader from "../../components/activityLogs/ActivityLogsHeader";
import ActivityLogsFilters from "../../components/activityLogs/ActivityLogsFilters";
import ActivityLogsTable from "../../components/activityLogs/ActivityLogsTable";
import { useSmartRefresh } from "../../hooks/useSmartRefresh";
import { getDocumentVersion } from "../../services/documents";
import type { ActivityLogItem } from "../../services/types";

type TabView = "log" | "calendar";

const ActivityLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const me = getAuthUser();
  const isOfficeHead = me?.role === "OFFICE_HEAD";

  const [tab, setTab] = React.useState<TabView>("log");
  const [selectedRow, setSelectedRow] = React.useState<ActivityLogItem | null>(null);
  const [exportError, setExportError] = React.useState<string | null>(null);

  const {
    params,
    updateParams,
    rows,
    setPage,
    hasMore,
    loading,
    initialLoading,
    error,
    refresh: internalRefresh,
  } = useActivityLogs({
    scope: isOfficeHead ? "office" : "all",
  });

  useSmartRefresh(async () => {
    const res = await internalRefresh();
    return {
      changed: !!res?.changed,
      message: res?.changed ? "Activity logs synchronized." : "Logs are up to date."
    };
  });

  const handleRowNavigate = async (row: any) => {
    if (row.meta?.document_request_id) {
      navigate(`/document-requests/${row.meta.document_request_id}`);
      return;
    }
    if (row.document_version_id) {
      try {
        const { document } = await getDocumentVersion(Number(row.document_version_id));
        navigate(`/documents/${document.id}`, { state: { from: "/activity-logs" } });
      } catch { /* silent */ }
      return;
    }
    if (row.document_id) {
      navigate(`/documents/${row.document_id}`, { state: { from: "/activity-logs" } });
    }
  };

  const [exporting, setExporting] = React.useState(false);
  const handleExport = async (format: "csv" | "pdf") => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      const { exportActivityLogs } = await import("../../services/activityApi");
      const { exportActivityCsv, exportActivityPdf } = await import("../../services/activityExport");

      const data = await exportActivityLogs({
        scope: params.scope,
        q: params.q.trim() || undefined,
        category: params.category || undefined,
        date_from: params.dateFrom || undefined,
        date_to: params.dateTo || undefined,
        sort_by: params.sortBy,
        sort_dir: params.sortDir,
      });

      if (format === "csv") await exportActivityCsv(data);
      else await exportActivityPdf(data);
    } catch (e: any) {
      setExportError(e?.message ?? "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  if (!me) return <Navigate to="/login" replace />;

  return (
    <PageFrame
      title="Activity Logs"
      contentClassName="flex flex-col min-h-0 h-full"
      right={
        <ActivityLogsHeader
          tab={tab}
          setTab={setTab}
          onExport={handleExport}
          exporting={exporting}
          disabled={initialLoading}
        />
      }
    >
      {tab === "calendar" ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <ActivityCalendar scope={params.scope} />
        </div>
      ) : (
        <>
          <ActivityLogsFilters
            params={params}
            updateParams={updateParams}
            isOfficeHead={isOfficeHead}
            officeName={me.office?.name}
            onClear={() => updateParams({
              scope: "all",
              category: "",
              q: "",
              dateFrom: "",
              dateTo: "",
            })}
          />

          {(error || exportError) && (
            <div className="pt-2">
              <Alert variant="danger">{error || exportError}</Alert>
            </div>
          )}

          <ActivityLogsTable
            rows={rows}
            loading={loading}
            initialLoading={initialLoading}
            hasMore={hasMore}
            onLoadMore={() => setPage((p) => p + 1)}
            onRowClick={(r) => setSelectedRow(r)}
            error={error}
            sortBy={params.sortBy}
            sortDir={params.sortDir}
            onSortChange={(key, dir) => updateParams({ sortBy: key as any, sortDir: dir })}
            emptyMessage={params.q || params.category || params.dateFrom || params.dateTo ? "No logs match your filters." : "No logs found."}
          />
        </>
      )}

      {selectedRow && (
        <ActivityDetailModal
          row={selectedRow}
          onClose={() => setSelectedRow(null)}
          onNavigate={handleRowNavigate}
        />
      )}
    </PageFrame>
  );
};

export default ActivityLogsPage;
