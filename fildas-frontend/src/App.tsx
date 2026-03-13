import React, { Suspense } from "react";

import { Routes, Route, Navigate } from "react-router-dom";

import LoginPage from "./pages/LoginPage";

const DashboardPage = React.lazy(() => import("./pages/DashboardPage"));
const MyWorkQueuePage = React.lazy(() => import("./pages/MyWorkQueuePage"));
const DocumentLibraryPage = React.lazy(
  () => import("./pages/DocumentLibraryPage"),
);
const CreateDocumentPage = React.lazy(
  () => import("./pages/CreateDocumentPage"),
);
const InboxPage = React.lazy(() => import("./pages/InboxPage"));
const ArchivePage = React.lazy(() => import("./pages/ArchivePage"));
const ReportsPage = React.lazy(() => import("./pages/ReportsPage"));
const ReportExportPage = React.lazy(() => import("./pages/ReportExportPage"));
const SettingsPage = React.lazy(() => import("./pages/SettingsPage"));
const MyActivityPage = React.lazy(() => import("./pages/MyActivityPage"));
const UserManagerPage = React.lazy(() => import("./pages/UserManagerPage"));
const OfficeManagerPage = React.lazy(() => import("./pages/OfficeManagerPage"));
const ActivityLogsPage = React.lazy(() => import("./pages/ActivityLogsPage"));
const DocumentFlowPage = React.lazy(() => import("./pages/DocumentFlowPage"));

const DocumentRequestListPage = React.lazy(
  () => import("./pages/DocumentRequestListPage"),
);
const CreateDocumentRequestPage = React.lazy(
  () => import("./pages/CreateDocumentRequestPage"),
);
const DocumentRequestPage = React.lazy(
  () => import("./pages/DocumentRequestPage"),
);
const TemplatesPage = React.lazy(() => import("./pages/TemplatesPage"));

import ProtectedLayout from "./lib/guards/ProtectedLayout";
import RequireRole from "./lib/guards/RequireRole";

export default function App() {
  return (
    <Suspense
      fallback={<div className="p-4 text-sm text-slate-600">Loading…</div>}
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/work-queue" element={<MyWorkQueuePage />} />
          <Route path="/my-activity" element={<MyActivityPage />} />
          <Route path="/inbox" element={<InboxPage />} />

          {/* Document Requests */}
          <Route
            path="/document-requests"
            element={<DocumentRequestListPage />}
          />
          <Route
            path="/document-requests/:id"
            element={<DocumentRequestPage />}
          />

          <Route element={<RequireRole allow={["QA", "SYSADMIN", "ADMIN"]} />}>
            <Route
              path="/document-requests/create"
              element={<CreateDocumentRequestPage />}
            />
          </Route>

          {/* Back-compat (optional): redirect old compliance URLs */}
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

          {/* DocumentFlow is ok to open normally */}
          <Route path="/documents/:id" element={<DocumentFlowPage />} />

          {/* Document library should be reachable from sidebar */}
          <Route path="/documents" element={<DocumentLibraryPage />} />

          {/* Create can be opened from anywhere, but still role-protected */}
          <Route
            element={
              <RequireRole allow={["QA", "OFFICE_STAFF", "OFFICE_HEAD"]} />
            }
          >
            <Route path="/documents/create" element={<CreateDocumentPage />} />
          </Route>

          {/* Remove RequestDocumentPage for now (old flow). */}
          <Route
            path="/documents/request"
            element={<Navigate to="/documents/create" replace />}
          />

          {/* Role-limited pages */}
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
                ]}
              />
            }
          >
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/export" element={<ReportExportPage />} />
          </Route>

          {/* Settings — all authenticated users */}
          <Route path="/settings" element={<SettingsPage />} />

          <Route element={<RequireRole allow={["QA", "SYSADMIN", "ADMIN"]} />}>
            <Route path="/activity-logs" element={<ActivityLogsPage />} />
          </Route>

          <Route element={<RequireRole allow={["SYSADMIN", "ADMIN"]} />}>
            <Route path="/user-manager" element={<UserManagerPage />} />
            <Route path="/office-manager" element={<OfficeManagerPage />} />
          </Route>

          {/* Templates — all authenticated users */}
          <Route path="/templates" element={<TemplatesPage />} />

          {/* Archive is authenticated */}
          <Route path="/archive" element={<ArchivePage />} />
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
