import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import MainLayout from "../../layout/MainLayout";
import { getAuthToken, logoutUser } from "../auth";
import { useIdleTimeout } from "../../hooks/useIdleTimeout";
import api from "../../services/api";
import { Loader2 } from "lucide-react";

export default function ProtectedLayout() {
  const token = getAuthToken();
  const checkedTokenRef = React.useRef<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        if (!token) return;
        if (checkedTokenRef.current === token) return;
        checkedTokenRef.current = token;
        await api.get("/user", { params: { t: Date.now() } });
        if (!alive) return;
      } catch (e: any) {
        if (!alive) return;
      }
    })();

    return () => {
      alive = false;
    };
  }, [token]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logoutUser("manual");
  };

  const { showWarning, stayLoggedIn } = useIdleTimeout(
    () => logoutUser("inactivity"),
    30 * 60 * 1000,
    5 * 60 * 1000,
  );

  return (
    <>
      <MainLayout onLogout={handleLogout} noBodyScroll={true}>
        <Outlet />
      </MainLayout>

      {showWarning && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/40">
          <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-lg dark:border-surface-400 dark:bg-surface-500">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Session expiring soon
            </h2>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              You'll be logged out in 5 minutes due to inactivity. Do you want
              to stay logged in?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-surface-300 dark:text-slate-300 dark:hover:bg-surface-400 transition disabled:opacity-50"
              >
                {isLoggingOut && <Loader2 className="h-3 w-3 animate-spin" />}
                {isLoggingOut ? "Logging out..." : "Log out now"}
              </button>
              <button
                type="button"
                onClick={stayLoggedIn}
                className="rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-400 shadow-sm transition-colors"
              >
                Stay logged in
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
