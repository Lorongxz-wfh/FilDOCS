import React from "react";
import { NavLink } from "react-router-dom";
import {
  History,
  Settings,
  Megaphone,
  AlertCircle,
  HelpCircle,
  LogOut,
  ChevronsUpDown,
  Archive,
  User
} from "lucide-react";

interface SidebarProfileProps {
  user: any;
  collapsed: boolean;
  profileOpen: boolean;
  setProfileOpen: (open: boolean) => void;
  profileRef: React.RefObject<HTMLDivElement | null>;
  imgError: boolean;
  setImgError: (error: boolean) => void;
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
  onLogout,
}) => {
  const ProfileDropdownContent = () => (
    <div className={[
      "absolute z-50 rounded-xl border border-neutral-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl py-1.5 overflow-hidden",
      collapsed ? "left-[calc(100%+8px)] bottom-0 w-64 animate-pop-in-left" : "left-2 right-2 bottom-full mb-2 animate-pop-in-bottom"
    ].join(" ")}>
      <div className="px-3.5 py-2 border-b border-neutral-100 dark:border-surface-400">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-surface-100/50">Account</p>
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
            className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] font-semibold text-neutral-600 dark:text-surface-100 hover:bg-neutral-50 dark:hover:bg-surface-400 transition-colors"
          >
            <item.icon className="h-4.5 w-4.5 text-neutral-400 dark:text-neutral-500" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="px-3.5 py-2 border-t border-neutral-100 dark:border-surface-400 mt-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-surface-100/50">Support</p>
      </div>

      <div className="py-1">
        {[
          { label: "What's New", icon: Megaphone, to: "/whats-new" },
          { label: "Report Issue", icon: AlertCircle, to: "/report-issue" },
          { label: "Help & Support", icon: HelpCircle, to: "/help" },
        ].map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            className="flex items-center gap-3 px-3.5 py-2.5 text-[13.5px] font-semibold text-neutral-600 dark:text-surface-100 hover:bg-neutral-50 dark:hover:bg-surface-400 transition-colors"
          >
            <item.icon className="h-4.5 w-4.5 text-neutral-400 dark:text-neutral-500" />
            {item.label}
          </NavLink>
        ))}
      </div>

      <div className="border-t border-neutral-100 dark:border-surface-400 mt-1 pt-1 pb-1">
        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-3.5 py-2.5 text-[13.5px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
        >
          <LogOut className="h-4.5 w-4.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="shrink-0 border-t border-neutral-200 dark:border-surface-400 bg-neutral-50/40 dark:bg-black/10" ref={profileRef}>
      <div className="relative px-2 py-3">
        {profileOpen && <ProfileDropdownContent />}
        <button
          onClick={() => setProfileOpen(!profileOpen)}
          className={["flex w-full items-center gap-2.5 py-2 transition-all group rounded-lg", collapsed ? "justify-center" : "px-2 hover:bg-neutral-100 dark:hover:bg-surface-400", profileOpen ? "bg-neutral-100 dark:bg-surface-400" : ""].join(" ")}
        >
          <div className="h-9 w-9 shrink-0 rounded-lg bg-neutral-100 dark:bg-surface-400 flex items-center justify-center border border-neutral-200 dark:border-surface-300 overflow-hidden shadow-sm transition-colors">
            {!imgError && user?.profile_photo_url ? (
              <img src={user.profile_photo_url} alt={user.full_name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
            ) : (
              <User className="h-5 w-5 text-neutral-400 dark:text-neutral-500" strokeWidth={2.5} />
            )}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[13px] font-bold text-neutral-900 dark:text-surface-50 truncate">{user?.full_name}</p>
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wide truncate">{user?.email}</p>
              </div>
              <ChevronsUpDown className="h-3.5 w-3.5 text-neutral-400 group-hover:text-neutral-600" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SidebarProfile;
