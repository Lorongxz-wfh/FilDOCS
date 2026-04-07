import React from "react";
import { Users, UserCheck, UserX, Activity, ShieldCheck, Mail } from "lucide-react";
import KpiCard from "../../ui/KpiCard";
import ReportChartCard from "../ReportChartCard";
import AdminUsersByRoleChart from "../../dashboard/AdminUsersByRoleChart";

interface UsersTabProps {
  adminUserLoading: boolean;
  adminUserStats: any;
}

const UsersTab: React.FC<UsersTabProps> = ({
  adminUserLoading,
  adminUserStats,
}) => {
  if (!adminUserStats && !adminUserLoading) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* User KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
        <KpiCard
          loading={adminUserLoading}
          label="Total users"
          value={adminUserStats?.total ?? 0}
          sub="Registered accounts"
          icon={<Users size={16} className="text-sky-600 dark:text-sky-400" />}
          iconBg="bg-sky-50 dark:bg-sky-900/30"
        />
        <KpiCard
          loading={adminUserLoading}
          label="Active"
          value={adminUserStats?.active ?? 0}
          sub="Logged in recently"
          icon={<UserCheck size={16} className="text-emerald-600 dark:text-emerald-400" />}
          iconBg="bg-emerald-50 dark:bg-emerald-900/30"
        />
        <KpiCard
          loading={adminUserLoading}
          label="Inactive"
          value={adminUserStats?.inactive ?? 0}
          sub="30+ days idle"
          icon={<UserX size={16} className="text-slate-400" />}
          iconBg="bg-slate-100 dark:bg-surface-400"
        />
        <KpiCard
          loading={adminUserLoading}
          label="New this month"
          value={adminUserStats?.new_this_month ?? 0}
          sub="Joined this cycle"
          icon={<Activity size={16} className="text-violet-600 dark:text-violet-400" />}
          iconBg="bg-violet-50 dark:bg-violet-900/30"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <ReportChartCard
            title="Account Status"
            subtitle="Enabled vs. disabled users"
            loading={adminUserLoading}
          >
            <AdminUsersByRoleChart 
              active={adminUserStats?.active ?? 0} 
              inactive={adminUserStats?.inactive ?? 0} 
              loading={adminUserLoading} 
              height={260}
            />
          </ReportChartCard>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50 mb-6 flex items-center gap-2">
              <ShieldCheck size={16} className="text-brand-500" />
              Account Verification
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Verified Emails</span>
                  <span className="text-sm font-bold text-emerald-500 tabular-nums">
                    {adminUserStats?.verified ?? 0}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-surface-400 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000"
                    style={{ width: `${(adminUserStats?.verified / adminUserStats?.total) * 100}%` }}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between group">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pending Verification</span>
                  <span className="text-sm font-bold text-amber-500 tabular-nums">
                    {adminUserStats?.unverified ?? 0}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 dark:bg-surface-400 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500 transition-all duration-1000"
                    style={{ width: `${(adminUserStats?.unverified / adminUserStats?.total) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/20 p-8 flex flex-col items-center justify-center text-center">
            <Mail className="h-8 w-8 text-slate-300 mb-3" />
            <p className="text-xs font-medium text-slate-400 dark:text-slate-500 max-w-sm">
              Role-based population trends and average user session time metrics are being calculated in the background and will appear here in the next update.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UsersTab;
