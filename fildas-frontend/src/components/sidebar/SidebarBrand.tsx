import React from "react";
import { useNavigate } from "react-router-dom";
import { Sun, Moon, Monitor, Menu, PanelLeftClose, Ghost } from "lucide-react";
import { useAdminDebugMode } from "../../hooks/useAdminDebugMode";
import { getUserRole } from "../../lib/roleFilters";
import logoUrl from "../../assets/FCU Logo.png";

interface SidebarBrandProps {
  collapsed: boolean;
  mobileOpen: boolean;
  toggle: () => void;
  onMobileClose?: () => void;
  onThemeToggle?: () => void;
  theme: "light" | "dark" | "system";
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
  const debugMode = useAdminDebugMode();

  return (
    <div className="shrink-0 flex items-center justify-between border-b border-neutral-200 dark:border-surface-400 px-3 h-13.5">
      <div
        className="flex items-center gap-2.5 min-w-0 overflow-hidden cursor-pointer"
        onClick={(collapsed && !mobileOpen) ? toggle : () => navigate("/dashboard")}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 overflow-hidden rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-white/10 shrink-0 shadow-xs">
            <img
              src={logoUrl}
              alt="FCU Logo"
              className="h-full w-full object-contain p-0.5"
            />
          </div>
          
          {(!collapsed || mobileOpen) && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[17px] font-bold tracking-tight text-neutral-900 dark:text-surface-50 truncate">
                FilDAS
              </span>
              {(() => {
                const role = getUserRole();
                const isAdmin = role === "ADMIN" || role === "SYSADMIN";
                if (!isAdmin) return null;

                const toggleDebug = (e: React.MouseEvent) => {
                  e.stopPropagation();
                  const user = JSON.parse(localStorage.getItem("auth_user") || "{}");
                  const key = `pref_debug_mode_${user?.id}`;
                  const newVal = debugMode ? "0" : "1";
                  localStorage.setItem(key, newVal);
                  window.dispatchEvent(new CustomEvent("admin_debug_mode_changed"));
                };

                return (
                  <button
                    type="button"
                    onClick={toggleDebug}
                    className={[
                      "flex items-center justify-center h-5 w-5 rounded-full transition-all cursor-pointer",
                      debugMode 
                        ? "bg-brand-500/10 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 animate-pulse border border-brand-500/20" 
                        : "bg-slate-100 dark:bg-surface-400 text-slate-400 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 border border-slate-200 dark:border-surface-300"
                    ].join(" ")}
                    title={debugMode ? "Disable Admin Debug Mode" : "Enable Admin Debug Mode"}
                  >
                    <Ghost className="h-3 w-3" strokeWidth={2.5} />
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        {mobileOpen && (
          <button
            type="button"
            onClick={onThemeToggle}
            className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-surface-400 transition"
          >
            {theme === "dark" ? (
              <Sun className="h-4.5 w-4.5 text-amber-500" />
            ) : theme === "system" ? (
              <Monitor className="h-4.5 w-4.5 text-brand-500" />
            ) : (
              <Moon className="h-4.5 w-4.5" />
            )}
          </button>
        )}
        {mobileOpen ? (
          <button
            type="button"
            onClick={onMobileClose}
            className="cursor-pointer shrink-0 flex h-8 w-8 items-center justify-center rounded-md border border-neutral-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-surface-400 transition-all shadow-sm"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        ) : !collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="cursor-pointer shrink-0 flex items-center justify-center h-6 w-6 rounded-md border border-neutral-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-surface-400 hover:text-neutral-700 dark:hover:text-neutral-200 shadow-sm transition-colors"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default SidebarBrand;
