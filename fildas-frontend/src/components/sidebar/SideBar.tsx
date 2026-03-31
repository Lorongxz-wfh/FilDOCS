import React from "react";
import { NavLink } from "react-router-dom";
import { getUserRole, isSysAdmin } from "../../lib/roleFilters";
import { useAdminDebugMode } from "../../hooks/useAdminDebugMode";
import { navGroups, newActions } from "./navConfig";
import {
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  History,
  Archive,
  Megaphone,
  Settings,
  Plus,
  ChevronsUpDown,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useNavigate } from "react-router-dom";

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
  const isAdminUser = role === "ADMIN" || isSysAdmin(role);
  const adminDebugMode = useAdminDebugMode();
  const { collapsed, toggle } = useSidebarCollapsed();
  const user = useAuthUser();

  const initials = (user?.full_name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  const navigate = useNavigate();
  const [newOpen, setNewOpen] = React.useState(false);
  const [profileOpen, setProfileOpen] = React.useState(false);
  const newRef = React.useRef<HTMLDivElement>(null);
  const profileRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (newRef.current && !newRef.current.contains(e.target as Node)) {
        setNewOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const DOC_CREATE_ROUTES = [
    "/documents/create",
    "/document-requests",
    "/templates",
  ];
  const visibleNewActions = newActions.filter((a) => {
    if (!a.roles) return true;
    if (a.roles.includes(role)) return true;
    if (role === "ADMIN" && adminDebugMode && DOC_CREATE_ROUTES.includes(a.to))
      return true;
    return false;
  });

  const handleLogout = () => {
    onLogout?.();
  };

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Collapse toggle — only pulled outside when collapsed */}
      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          title="Expand sidebar"
          className={[
            "fixed top-7 -translate-y-1/2 z-60",
            "left-[calc(3.5rem-12px)]",
            "cursor-pointer flex items-center justify-center h-6 w-6 rounded-md",
            "border border-slate-200 dark:border-surface-300",
            "bg-white dark:bg-surface-500",
            "text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400",
            "hover:text-slate-700 dark:hover:text-slate-200",
            "shadow-sm transition-all duration-200",
          ].join(" ")}
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}

      <aside
        className={[
          "md:flex md:flex-col md:h-screen md:sticky md:top-0 md:shrink-0",
          "fixed inset-y-0 left-0 z-50 flex flex-col h-full",
          "border-r border-slate-200 bg-white",
          "dark:border-surface-400 dark:bg-surface-500",
          "transition-[width,transform] duration-200 ease-in-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
          collapsed ? "w-14" : "w-64 md:w-56",
        ].join(" ")}
      >
        {/* Logo header — Restored height for Navbar uniformity */}
        <div className="shrink-0 flex items-center justify-between border-b border-slate-200 dark:border-surface-400 px-3 h-13.5">
          <div
            className="flex items-center gap-2 min-w-0 overflow-hidden cursor-pointer"
            onClick={collapsed ? toggle : () => navigate("/dashboard")}
            title={collapsed ? "Expand sidebar" : "Go to dashboard"}
          >
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded bg-slate-100 dark:bg-surface-400/50 p-1 flex items-center justify-center">
                <img
                  src="/favicon.png"
                  alt="FilDAS"
                  className="h-full w-full object-contain"
                />
              </div>
              {!collapsed && (
                <span className="text-[17px] font-bold tracking-tight text-slate-900 dark:text-slate-100 truncate">
                  FilDAS
                </span>
              )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={toggle}
              title="Collapse sidebar"
              className="cursor-pointer shrink-0 flex items-center justify-center h-6 w-6 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm transition-colors"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* New button — same size, style updated to ERPNext neutral */}
        {visibleNewActions.length > 0 && (
          <div className="shrink-0 px-2 py-3" ref={newRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNewOpen((o) => !o)}
                className={[
                  "cursor-pointer flex items-center rounded-md text-sm font-semibold transition-all duration-150",
                  "bg-sky-600 hover:bg-sky-700 active:bg-sky-800",
                  "text-white shadow-sm",
                  collapsed
                    ? "justify-center w-full px-0 h-9"
                    : "gap-2 px-4 h-9",
                ].join(" ")}
                title={collapsed ? "New" : undefined}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {!collapsed && <span>New</span>}
              </button>

              {newOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 shadow-md py-1">
                  {visibleNewActions.map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.to}
                        type="button"
                        onClick={() => {
                          setNewOpen(false);
                          navigate(
                            action.to,
                            action.state ? { state: action.state } : undefined,
                          );
                        }}
                        className="cursor-pointer flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
                      >
                        <Icon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                        {action.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin debug mode indicator — unchanged */}
        {isAdminUser && adminDebugMode && (
          <div className="shrink-0 px-2 pb-1">
            <div
              className={[
                "flex items-center gap-1.5 rounded-md border px-2 py-1",
                "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
                collapsed ? "justify-center" : "",
              ].join(" ")}
              title="Developer mode is active"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0 animate-pulse" />
              {!collapsed && (
                <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">
                  Dev mode
                </span>
              )}
            </div>
          </div>
        )}

        {/* Nav — Compressed spacing to avoid scrollbars */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1 space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(
              (item) => !item.roles || item.roles.includes(role),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={group.label}>
                {!collapsed && (
                  <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80">
                    {group.label}
                  </p>
                )}
                {collapsed && (
                  <div className="mb-1.5 mx-2 border-t border-slate-200 dark:border-surface-400" />
                )}

                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.to}>
                        <NavLink
                          to={item.to}
                          end={
                            item.to === "/documents" ||
                            item.to === "/work-queue"
                          }
                          title={collapsed ? item.label : undefined}
                          className={({ isActive }) =>
                            [
                              "group flex w-full items-center rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer",
                              collapsed
                                ? "justify-center px-0 py-2"
                                : "gap-3 px-3 py-2",
                              isActive
                                ? // ERPNext active: flat gray fill, no left bar
                                  "bg-slate-100 dark:bg-surface-400 text-slate-800 dark:text-slate-100"
                                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
                            ].join(" ")
                          }
                        >
                          {({ isActive }) => (
                            <>
                              <Icon
                                className={[
                                  "h-4 w-4 shrink-0 transition-colors",
                                  isActive
                                    ? "text-brand-400 dark:text-brand-300"
                                    : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300",
                                ].join(" ")}
                              />
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

        {/* Bottom strip — Refined with Profile Dropdown and subtle sectioning */}
        <div 
          className="shrink-0 border-t border-slate-200 dark:border-surface-400 bg-slate-50/40 dark:bg-black/10" 
          ref={profileRef}
        >
          <div className="relative px-2 py-2.5">
            {/* Upward Dropdown — Solid & Professional */}
            {profileOpen && (
              <div 
                className={[
                  "absolute bottom-full z-50 mb-2 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl py-1 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200",
                  collapsed ? "left-1 w-52" : "left-2 right-2"
                ].join(" ")}
              >
                <div className="px-3.5 py-2 border-b border-slate-100 dark:border-surface-400">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Account
                  </p>
                </div>
                
                <div className="py-1">
                  {[
                    { label: "Settings", icon: Settings, to: "/settings" },
                    { label: "My Activity", icon: History, to: "/my-activity" },
                    { label: "Archive", icon: Archive, to: "/archive" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate(item.to);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
                    >
                      <item.icon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 dark:border-surface-400 pt-1">
                  <div className="px-3.5 py-1.5 font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Support
                  </div>
                  {[
                    { label: "What's New", icon: Megaphone, to: "/whats-new" },
                    { label: "Report Issue", icon: AlertCircle, to: "/report-issue" },
                    { label: "Help & Support", icon: HelpCircle, to: "/help" },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => {
                        setProfileOpen(false);
                        navigate(item.to);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
                    >
                      <item.icon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>

                <div className="mt-1 border-t border-slate-100 dark:border-surface-400 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      handleLogout();
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}

            {/* Profile Trigger */}
            <button
              type="button"
              onClick={() => setProfileOpen((o) => !o)}
              className={[
                "flex w-full items-center gap-2.5 rounded-lg p-1.5 transition-all duration-200 border border-transparent shadow-sm",
                profileOpen 
                  ? "bg-white dark:bg-surface-400 shadow-md ring-1 ring-slate-200 dark:ring-surface-300 border-slate-200 dark:border-surface-300" 
                  : "bg-white/50 dark:bg-white/[0.03] hover:bg-white dark:hover:bg-surface-400 hover:shadow-md hover:border-slate-200 dark:hover:border-surface-300",
                collapsed ? "justify-center" : "px-2",
              ].join(" ")}
              title={collapsed ? "Account Settings" : undefined}
            >
              <div className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-200 dark:bg-surface-300 text-[11px] font-bold text-slate-600 dark:text-slate-700 shadow-sm border border-white/50 overflow-hidden transition-transform active:scale-95",
                profileOpen ? "scale-105 ring-2 ring-brand-400/20" : ""
              ].join(" ")}>
                {(user as any)?.profile_photo_url ? (
                  <img
                    src={(user as any).profile_photo_url}
                    alt={user?.full_name ?? ""}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  initials || "?"
                )}
              </div>
              
              {!collapsed && (
                <>
                  <div className="flex-1 min-w-0 text-left pl-0.5">
                    <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
                      {user?.full_name ?? "User"}
                    </p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                      {(user as any)?.email ?? ""}
                    </p>
                  </div>
                  <ChevronsUpDown className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400 shrink-0 opacity-80" />
                </>
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
