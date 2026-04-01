import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getUserRole } from "../../lib/roleFilters";
import { navGroups } from "./navConfig";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  History,
  Archive,
  Settings,
  Sun,
  Moon,
  Plus,
  ChevronsUpDown,
  Megaphone,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { useSidebarCollapsed } from "../../hooks/useSidebarCollapsed";
import { useAuthUser } from "../../hooks/useAuthUser";
import { useVisibleNewActions } from "../../hooks/useVisibleNewActions";
import { useNavigate } from "react-router-dom";

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
  const user = useAuthUser();
  const [imgError, setImgError] = React.useState(false);

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

  // Auto-close mobile sidebar on route change
  React.useEffect(() => {
    if (mobileOpen) {
      onMobileClose?.();
    }
  }, [location.pathname]);

  const visibleNewActions = useVisibleNewActions();

  // ── Desktop Profile Components ──────────────────────────────────────────────

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
    <>
      <div
        className={[
          "fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onMobileClose}
      />

      {collapsed && (
        <button
          type="button"
          onClick={toggle}
          title="Expand sidebar"
          className="hidden md:flex fixed top-7 -translate-y-1/2 z-[110] left-[calc(3.5rem-12px)] cursor-pointer items-center justify-center h-6 w-6 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm transition-all duration-200"
        >
          <PanelLeftOpen className="h-3.5 w-3.5" />
        </button>
      )}

      <aside
        className={[
          "md:flex md:flex-col md:h-screen md:sticky md:top-0 md:shrink-0 fixed inset-y-0 left-0 z-[100] flex flex-col h-full border-r border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 transition-[width,transform] duration-300 ease-in-out overflow-hidden",
          mobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0",
          collapsed ? "w-64 md:w-14" : "w-64 md:w-56",
        ].join(" ")}
      >
        {/* Logo header */}
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
              <button type="button" onClick={onThemeToggle} className="flex md:hidden h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition">
                {theme === "dark" ? <Sun className="h-4.5 w-4.5 text-amber-500" /> : <Moon className="h-4.5 w-4.5" />}
              </button>
            )}
            {mobileOpen ? (
              <button type="button" onClick={onMobileClose} className="cursor-pointer shrink-0 flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 transition-all shadow-sm">
                <Menu className="h-4.5 w-4.5" />
              </button>
            ) : !collapsed && (
              <button type="button" onClick={toggle} className="cursor-pointer shrink-0 flex items-center justify-center h-6 w-6 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 hover:text-slate-700 dark:hover:text-slate-200 shadow-sm transition-colors">
                <PanelLeftClose className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Identity Section (Mobile uses direct identification, Desktop uses Card) */}
        {mobileOpen && (
          <div className="shrink-0 px-4 py-4 border-b border-slate-100 dark:border-surface-400 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-brand-500 flex items-center justify-center text-white text-xs font-bold border-2 border-white dark:border-surface-500 overflow-hidden shadow-sm shrink-0">
              {!imgError && user?.profile_photo_url ? (
                <img src={user.profile_photo_url} alt={user.full_name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
              ) : initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.full_name}</p>
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide truncate">{user?.role?.replace("_", " ")}</p>
            </div>
          </div>
        )}

        {/* New button (Desktop only) */}
        {visibleNewActions.length > 0 && !mobileOpen && (
          <div className="hidden md:block shrink-0 px-2 py-3" ref={newRef}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setNewOpen((o) => !o)}
                className={[
                  "cursor-pointer flex items-center rounded-md text-sm font-semibold transition-all duration-150 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sm",
                  collapsed ? "justify-center w-full px-0 h-9" : "gap-2 px-4 h-9",
                ].join(" ")}
              >
                <Plus className="h-4 w-4 shrink-0" />
                {!collapsed && <span>New</span>}
              </button>
              {newOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 w-52 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 shadow-md py-1">
                  {visibleNewActions.map((action) => (
                    <button
                      key={action.to}
                      onClick={() => { setNewOpen(false); navigate(action.to, action.state ? { state: action.state } : undefined); }}
                      className="cursor-pointer flex w-full items-center gap-3 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
                    >
                      <action.icon className="h-4 w-4 text-slate-400 dark:text-slate-500 shrink-0" />
                      {action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation list */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter((item) => !item.roles || item.roles.includes(role));
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                {!collapsed || mobileOpen ? <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-slate-400/80 dark:text-slate-500/80">{group.label}</p> : <div className="mb-1.5 mx-2 border-t border-slate-200 dark:border-surface-400" />}
                <ul className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const isSharedMobile = ["/dashboard", "/work-queue", "/document-requests", "/documents"].includes(item.to);
                    return (
                      <li key={item.to} className={isSharedMobile ? "md:block hidden" : ""}>
                        <NavLink
                          to={item.to}
                          className={({ isActive }) => [
                            "group flex w-full items-center rounded-md text-sm font-medium transition-colors duration-150 cursor-pointer",
                            collapsed && !mobileOpen ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
                            isActive ? "bg-slate-100 dark:bg-surface-400 text-slate-800 dark:text-slate-100" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
                          ].join(" ")}
                        >
                          <item.icon className="h-4 w-4 shrink-0 transition-colors text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                          {!collapsed || mobileOpen ? <span className="truncate">{item.label}</span> : null}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* ── FOOTER LOGIC ─────────────────────────────────────────────────── */}

        {/* MOBILE: Direct Links in Sidebar Footer */}
        {mobileOpen && (
          <div className="shrink-0 border-t border-slate-100 dark:border-surface-400 p-2 bg-slate-50/10 dark:bg-black/5 space-y-0.5">
            {[
              { label: "My Activity", icon: History, to: "/my-activity" },
              { label: "Archive", icon: Archive, to: "/archive" },
              { label: "Settings", icon: Settings, to: "/settings" },
            ].map((item) => (
              <NavLink key={item.label} to={item.to} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-surface-400 rounded-md">
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}

            <div className="py-1 px-3">
              <div className="h-px bg-slate-200 dark:bg-surface-400 opacity-50" />
            </div>

            {[
              { label: "What's New", icon: Megaphone, to: "/whats-new" },
              { label: "Report Issue", icon: AlertCircle, to: "/report-issue" },
              { label: "Help & Support", icon: HelpCircle, to: "/help-support" },
            ].map((item) => (
              <NavLink key={item.label} to={item.to} className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-surface-400 rounded-md">
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            ))}

            <div className="pt-1">
              <button onClick={onLogout} className="flex w-full items-center gap-3 px-3 py-2 text-sm font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-md transition-all">
                <LogOut className="h-4 w-4 shrink-0" />
                <span className="truncate">Log Out</span>
              </button>
            </div>
          </div>
        )}

        {/* DESKTOP: Identity Card + Dropdown Menu */}
        {!mobileOpen && (
          <div className="shrink-0 border-t border-slate-200 dark:border-surface-400 bg-slate-50/40 dark:bg-black/10" ref={profileRef}>
            <div className="relative px-2 py-2.5">
              {profileOpen && <ProfileDropdownContent />}
              <button
                onClick={() => setProfileOpen((o) => !o)}
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
        )}
      </aside>
    </>
  );
};

export default Sidebar;
