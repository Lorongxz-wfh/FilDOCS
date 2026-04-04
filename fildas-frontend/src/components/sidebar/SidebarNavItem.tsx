import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./navConfig";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose?: () => void;
  children?: NavItem[];
  userRole?: string;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  to,
  label,
  icon: Icon,
  collapsed,
  mobileOpen,
  onMobileClose,
  children,
  userRole,
}) => {
  const { pathname } = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = children && children.length > 0;
  const filteredChildren = children?.filter(child => !child.roles || child.roles.includes(userRole || "")) || [];

  const isSharedMobile = ["/dashboard", "/work-queue", "/document-requests", "/documents"].includes(to);

  // Custom active logic to handle /documents/:id (Flow) vs /documents (Library)
  const isActuallyActive = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    
    // Check if any child is active
    if (hasChildren) {
      if (filteredChildren.some(child => pathname.startsWith(child.to))) return true;
    }

    // Work Queue highlights for: /work-queue, /documents/all, or /documents/:id (Flow)
    if (to === "/work-queue") {
      if (pathname === "/work-queue" || pathname === "/documents/all") return true;
      // It's a flow page if path is /documents/:id AND not /documents/create AND not /view
      if (segments.length === 2 && segments[0] === "documents" && segments[1] !== "create") {
         return true;
      }
      return false;
    }

    // Library highlights for: /documents, /documents/create, or /documents/:id/view
    if (to === "/documents") {
      if (pathname === "/documents" || pathname === "/documents/create") return true;
      // It's a view page if path is /documents/:id/view (length 3)
      if (segments.length === 3 && segments[0] === "documents" && segments[2] === "view") return true;
      return false;
    }

    // Default prefix match for other items
    return pathname.startsWith(to);
  }, [pathname, to, hasChildren, filteredChildren]);

  useEffect(() => {
    if (isActuallyActive && hasChildren) {
      setIsExpanded(true);
    }
  }, [isActuallyActive, hasChildren]);

  const handleToggle = (e: React.MouseEvent) => {
    // Only toggle (and prevent navigation) if we are already ON the parent page
    // Otherwise, allow the NavLink to navigate to 'to'
    if (hasChildren && pathname === to) {
      e.preventDefault();
      setIsExpanded(!isExpanded);
    }
    
    if (mobileOpen && !hasChildren) onMobileClose?.();
  };

  const navCls = [
    "group relative flex w-full items-center transition-all cursor-pointer overflow-hidden",
    // Desktop Styles
    !mobileOpen ? [
      "rounded-md text-sm font-medium duration-150",
      collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
      isActuallyActive
        ? "bg-slate-100 dark:bg-surface-400 text-slate-800 dark:text-slate-100"
        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
    ].join(" ") : "",
    // Mobile Styles
    mobileOpen ? [
      "rounded-xl text-[12px] font-bold duration-200 active:scale-[0.98] gap-3 px-3 py-1.5 h-9.5",
      isActuallyActive
        ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
        : "text-slate-500 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200 shadow-none",
    ].join(" ") : ""
  ].join(" ");

  const iconCls = [
    "shrink-0 transition-all duration-200",
    // Desktop Icon
    !mobileOpen ? "h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" : "",
    // Mobile Icon
    mobileOpen ? [
      "h-4 w-4",
      isActuallyActive ? "text-brand-500" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
    ].join(" ") : ""
  ].join(" ");

  return (
    <li className={isSharedMobile ? "md:block hidden" : ""}>
      <NavLink
        to={to}
        onClick={handleToggle}
        className={navCls}
      >
        <Icon className={iconCls} />
        
        {(!collapsed || mobileOpen) && (
          <span className={mobileOpen ? "truncate tracking-tight select-none flex-1" : "truncate flex-1"}>
            {label}
          </span>
        )}

        {hasChildren && isActuallyActive && (!collapsed || mobileOpen) && (
          <ChevronDown 
            className={[
              "h-3.5 w-3.5 transition-transform duration-200",
              isExpanded ? "rotate-0" : "-rotate-90"
            ].join(" ")} 
          />
        )}
      </NavLink>

      {/* Animated Nesting Container */}
      {hasChildren && (!collapsed || mobileOpen) && (
        <div 
          className={[
            "grid transition-all duration-300 ease-in-out",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0 pointer-events-none"
          ].join(" ")}
        >
          <div className="overflow-hidden">
            <ul className={[
              "mt-1.5 mb-1.5 flex flex-col gap-0.5",
              !mobileOpen ? "ml-1" : "ml-4"
            ].join(" ")}>
              {filteredChildren.map((child) => (
                <li key={child.to}>
                  <NavLink
                    to={child.to}
                    onClick={() => {
                      if (mobileOpen) onMobileClose?.();
                    }}
                    className={({ isActive }) => [
                      "flex items-center gap-3 px-3 py-1.5 rounded-md transition-all",
                      // Align text/icons with parent label text (Icon offset: gap-3 + icon-4px)
                      !mobileOpen ? "pl-9" : "", 
                      "text-[13px] font-medium leading-tight",
                      isActive
                        ? "text-slate-900 dark:text-slate-100 bg-slate-100/50 dark:bg-surface-400/50"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
                    ].join(" ")}
                  >
                    {({ isActive }) => (
                      <>
                        <child.icon className={[
                          "h-3.5 w-3.5 shrink-0 transition-colors",
                          isActive ? "text-brand-500" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600"
                        ].join(" ")} />
                        <span className="truncate">{child.label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
};

export default SidebarNavItem;
