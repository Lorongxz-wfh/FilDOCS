import React from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TRANSITION_EASE_OUT } from "../../utils/animations";
import { useAuthUser } from "../../hooks/useAuthUser";
import { getUserRole, isQA } from "../../lib/roleFilters";
import PageFrame from "../../components/layout/PageFrame";
import Button from "../../components/ui/Button";
import ReportFilters from "../../components/reports/ReportFilters";
import { useReportsData } from "../../hooks/useReportsData";
import { useReportFilters } from "../../hooks/useReportFilters";
import { getOffices } from "../../services/reportsApi";
import { SlidersHorizontal, BarChart3, LayoutDashboard, BarChart2, FileQuestion, Activity, Users, CheckCircle2, ShieldCheck, HeartPulse } from "lucide-react";
import { Tabs, TabContent } from "../../components/ui/Tabs";
import { PageActions } from "../../components/ui/PageActions";
import { useRefresh } from "../../lib/RefreshContext";

// Tabs
import OverviewTab from "../../components/reports/tabs/OverviewTab";
import WorkflowTab from "../../components/reports/tabs/WorkflowTab";
import RequestsTab from "../../components/reports/tabs/RequestsTab";
import ActivityTab from "../../components/reports/tabs/ActivityTab";
import UsersTab from "../../components/reports/tabs/UsersTab";
import ClusterTab from "../../components/reports/tabs/ClusterTab";
import ExecutiveTab from "../../components/reports/tabs/ExecutiveTab";
import SystemHealthTab from "../../components/reports/tabs/SystemHealthTab";

type Tab = "overview" | "workflow" | "requests" | "activity" | "users" | "compliance" | "executive" | "cluster" | "health";

const TABS_QA: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Overview", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { key: "workflow", label: "Workflow", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "requests", label: "Requests", icon: <FileQuestion className="h-3.5 w-3.5" /> },
  { key: "activity", label: "Activity", icon: <Activity className="h-3.5 w-3.5" /> },
];

const TABS_OFFICE_HEAD: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Dashboard", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { key: "workflow", label: "Workflow Efficiency", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "requests", label: "Request History", icon: <FileQuestion className="h-3.5 w-3.5" /> },
];

const TABS_OFFICE_STAFF: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Workflow Performance", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { key: "requests", label: "My Requests", icon: <FileQuestion className="h-3.5 w-3.5" /> },
];

const TABS_VP: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "overview", label: "Executive Info", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { key: "cluster", label: "Cluster View", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "workflow", label: "Cluster Workflow", icon: <BarChart2 className="h-3.5 w-3.5" /> },
];

const TABS_PRESIDENT: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "executive", label: "Executive Summary", icon: <LayoutDashboard className="h-3.5 w-3.5" /> },
  { key: "overview", label: "System Health", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "compliance", label: "Global Compliance", icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
];

