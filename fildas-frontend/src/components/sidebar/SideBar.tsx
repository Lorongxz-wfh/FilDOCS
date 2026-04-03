import React from "react";
import { useLocation } from "react-router-dom";
import { getUserRole } from "../../lib/roleFilters";
import { navGroups } from "./navConfig";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { useVisibleNewActions } from "../../hooks/useVisibleNewActions";
import { useSidebarUI } from "../../hooks/useSidebarUI";

// Sub-components
import SidebarBrand from "./SidebarBrand";
import SidebarMobileAccount from "./SidebarMobileAccount";
import SidebarAction from "./SidebarAction";
import SidebarNavItem from "./SidebarNavItem";
import SidebarProfile from "./SidebarProfile";
import SidebarMobileFooter from "./SidebarMobileFooter";

type SidebarProps = {
  onLogout?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  theme?: "light" | "dark";
  onThemeToggle?: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({
  onLogout,
  mobileOpen = false,
  onMobileClose,
  theme = "light",
  onThemeToggle,
}) => {
  const location = useLocation();
  const role = getUserRole();
  const { collapsed, toggle } = useSidebarCollapsed();
  const visibleNewActions = useVisibleNewActions();
  
  const {
    user,
    newOpen,
    setNewOpen,
    profileOpen,
    setProfileOpen,
    imgError,
    setImgError,
    newRef,
    profileRef,
  } = useSidebarUI();

  // Auto-close mobile sidebar on route change
  React.useEffect(() => {
    if (mobileOpen) {
      onMobileClose?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        className={[
          "fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onMobileClose}
      />

      {/* Floating Expand Toggle (Desktop Collapsed) */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          title="Expand sidebar"
          className="hidden md:flex fixed top-7 -translate-y-1/2 z-[110] left-[calc(3.5rem-12px)] cursor-pointer items-center justify-center h-6 w-6 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm transition-all duration-200"
        >
          {/* Using a simple div instead of re-importing PanelLeftOpen to keep imports clean if needed, 
              but let's just use the previous logic or import Lucide if strictly necessary */}
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-panel-left-open"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="m14 9 3 3-3 3"/></svg>
        </button>
      )}

      <aside
        className={[
          "md:flex md:flex-col md:h-screen md:sticky md:top-0 md:shrink-0 fixed inset-y-0 left-0 z-[100] flex flex-col h-full border-r border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 transition-[width,transform] duration-300 ease-in-out overflow-hidden",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
          collapsed ? "w-64 md:w-14" : "w-64 md:w-56",
        ].join(" ")}
      >
        <SidebarBrand
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          toggle={toggle}
          onMobileClose={onMobileClose}
          onThemeToggle={onThemeToggle}
          theme={theme}
        />

        {mobileOpen && (
          <SidebarMobileAccount
            user={user}
            imgError={imgError}
            setImgError={setImgError}
            onMobileClose={onMobileClose}
          />
        )}

        <SidebarAction
          collapsed={collapsed}
          newOpen={newOpen}
          setNewOpen={setNewOpen}
          newRef={newRef}
          visibleNewActions={visibleNewActions}
        />

        {/* Navigation Section */}
        <nav className={["flex-1 overflow-y-auto px-2 py-3", mobileOpen ? "space-y-1" : "space-y-4"].join(" ")}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                {(!collapsed && !mobileOpen) ? (
                  <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80">{group.label}</p>
                ) : mobileOpen ? null : (
                  <div className="mb-1.5 mx-2 border-t border-slate-200 dark:border-surface-400" />
                )}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => (
                    <SidebarNavItem
                      key={item.to}
                      to={item.to}
                      label={item.label}
                      icon={item.icon}
                      collapsed={collapsed}
                      mobileOpen={mobileOpen}
                      onMobileClose={onMobileClose}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </nav>

        {mobileOpen ? (
          <SidebarMobileFooter onLogout={onLogout} onMobileClose={onMobileClose} />
        ) : (
          <SidebarProfile
            user={user}
            collapsed={collapsed}
            profileOpen={profileOpen}
            setProfileOpen={setProfileOpen}
            profileRef={profileRef}
            imgError={imgError}
            setImgError={setImgError}
            onLogout={onLogout}
          />
        )}
      </aside>
    </>
  );
};

export default Sidebar;
