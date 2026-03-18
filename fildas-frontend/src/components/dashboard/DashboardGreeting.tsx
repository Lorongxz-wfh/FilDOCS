import React from "react";
import { getAuthUser } from "../../lib/auth";
import { Hand, CheckCircle2 } from "lucide-react";

type Props = {
  pendingCount: number;
  loading: boolean;
};

const DashboardGreeting: React.FC<Props> = ({ pendingCount, loading }) => {
  const user = getAuthUser();

  const firstName =
    user?.first_name?.trim() || user?.full_name?.split(" ")[0] || "there";

  // const role =
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
    <div className="rounded-md border border-slate-200 bg-white px-5 py-4 dark:border-surface-400 dark:bg-surface-500">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Left: greeting + status */}
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-100 dark:bg-brand-900/40 text-sm font-bold text-brand-600 dark:text-brand-300 border border-brand-200 dark:border-brand-800">
            {(user?.full_name ?? "")
              .split(" ")
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join("") || "?"}
          </div>

          <div>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {today}
            </p>
            <h1 className="mt-0.5 flex items-center gap-1.5 text-lg font-bold text-slate-900 dark:text-slate-100">
              {greeting}, {firstName}
              <Hand className="h-4 w-4 text-amber-400" />
            </h1>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {loading
                  ? "Loading your workspace…"
                  : pendingCount > 0
                    ? `${pendingCount} task${pendingCount !== 1 ? "s" : ""} need${pendingCount === 1 ? "s" : ""} your attention`
                    : "Everything is up to date"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: status badge */}
        {!loading &&
          (pendingCount > 0 ? (
            <div className="flex items-center gap-2 rounded border border-rose-200 bg-rose-50 px-3 py-1.5 dark:border-rose-800 dark:bg-rose-950/30">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
              <span className="text-sm font-semibold text-rose-700 dark:text-rose-400">
                {pendingCount} pending
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 dark:border-emerald-800 dark:bg-emerald-950/30">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                All caught up
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DashboardGreeting;
