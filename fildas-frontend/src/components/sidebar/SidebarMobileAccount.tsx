import React from "react";
import { NavLink } from "react-router-dom";
import { History, Archive } from "lucide-react";

interface SidebarMobileAccountProps {
  user: any;
  imgError: boolean;
  setImgError: (error: boolean) => void;
  initials: string;
  onMobileClose?: () => void;
}

const SidebarMobileAccount: React.FC<SidebarMobileAccountProps> = ({
  user,
  imgError,
  setImgError,
  initials,
  onMobileClose,
}) => {
  return (
    <div className="shrink-0 px-4 pt-5 pb-4 space-y-4 border-b border-slate-100 dark:border-surface-400 bg-slate-50/30 dark:bg-black/5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-brand-500 p-0.5 border border-white/20 shadow-md">
          <div className="h-full w-full rounded-full overflow-hidden flex items-center justify-center text-white text-sm font-bold bg-brand-600">
            {!imgError && user?.profile_photo_url ? (
              <img
                src={user.profile_photo_url}
                alt={user.full_name}
                className="h-full w-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              initials
            )}
          </div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate tracking-tight">
            {user?.full_name}
          </p>
          <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider truncate">
            {user?.role?.replace("_", " ")}
          </p>
        </div>
      </div>

      {/* Quick Access Cards */}
      <div className="flex gap-2 px-0.5">
        {[
          {
            label: "Activity",
            icon: History,
            to: "/my-activity",
            color: "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400",
          },
          {
            label: "Archive",
            icon: Archive,
            to: "/archive",
            color: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
          },
        ].map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            onClick={onMobileClose}
            className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white dark:bg-surface-400 border border-slate-200 dark:border-white/5 active:scale-95 transition-all shadow-xs"
          >
            <div className={`p-1.5 rounded-lg shrink-0 ${item.color}`}>
              <item.icon className="h-4 w-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </div>
  );
};

export default SidebarMobileAccount;
