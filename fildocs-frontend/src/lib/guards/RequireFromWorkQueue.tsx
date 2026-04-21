import { Navigate, Outlet, useLocation } from "react-router-dom";

const WORKQUEUE_SESSION_KEY = "from_workqueue_session";

export function markWorkQueueSession() {
  sessionStorage.setItem(WORKQUEUE_SESSION_KEY, "1");
}

export default function RequireFromWorkQueue() {
  const location = useLocation();

  const fromNavState = Boolean((location.state as any)?.fromWorkQueue);
  const fromSession = sessionStorage.getItem(WORKQUEUE_SESSION_KEY) === "1";

  // If user arrived properly once, remember it for this browser tab/session
  if (fromNavState && !fromSession) {
    sessionStorage.setItem(WORKQUEUE_SESSION_KEY, "1");
  }

  const ok = fromNavState || fromSession;

  if (!ok) return <Navigate to="/work-queue" replace />;
  return <Outlet />;
}
