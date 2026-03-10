import React from "react";
import { NavLink } from "react-router-dom";
import { getUserRole } from "../../lib/roleFilters";
import { navGroups, settingsNavItem } from "./navConfig";
import { PanelLeftClose, PanelLeftOpen, LogOut, Settings } from "lucide-react";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { useAuthUser } from "../../hooks/useAuthUser";

type SidebarProps = {
  onLogout?: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const Sidebar: React.FC<SidebarProps> = ({
  onLogout,
  mobileOpen = false,
  onMobileClose,
}) => {
  const role = getUserRole();
  const { collapsed, toggle } = useSidebarCollapsed();
  const user = useAuthUser();

  const initials = (user?.full_name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={[
          // Desktop: sticky sidebar
          "md:flex md:flex-col md:h-screen md:sticky md:top-0 md:shrink-0",
          // Mobile: fixed drawer
          "fixed inset-y-0 left-0 z-50 flex flex-col h-full",
          "border-r border-slate-200 bg-white",
          "dark:border-surface-400 dark:bg-surface-500",
          "transition-[width,transform] duration-200 ease-in-out",
          // Mobile open/close
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          // Width
          collapsed ? "w-14" : "w-64 md:w-56",
        ].join(" ")}
      >
        {/* Logo + collapse toggle */}
        <div
          className={[
            "shrink-0 flex items-center border-b border-slate-200 dark:border-surface-400",
            collapsed
              ? "flex-col gap-2 px-0 py-3"
              : "justify-between px-3 py-3",
          ].join(" ")}
        >
          {/* Logo mark + name */}
          <div
            className={[
              "flex items-center gap-2.5",
              collapsed ? "justify-center" : "",
            ].join(" ")}
          >
            <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600">
              <img
                src="/favicon.png"
                alt="FilDAS"
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            {!collapsed && (
              <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                FilDAS
              </span>
            )}
          </div>

          {/* Collapse toggle */}
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={[
              "flex items-center justify-center rounded-md p-1",
              "text-slate-400 hover:bg-slate-100 hover:text-slate-700",
              "dark:hover:bg-surface-400 dark:hover:text-slate-200",
              "transition-colors",
            ].join(" ")}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-4 space-y-5">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(role),
            );

            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                {/* Group label — hidden when collapsed */}
                {!collapsed && (
                  <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    {group.label}
                  </p>
                )}

                {/* Divider when collapsed */}
                {collapsed && (
                  <div className="mb-1.5 mx-2 border-t border-slate-200 dark:border-surface-400" />
                )}

                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to} className="relative">
                        <NavLink
                          to={item.to}
                          title={collapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            [
                              "group flex w-full items-center rounded-lg text-sm font-medium transition-all",
                              collapsed
                                ? "justify-center px-0 py-2"
                                : "gap-3 px-3 py-2",
                              isActive
                                ? "bg-brand-50 text-brand-500 dark:bg-surface-400 dark:text-brand-300"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
                            ].join(" ")
                          }
                        >
                          {({ isActive }) => (
                            <>
                              {/* Left accent bar */}
                              <span
                                className={[
                                  "absolute left-0 h-6 w-0.5 rounded-r-full transition-all",
                                  isActive
                                    ? "bg-brand-400 opacity-100"
                                    : "opacity-0",
                                ].join(" ")}
                              />

                              {/* Icon */}
                              <Icon
                                className={[
                                  "h-4 w-4 shrink-0 transition-colors",
                                  isActive
                                    ? "text-brand-400 dark:text-brand-300"
                                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                                ].join(" ")}
                              />

                              {/* Label — hidden when collapsed */}
                              {!collapsed && (
                                <span className="truncate">{item.label}</span>
                              )}
                            </>
                          )}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
        {/* Bottom strip: Settings + profile + logout */}
        <div className="shrink-0 border-t border-slate-200 dark:border-surface-400">
          {/* Settings nav item */}
          <div className="px-2 pt-2">
            <NavLink
              to={settingsNavItem.to}
              title={collapsed ? settingsNavItem.label : undefined}
              className={({ isActive }) =>
                [
                  "group relative flex w-full items-center rounded-lg text-sm font-medium transition-all",
                  collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
                  isActive
                    ? "bg-brand-50 text-brand-500 dark:bg-surface-400 dark:text-brand-300"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
                ].join(" ")
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={[
                      "absolute left-0 h-6 w-0.5 rounded-r-full transition-all",
                      isActive ? "bg-brand-400 opacity-100" : "opacity-0",
                    ].join(" ")}
                  />
                  <Settings
                    className={[
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive
                        ? "text-brand-400 dark:text-brand-300"
                        : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                    ].join(" ")}
                  />
                  {!collapsed && (
                    <span className="truncate">{settingsNavItem.label}</span>
                  )}
                </>
              )}
            </NavLink>
          </div>

          {/* Profile + logout */}
          <div
            className={["px-2 pb-3 pt-1", collapsed ? "" : "px-3"].join(" ")}
          >
            {collapsed ? (
              <button
                type="button"
                onClick={onLogout}
                title={`Logout ${user?.full_name ?? ""}`}
                className="flex w-full items-center justify-center rounded-lg py-2 text-slate-400 hover:bg-slate-50 hover:text-rose-500 dark:hover:bg-surface-400 dark:hover:text-rose-400 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2.5 px-1 pt-1">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-[11px] font-semibold text-brand-600 dark:text-brand-300">
                  {initials || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">
                    {user?.full_name ?? "User"}
                  </p>
                  <p className="truncate text-[10px] text-slate-400 dark:text-slate-500">
                    {(user as any)?.email ?? ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  title="Logout"
                  className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-rose-500 dark:hover:bg-surface-400 dark:hover:text-rose-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
