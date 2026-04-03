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
      window.location.reload();
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 flex flex-col items-center justify-center gap-4 bg-white dark:bg-surface-600">
          <p className="text-sm text-slate-500 dark:text-slate-400">Something went wrong loading this page.</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-md bg-brand-400 px-4 py-2 text-sm font-medium text-white hover:bg-brand-500 transition"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

import LoginPage from "./pages/LoginPage";
const ForgotPasswordPage = React.lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = React.lazy(() => import("./pages/ResetPasswordPage"));


const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const MyWorkQueuePage = React.lazy(() => import("./pages/MyWorkQueuePage"));
const DocumentLibraryPage = React.lazy(
  () => import("./pages/DocumentLibraryPage"),
);
const CreateDocumentPage = React.lazy(
  () => import("./pages/CreateDocumentPage"),
);
const InboxPage = React.lazy(() => import("./pages/InboxPage"));
const ReportsPage = React.lazy(() => import("./pages/ReportsPage"));
const AdminReportsPage = React.lazy(() => import("./pages/AdminReportsPage"));
const ReportExportPage = React.lazy(() => import("./pages/ReportExportPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const MyActivityPage = React.lazy(() => import("./pages/MyActivityPage"));
const UserManagerPage = React.lazy(() => import("./pages/UserManagerPage"));
const OfficeManagerPage = React.lazy(() => import("./pages/OfficeManagerPage"));
const ActivityLogsPage = React.lazy(() => import("./pages/ActivityLogsPage"));
const DocumentFlowPage = React.lazy(() => import("./pages/DocumentFlowPage"));
const DocumentViewPage = React.lazy(() => import("./pages/DocumentViewPage"));
const ArchivePage = React.lazy(() => import("./pages/ArchivePage"));


const DocumentRequestListPage = React.lazy(
  () => import("./pages/DocumentRequestListPage"),
);
const CreateDocumentRequestPage = React.lazy(
  () => import("./pages/CreateDocumentRequestPage"),
);
const DocumentRequestBatchPage = React.lazy(
  () => import("./pages/DocumentRequestBatchPage"),
);
const DocumentRequestPage = React.lazy(
  () => import("./pages/DocumentRequestPage"),
);
const TemplatesPage = React.lazy(() => import("./pages/TemplatesPage"));
const MyWorkQueueListPage = React.lazy(
  () => import("./pages/MyWorkQueueListPage"),
);
const AnnouncementsPage = React.lazy(() => import("./pages/AnnouncementsPage"));
const BackupPage = React.lazy(() => import("./pages/BackupPage"));
const HelpPage = React.lazy(() => import("./pages/HelpPage"));
const HelpTopicPage = React.lazy(() => import("./pages/HelpTopicPage"));
const WhatsNewPage = React.lazy(() => import("./pages/WhatsNewPage"));
const ReportIssuePage = React.lazy(() => import("./pages/ReportIssuePage"));

import ProtectedLayout from "./lib/guards/ProtectedLayout";
import RequireRole from "./lib/guards/RequireRole";
import { getUserRole } from "./lib/roleFilters";

// Routes /reports to the role-appropriate page
const ReportsRoute: React.FC = () => {
  const role = getUserRole();
  return role === "ADMIN" || role === "SYSADMIN"
    ? <AdminReportsPage />
    : <ReportsPage />;
};

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


export default function App() {
  return (
    <ChunkErrorBoundary>
      <Suspense
        fallback={
          <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-surface-600 z-50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
              <span className="text-xs text-slate-400 dark:text-slate-500 tracking-wide">
                Loading…
              </span>
            </div>
          </div>
        }
      >
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />


          <Route element={<ProtectedLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route element={<RequireRole allow={nonAuditorRoles} />}>
              <Route path="/work-queue" element={<MyWorkQueuePage />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route
                path="/document-requests"
                element={<DocumentRequestListPage />}
              />
              <Route
                path="/document-requests/:id"
                element={<DocumentRequestBatchPage />}
              />
              <Route
                path="/document-requests/:id/recipients/:recipientId"
                element={<DocumentRequestPage />}
              />
              <Route
                path="/document-requests/:id/items/:itemId"
                element={<DocumentRequestPage />}
              />
              <Route path="/templates" element={<TemplatesPage />} />
            </Route>

            <Route
              element={<RequireRole allow={["QA", "SYSADMIN", "ADMIN"]} />}
            >
              <Route
                path="/document-requests/create"
                element={<CreateDocumentRequestPage />}
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
            <Route path="/documents/:id" element={<DocumentFlowPage />} />
            <Route path="/documents/all" element={<MyWorkQueueListPage />} />
            <Route path="/documents" element={<DocumentLibraryPage />} />
            <Route path="/archive" element={<ArchivePage />} />

            <Route
              element={
                <RequireRole allow={["QA", "OFFICE_STAFF", "OFFICE_HEAD"]} />
              }
            >
              <Route
                path="/documents/create"
                element={<CreateDocumentPage />}
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
                  ]}
                />
              }
            >
              <Route path="/reports" element={<ReportsRoute />} />
              <Route path="/reports/export" element={<ReportExportPage />} />
            </Route>

            <Route path="/settings" element={<SettingsPage />} />

            <Route
              element={
                <RequireRole
                  allow={["QA", "SYSADMIN", "ADMIN", "OFFICE_HEAD", "AUDITOR"]}
                />
              }
            >
              <Route path="/activity-logs" element={<ActivityLogsPage />} />
            </Route>

            <Route element={<RequireRole allow={["SYSADMIN", "ADMIN"]} />}>
              <Route path="/user-manager" element={<UserManagerPage />} />
              <Route path="/office-manager" element={<OfficeManagerPage />} />
            </Route>

            <Route
              element={
                <RequireRole allow={["QA", "ADMIN", "OFFICE_HEAD"]} />
              }
            >
              <Route path="/backup" element={<BackupPage />} />
            </Route>


            <Route path="/announcements" element={<AnnouncementsPage />} />
            <Route path="/my-activity" element={<MyActivityPage />} />
            <Route path="/help" element={<HelpPage />} />
            <Route path="/help/:topic" element={<HelpTopicPage />} />
            <Route path="/whats-new" element={<WhatsNewPage />} />
            <Route path="/report-issue" element={<ReportIssuePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </ChunkErrorBoundary>
  );
}
