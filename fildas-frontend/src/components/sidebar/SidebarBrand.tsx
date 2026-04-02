import React from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Menu, PanelLeftClose } from "lucide-react";

interface SidebarBrandProps {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  onMobileClose?: () => void;
  onThemeToggle?: () => void;
  theme: "light" | "dark";
}

const SidebarBrand: React.FC<SidebarBrandProps> = ({
  collapsed,
  mobileOpen,
  toggle,
  onMobileClose,
  onThemeToggle,
  theme,
}) => {
  const navigate = useNavigate();

  return (
    <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 px-3 h-13.5">
      <div
        className="flex items-center gap-2 min-w-0 overflow-hidden cursor-pointer"
        onClick={(collapsed && !mobileOpen) ? toggle : () => navigate("/dashboard")}
      >
        <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-surface-400/50 p-1 flex items-center justify-center">
          <img src="/favicon.png" alt="FilDAS" className="h-full w-full object-contain" />
        </div>
        {(!collapsed || mobileOpen) && (
          <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
            FilDAS
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        {mobileOpen && (
          <button
            type="button"
            onClick={onThemeToggle}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition"
          >
            {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
          </button>
        )}
        {mobileOpen ? (
          <button
            type="button"
            onClick={onMobileClose}
            className="cursor-pointer shrink-0 flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 transition-all shadow-sm"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        ) : !collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="cursor-pointer shrink-0 flex items-center justify-center h-6 w-6 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm transition-colors"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SidebarBrand;
