import React from "react";
import { Navigate } from "react-router-dom";
import { useAuthUser } from "../hooks/useAuthUser";
import { getUserRole, isQA } from "../lib/roleFilters";
import PageFrame from "../components/layout/PageFrame";
import ReportFilters from "../components/reports/ReportFilters";
import { useReportsData } from "../hooks/useReportsData";
import { useReportFilters } from "../hooks/useReportFilters";
import { getOffices } from "../services/reportsApi";
import { 
  SlidersHorizontal, 
  BarChart2, 
  FileQuestion, 
  Users, 
  ShieldCheck, 
  HeartPulse,
  X 
} from "lucide-react";
import { Tabs, TabContent } from "../components/ui/Tabs";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import Button from "../components/ui/Button";

// Tab Components
import SystemHealthTab from "../components/reports/tabs/SystemHealthTab";
import UsersTab from "../components/reports/tabs/UsersTab";
import WorkflowTab from "../components/reports/tabs/WorkflowTab";
import RequestsTab from "../components/reports/tabs/RequestsTab";
import ClusterTab from "../components/reports/tabs/ClusterTab";

type Tab = "health" | "users" | "workflow" | "requests" | "compliance";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "health", label: "System Health", icon: <HeartPulse className="h-3.5 w-3.5" /> },
  { key: "users", label: "User Insights", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "workflow", label: "Workflows", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "requests", label: "Requests", icon: <FileQuestion className="h-3.5 w-3.5" /> },
  { key: "compliance", label: "Cluster & Docs", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

const AdminReportsPage: React.FC = () => {
  const me = useAuthUser();
  const role = getUserRole();
  const qaMode = isQA(role);
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";

  const [refreshKey, setRefreshKey] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>("health");
  const [officesList, setOfficesList] = React.useState<{ id: number; name: string; code: string }[]>([]);

  // ── Filter state hook ────────────────────────────────────────────────────────
  const {
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    bucket, setBucket,
    parent, setParent,
    dateField, setDateField,
    scope, setScope,
    officeId, setOfficeId,
    activeFilterCount,
    clearAllFilters
  } = useReportFilters({ isOfficeHead: false });

  React.useEffect(() => {
    getOffices()
      .then(setOfficesList)
      .catch(() => {});
  }, []);

  // ── Data hook ────────────────────────────────────────────────────────────────
  const {
    loading,
    requestsLoading,
    activityLoading,
    adminUserLoading,
    stats,
    requestsReport,
    activityReport,
    adminUserStats,
    ongoingCount,
  } = useReportsData({
    me,
    role,
    qaMode,
    isOfficeHead: false,
    activeTab,
    refreshKey,
    filters: {
      dateFrom,
      dateTo,
      bucket,
      parent,
      officeId,
      dateField,
      scope,
    },
  });

  // Re-verify if Admin role is actually here
  if (!me) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <PageFrame
      title="Intelligence & Reporting"
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
      right={
        <PageActions>
          <RefreshAction
            loading={loading}
            onRefresh={async () => {
              setRefreshKey((k) => k + 1);
              return "System metrics refreshed.";
            }}
          />
        </PageActions>
      }
    >
      {/* Tab nav */}
      <div className="shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400 overflow-x-auto hide-scrollbar bg-white dark:bg-surface-600">
        <Tabs 
          tabs={TABS} 
          activeTab={activeTab} 
          onChange={(key) => setActiveTab(key as Tab)} 
          id="admin-god-view" 
          className="border-none"
        />
        <div className="ml-auto flex items-center pr-3 -mb-px">
          <Button
            type="button"
            variant={filtersOpen ? "primary" : "outline"}
            size="xs"
            onClick={() => setFiltersOpen((v) => !v)}
            className="flex items-center gap-1.5 transition-colors"
          >
            <SlidersHorizontal size={12} />
            <span className="hidden sm:inline">Analytics Filters</span>
            {activeFilterCount > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${filtersOpen ? "bg-white text-brand-600" : "bg-brand-500 text-white"}`}>
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main View Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-50/30 dark:bg-transparent">
        <div className="flex-1 min-w-0 overflow-y-auto">
          <div className="flex flex-col gap-6 p-4 sm:p-5">
            <TabContent activeKey={activeTab} currentKey="health">
              <SystemHealthTab 
                loading={loading || activityLoading}
                activityReport={activityReport}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="users">
              <UsersTab 
                adminUserLoading={adminUserLoading}
                adminUserStats={adminUserStats}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="workflow">
              <WorkflowTab
                loading={loading}
                bucket={bucket}
                stats={stats}
                ongoingCount={ongoingCount}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="requests">
              <RequestsTab
                requestsLoading={requestsLoading}
                requestsReport={requestsReport}
                bucket={bucket}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="compliance">
              <ClusterTab 
                loading={loading}
                stats={stats}
                parent={parent}
              />
            </TabContent>
          </div>
        </div>

        {/* Filters Sidebar */}
        {filtersOpen && (
          <aside className="w-64 shrink-0 border-l border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-y-auto hidden lg:flex flex-col shadow-xl">
             <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-surface-400">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">Filter Engine</span>
                <button onClick={() => setFiltersOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={14} />
                </button>
             </div>
             <ReportFilters
                onClear={clearAllFilters}
                activeFilterCount={activeFilterCount}
                isOfficeHead={false}
                me={me}
                scope={scope}
                setScope={setScope}
                parent={parent}
                setParent={setParent}
                officeId={officeId}
                setOfficeId={setOfficeId}
                officesList={officesList}
                bucket={bucket}
                setBucket={setBucket}
                dateField={dateField}
                setDateField={setDateField}
                dateFrom={dateFrom}
                setDateFrom={setDateFrom}
                dateTo={dateTo}
                setDateTo={setDateTo}
              />
          </aside>
        )}
      </div>
    </PageFrame>
  );
};

export default AdminReportsPage;