const TABS_ADMIN: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "health", label: "System Health", icon: <HeartPulse className="h-3.5 w-3.5" /> },
  { key: "users", label: "User Insights", icon: <Users className="h-3.5 w-3.5" /> },
  { key: "workflow", label: "Workflows", icon: <BarChart2 className="h-3.5 w-3.5" /> },
  { key: "requests", label: "Requests", icon: <FileQuestion className="h-3.5 w-3.5" /> },
  { key: "compliance", label: "Cluster & Docs", icon: <ShieldCheck className="h-3.5 w-3.5" /> },
];

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const me = useAuthUser();
  const role = getUserRole();
  const qaMode = isQA(role);
  const isOfficeHead = role === "OFFICE_HEAD";
  const isOfficeStaff = role === "OFFICE_STAFF";
  const isVP = ["VPAA", "VPAD", "VPF", "VPR"].includes(role);
  const isPresident = role === "PRESIDENT";
  const isAdmin = role === "ADMIN" || role === "SYSADMIN";
  const isRestricted = isOfficeHead || role === "OFFICE_STAFF";

  const getTabs = () => {
    if (qaMode) return TABS_QA;
    if (isPresident) return TABS_PRESIDENT;
    if (isVP) return TABS_VP;
    if (isOfficeHead) return TABS_OFFICE_HEAD;
    if (isOfficeStaff) return TABS_OFFICE_STAFF;
    return TABS_ADMIN;
  };

  const TABS = getTabs();
  const initialTab = TABS[0].key;


  const tabContentRef = React.useRef<HTMLDivElement>(null);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<Tab>(initialTab);
  const [officesList, setOfficesList] = React.useState<{ id: number; name: string; code: string }[]>([]);

  const { refreshKey: globalRefreshKey } = useRefresh();
  const initialMountRef = React.useRef(true);

  // Global Refresh Listener
  React.useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    setRefreshKey((k) => k + 1);
  }, [globalRefreshKey]);

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
  } = useReportFilters({ isOfficeHead, isOfficeStaff });

  React.useEffect(() => {
    getOffices()
      .then(setOfficesList)
      .catch(() => {});
  }, []);

  // Ensure active tab is valid when TABS change (e.g. role switch)
  React.useEffect(() => {
    if (!TABS.find((t) => t.key === activeTab)) {
      setActiveTab(TABS[0].key);
    }
  }, [TABS, activeTab]);

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
    isOfficeHead,
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

  React.useEffect(() => {
    // Trigger window resize to help Recharts components expand/shrink when sidebar toggles
    const timer = setTimeout(() => {
      window.dispatchEvent(new Event("resize"));
    }, 320);
    return () => clearTimeout(timer);
  }, [filtersOpen]);

  if (!me) return <Navigate to="/login" replace />;

  return (
    <PageFrame
      title={isAdmin ? "Intelligence & Reporting" : "Reports"}
      contentClassName="flex flex-col min-h-0 gap-0 h-full overflow-hidden"
      right={
        <PageActions>
          <Button
            type="button"
            variant="primary"
            size="sm"
            responsive
            onClick={() => navigate("/reports/export")}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="font-semibold">Export reports</span>
          </Button>
        </PageActions>
      }
    >
      {/* Tab nav */}
      <motion.div 
        className="shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0"
        initial={{ opacity: 0, transform: "translateY(-4px)" }}
        animate={{ opacity: 1, transform: "translateY(0)" }}
        transition={{ duration: 0.3, ease: TRANSITION_EASE_OUT }}
      >
        <Tabs 
          tabs={TABS} 
          activeTab={activeTab} 
          onChange={(key) => setActiveTab(key as Tab)} 
          id="reports" 
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
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold leading-none ${filtersOpen ? "bg-white text-brand-600" : "bg-brand-500 text-white"}`}>
                {activeFilterCount}
              </span>
            )}
          </Button>
        </div>
      </motion.div>

      {/* Content + filter panel */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div ref={tabContentRef} className="flex-1 min-w-0 overflow-y-auto">
          <div className="flex flex-col gap-4 p-4 sm:p-4">
            <TabContent activeKey={activeTab} currentKey="health">
              <SystemHealthTab 
                loading={loading}
                activityReport={activityReport}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="overview">
              {!isAdmin && (
                <OverviewTab
                  loading={loading}
                  activityLoading={activityLoading}
                  qaMode={qaMode}
                  role={role}
                  bucket={bucket}
                  stats={stats}
                  ongoingCount={ongoingCount}
                  activityReport={activityReport}
                />
              )}
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="cluster">
              {(isPresident || isVP || isAdmin) && (
                <ClusterTab 
                  loading={loading}
                  stats={stats}
                  parent={parent}
                />
              )}
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="compliance">
              {isAdmin && (
                 <ClusterTab 
                    loading={loading}
                    stats={stats}
                    parent={parent}
                 />
              )}
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="executive">
              <ExecutiveTab 
                loading={loading}
                stats={stats}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="workflow">
              {(qaMode || isOfficeHead || isAdmin) && (
                <WorkflowTab
                  loading={loading}
                  bucket={bucket}
                  stats={stats}
                  ongoingCount={ongoingCount}
                />
              )}
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="requests">
              <RequestsTab
                requestsLoading={requestsLoading}
                requestsReport={requestsReport}
                bucket={bucket}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="activity">
              <ActivityTab
                activityLoading={activityLoading}
                activityReport={activityReport}
              />
            </TabContent>

            <TabContent activeKey={activeTab} currentKey="users">
              <UsersTab
                adminUserLoading={adminUserLoading}
                adminUserStats={adminUserStats}
              />
            </TabContent>
          </div>
        </div>

        {/* Filter Panel */}
        {filtersOpen && (
          <div className="w-72 shrink-0 border-l border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-y-auto hidden lg:block">
            <ReportFilters
              isOfficeHead={isOfficeHead}
              isRestricted={isRestricted}
              me={me}
              activeFilterCount={activeFilterCount}
              officesList={officesList}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              bucket={bucket}
              setBucket={setBucket}
              parent={parent}
              setParent={setParent}
              officeId={officeId}
              setOfficeId={setOfficeId}
              dateField={dateField}
              setDateField={setDateField}
              scope={scope}
              setScope={setScope}
              onClear={clearAllFilters}
            />
          </div>
        )}
      </div>

      {/* Mobile filter slide-over (simplified) */}
      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-[100] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setFiltersOpen(false)} />
          <div className="relative w-full max-w-xs bg-white dark:bg-surface-500 h-full overflow-y-auto">
             <div className="p-4 border-b border-slate-200 dark:border-surface-400 flex items-center justify-between">
                <h3 className="font-semibold text-sm">Filters</h3>
                <button onClick={() => setFiltersOpen(false)} className="text-slate-400 hover:text-slate-600">×</button>
             </div>
             <ReportFilters
              isOfficeHead={isOfficeHead}
              me={me}
              activeFilterCount={activeFilterCount}
              officesList={officesList}
              dateFrom={dateFrom}
              setDateFrom={setDateFrom}
              dateTo={dateTo}
              setDateTo={setDateTo}
              bucket={bucket}
              setBucket={setBucket}
              parent={parent}
              setParent={setParent}
              officeId={officeId}
              setOfficeId={setOfficeId}
              dateField={dateField}
              setDateField={setDateField}
              scope={scope}
              setScope={setScope}
              onClear={clearAllFilters}
            />
          </div>
        </div>
      )}
    </PageFrame>
  );
};

export default ReportsPage;
