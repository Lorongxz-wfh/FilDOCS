import React, { Suspense } from "react";

import { Routes, Route, Navigate } from "react-router-dom";



class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };

  static getDerivedStateFromError() { return { error: true }; }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.message?.includes("Failed to fetch dynamically imported module") ||
      error.message?.includes("dynamically imported module") ||
      (error as { name?: string }).name === "ChunkLoadError";

    if (isChunkError && !sessionStorage.getItem("chunk_reload")) {
      sessionStorage.setItem("chunk_reload", "1");
      // Aggressive cache bust
      window.location.reload();
    }
  }

  componentDidMount() {
    // Catch script load errors that don't reach React's error boundary
    const handler = (event: ErrorEvent) => {
      const msg = event.message || "";
      const isMimeError = msg.includes("MIME type") || msg.includes("module script");
      if (isMimeError && !sessionStorage.getItem("chunk_reload")) {
        sessionStorage.setItem("chunk_reload", "1");
        window.location.reload();
      }
    };
    window.addEventListener("error", handler, true);
  }

  componentWillUnmount() {
    // No-op cleanup for the global handler is actually difficult here as we need ref-stability 
    // but since this is at App level, it's fine.
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white dark:bg-surface-600">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-300 tracking-wide">
            Something went wrong while loading the app…
          </span>
          <button
            onClick={() => {
              sessionStorage.removeItem("chunk_reload");
              window.location.reload();
            }}
            className="mt-3 rounded-md bg-brand-500 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:bg-brand-600 transition-all shadow-sm"
          >
            Reload & Repair
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import LoginPage from "./pages/auth/LoginPage";
const ForgotPasswordPage = React.lazy(() => import("./pages/auth/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("./pages/auth/ResetPasswordPage"));
const ForcePasswordChangePage = React.lazy(() => import("./pages/auth/ForcePasswordChangePage"));


const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const WorkQueueHubPage = React.lazy(() => import("./pages/WorkQueueHubPage"));
const LibraryPage = React.lazy(
  () => import("./pages/library/LibraryPage"),
);
const CreateWorkflowPage = React.lazy(
  () => import("./pages/workflows/CreateWorkflowPage"),
);
const InboxPage = React.lazy(() => import("./pages/InboxPage"));
const ReportsPage = React.lazy(() => import("./pages/reports/ReportsPage"));
const ReportExportPage = React.lazy(() => import("./pages/reports/ReportExportPage"));
const ProfileSettingsPage = React.lazy(() => import("./pages/ProfileSettingsPage"));
const UserManagerPage = React.lazy(() => import("./pages/system/UserManagerPage"));
const OfficeManagerPage = React.lazy(() => import("./pages/system/OfficeManagerPage"));
const ActivityLogsPage = React.lazy(() => import("./pages/system/ActivityLogsPage"));
const WorkflowPage = React.lazy(() => import("./pages/workflows/WorkflowPage"));
const DocumentViewPage = React.lazy(() => import("./pages/library/DocumentViewPage"));
const ArchivePage = React.lazy(() => import("./pages/library/ArchivePage"));
const SystemHealthPage = React.lazy(
  () => import("./pages/system/SystemHealthPage"),
);


const RequestListPage = React.lazy(
  () => import("./pages/requests/RequestListPage"),
);
const CreateRequestPage = React.lazy(
  () => import("./pages/requests/CreateRequestPage"),
);
const RequestBatchPage = React.lazy(
  () => import("./pages/requests/RequestBatchPage"),
);
const RequestPage = React.lazy(
  () => import("./pages/requests/RequestPage"),
);
const TemplatesPage = React.lazy(() => import("./pages/library/TemplatesPage"));
const WorkflowListPage = React.lazy(
  () => import("./pages/workflows/WorkflowListPage"),
);
const AnnouncementsPage = React.lazy(() => import("./pages/system/AnnouncementsPage"));
const BackupAndRestorePage = React.lazy(() => import("./pages/system/BackupAndRestorePage"));
const HelpPage = React.lazy(() => import("./pages/support/HelpPage"));
const HelpTopicPage = React.lazy(() => import("./pages/support/HelpTopicPage"));
const WhatsNewPage = React.lazy(() => import("./pages/support/WhatsNewPage"));
const ReportIssuePage = React.lazy(() => import("./pages/support/ReportIssuePage"));

import ProtectedLayout from "./lib/guards/ProtectedLayout";
import RequireRole from "./lib/guards/RequireRole";
import { ToastProvider } from "./components/ui/toast/ToastContext";


// Reports routing is handled internally by ReportsPage based on the user's role

import type { UserRole } from "./lib/roleFilters";
const nonAuditorRoles: UserRole[] = [
  "QA",
  "SYSADMIN",
  "ADMIN",
  "OFFICE_HEAD",
  "OFFICE_STAFF",
  "VPAA",
  "VPAD",
  "VPF",
  "VPR",
  "PRESIDENT",
];


const MaintenancePage = React.lazy(() => import("./pages/MaintenancePage"));

function SuspenseFallback() {
  const [showReload, setShowReload] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setShowReload(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-surface-600 z-[100]">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-300 tracking-wide">
            Loading your workspace…
          </span>
          {showReload && (
            <button
              onClick={() => window.location.reload()}
              className="mt-3 rounded-md bg-slate-100 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 transition-all animate-in fade-in slide-in-from-bottom-2 duration-500"
            >
              Taking too long? Reload
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ChunkErrorBoundary>
        <Suspense fallback={<SuspenseFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/maintenance" element={<MaintenancePage />} />
            <Route path="/force-password-change" element={<ForcePasswordChangePage />} />


            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route element={<RequireRole allow={nonAuditorRoles} />}>
                <Route path="/work-queue" element={<WorkQueueHubPage />} />
                <Route path="/inbox" element={<InboxPage />} />
                <Route
                  path="/document-requests"
                  element={<RequestListPage />}
                />
                <Route
                  path="/document-requests/:id"
                  element={<RequestBatchPage />}
                />
                <Route
                  path="/document-requests/:id/recipients/:recipientId"
                  element={<RequestPage />}
                />
                <Route
                  path="/document-requests/:id/items/:itemId"
                  element={<RequestPage />}
                />
                <Route
                  path="/documents/view/request/:requestId/recipients/:recipientId"
                  element={<DocumentViewPage />}
                />
                <Route
                  path="/documents/view/request/:requestId/items/:itemId"
                  element={<DocumentViewPage />}
                />
                <Route path="/templates" element={<TemplatesPage />} />
              </Route>

              <Route
                element={<RequireRole allow={nonAuditorRoles.filter(r => r !== 'ADMIN' || import.meta.env.DEV)} />}
              >
                <Route
                  path="/document-requests/create"
                  element={<CreateRequestPage />}
                />
              </Route>

              {/* Back-compat */}
              <Route
                path="/compliance"
                element={<Navigate to="/document-requests" replace />}
              />
              <Route
                path="/compliance/create"
                element={<Navigate to="/document-requests/create" replace />}
              />
              <Route
                path="/compliance/inbox"
                element={<Navigate to="/document-requests" replace />}
              />
              <Route
                path="/compliance/:id"
                element={<Navigate to="/document-requests/:id" replace />}
              />

              {/* Document view (library/finished) */}
              <Route path="/documents/:id/view" element={<DocumentViewPage />} />
              <Route path="/documents/:id" element={<WorkflowPage />} />
              <Route path="/documents/all" element={<WorkflowListPage />} />
              <Route path="/documents" element={<LibraryPage />} />
              <Route path="/archive" element={<ArchivePage />} />

              <Route
                element={
                  <RequireRole allow={[
                    "QA", 
                    "OFFICE_STAFF", 
                    "OFFICE_HEAD", 
                    "VPAA", 
                    "VPAD", 
                    "VPF", 
                    "VPR", 
                    "PRESIDENT"
                  ]} />
                }
              >
                <Route
                  path="/documents/create"
                  element={<CreateWorkflowPage />}
                />
              </Route>

              <Route
                path="/documents/request"
                element={<Navigate to="/documents/create" replace />}
              />

              <Route
                element={
                  <RequireRole
                    allow={[
                      "PRESIDENT",
                      "VPAA",
                      "QA",
                      "SYSADMIN",
                      "ADMIN",
                      "VPAD",
                      "VPF",
                      "VPR",
                      "OFFICE_HEAD",
                      "OFFICE_STAFF",
                    ]}
                  />
                }
              >
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/reports/export" element={<ReportExportPage />} />
              </Route>

              <Route path="/profile" element={<ProfileSettingsPage />} />
              <Route path="/settings" element={<Navigate to="/profile" replace />} />
              <Route path="/my-activity" element={<Navigate to="/profile" replace />} />

              <Route
                element={
                  <RequireRole
                    allow={["QA", "SYSADMIN", "ADMIN", "OFFICE_HEAD", "AUDITOR"]}
                  />
                }
              >
                <Route path="/activity-logs" element={<ActivityLogsPage />} />
              </Route>

              <Route element={<RequireRole allow={["SYSADMIN", "ADMIN", "QA"]} />}>
                <Route path="/system/backup" element={<BackupAndRestorePage />} />
                <Route path="/user-manager" element={<UserManagerPage />} />
                <Route path="/office-manager" element={<OfficeManagerPage />} />
                <Route path="/system-health" element={<SystemHealthPage />} />
              </Route>



              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/help" element={<HelpPage />} />
              <Route path="/help/:topic" element={<HelpTopicPage />} />
              <Route path="/whats-new" element={<WhatsNewPage />} />
              <Route path="/report-issue" element={<ReportIssuePage />} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    </ToastProvider>
  );
}
