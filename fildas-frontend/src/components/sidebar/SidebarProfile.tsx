import React from "react";
import { NavLink } from "react-router-dom";
import { 
  History, 
  Archive, 
  Settings, 
  Megaphone, 
  AlertCircle, 
  HelpCircle, 
  LogOut, 
  ChevronsUpDown 
} from "lucide-react";

interface SidebarProfileProps {
  user: any;
  collapsed: boolean;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement | null>;
  imgError: boolean;
  setImgError: (error: boolean) => void;
  initials: string;
  onLogout?: () => void;
}

const SidebarProfile: React.FC<SidebarProfileProps> = ({
  user,
  collapsed,
  profileOpen,
  setProfileOpen,
  profileRef,
  imgError,
  setImgError,
  initials,
  onLogout,
}) => {
  const ProfileDropdownContent = () => (
    <div className={[
      "absolute z-50 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200 bottom-full mb-2",
      collapsed ? "left-1 w-52" : "left-2 right-2"
    ].join(" ")}>
      <div className="px-3.5 py-2 border-b border-slate-100 dark:border-surface-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Account</p>
      </div>
      <div className="py-1">
        {[
          { label: "My Activity", icon: History, to: "/my-activity" },
          { label: "Archive", icon: Archive, to: "/archive" },
          { label: "Settings", icon: Settings, to: "/settings" },
        ].map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className="flex items-center gap-3 px-3.5 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
          >
            <item.icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="px-3.5 py-2 border-t border-slate-100 dark:border-surface-400 mt-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Support</p>
      </div>

      <div className="py-1">
        {[
          { label: "What's New", icon: Megaphone, to: "/whats-new" },
          { label: "Report Issue", icon: AlertCircle, to: "/report-issue" },
          { label: "Help & Support", icon: HelpCircle, to: "/help-support" },
        ].map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className="flex items-center gap-3 px-3.5 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
          >
            <item.icon className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-slate-100 dark:border-surface-400 mt-1 pt-1 pb-1">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-3.5 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="shrink-0 border-t border-slate-200 dark:border-surface-400 bg-slate-50/40 dark:bg-black/10" ref={profileRef}>
      <div className="relative px-2 py-2.5">
        {profileOpen && <ProfileDropdownContent />}
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className={["flex w-full items-center gap-2.5 py-1.5 transition-all group rounded-lg", collapsed ? "justify-center" : "px-2 hover:bg-slate-100 dark:hover:bg-surface-400", profileOpen ? "bg-slate-100 dark:bg-surface-400" : ""].join(" ")}
        >
          <div className="h-8.5 w-8.5 shrink-0 rounded-lg bg-brand-500 flex items-center justify-center text-white text-xs font-bold border border-white dark:border-surface-500 overflow-hidden shadow-sm">
            {!imgError && user?.profile_photo_url ? (
              <img src={user.profile_photo_url} alt={user.full_name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
            ) : initials}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[12px] font-bold text-slate-900 dark:text-slate-100 truncate">{user?.full_name}</p>
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate">{user?.email}</p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SidebarProfile;
