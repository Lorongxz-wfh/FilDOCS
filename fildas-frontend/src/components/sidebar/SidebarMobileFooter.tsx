import React from "react";
import { NavLink } from "react-router-dom";
import { Megaphone, AlertCircle, HelpCircle, Settings, LogOut } from "lucide-react";

interface SidebarMobileFooterProps {
  onLogout?: () => void;
  onMobileClose?: () => void;
}

const SidebarMobileFooter: React.FC<SidebarMobileFooterProps> = ({ onLogout, onMobileClose }) => {
  return (
    <div className="shrink-0 p-2.5 bg-slate-50/10 dark:bg-black/5 space-y-1.5">
      <div className="flex items-center gap-1 bg-slate-100/30 dark:bg-white/5 p-1 rounded-lg">
        {[
          { label: "What's New", icon: Megaphone, to: "/whats-new" },
          { label: "Report Issue", icon: AlertCircle, to: "/report-issue" },
          { label: "Help & Support", icon: HelpCircle, to: "/help-support" },
        ].map((item) => (
          <NavLink
            key={item.label}
            to={item.to}
            onClick={onMobileClose}
            className="group flex-1 flex h-8.5 items-center justify-center text-slate-400 dark:text-slate-500 hover:text-brand-500 hover:bg-white dark:hover:bg-surface-500 rounded-md transition-all active:scale-95"
            title={item.label}
          >
            <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
          </NavLink>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <NavLink
          to="/settings"
          onClick={onMobileClose}
          className="flex-1 flex items-center gap-2.5 px-3 py-2 text-[12px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-200 dark:hover:text-white bg-white dark:bg-surface-400 rounded-xl border border-slate-200 dark:border-white/10 active:scale-[0.98] transition-all"
        >
          <Settings className="h-4 w-4" />
          <span className="truncate">Settings</span>
        </NavLink>
        <button
          onClick={onLogout}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/30 border border-rose-100 dark:border-rose-900/30 transition-all active:scale-95"
          title="Log Out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default SidebarMobileFooter;
