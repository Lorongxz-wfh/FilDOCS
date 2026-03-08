import React from "react";
import { getAuthUser } from "../../lib/auth";

type Props = {
  pendingCount: number;
  loading: boolean;
};

const DashboardGreeting: React.FC<Props> = ({ pendingCount, loading }) => {
  const user = getAuthUser();
  const firstName = user?.full_name?.split(" ")[0] ?? "there";
  const role =
    typeof user?.role === "string"
      ? user.role
      : ((user?.role as any)?.name ?? "");

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-500/10 via-white to-sky-50/40 px-6 py-5 dark:border-surface-400 dark:from-brand-500/10 dark:via-surface-500 dark:to-sky-950/20">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {today}
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            {greeting}, {firstName} 👋
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {role && (
              <span className="mr-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 border border-brand-100 dark:bg-brand-950/30 dark:text-brand-400 dark:border-brand-800">
                {role}
              </span>
            )}
            {loading ? (
              "Loading your tasks…"
            ) : pendingCount > 0 ? (
              <>
                You have{" "}
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {pendingCount} pending{" "}
                  {pendingCount === 1 ? "action" : "actions"}
                </span>{" "}
                requiring attention.
              </>
            ) : (
              "You're all caught up. No pending actions."
            )}
          </p>
        </div>

        {/* Pulse indicator */}
        {!loading && pendingCount > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 dark:border-rose-800 dark:bg-rose-950/30">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
            </span>
            <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">
              {pendingCount} action{pendingCount !== 1 ? "s" : ""} pending
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardGreeting;
