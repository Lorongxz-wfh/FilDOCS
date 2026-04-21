import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./navConfig";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon?: LucideIcon;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose?: () => void;
  children?: NavItem[];
  userRole?: string;
  badgeCount?: number;
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
  badgeCount,
}) => {
  const { pathname } = useLocation();
  const [isExpanded, setIsExpanded] = useState(true);

  const hasChildren = children && children.length > 0;

  // Use the global stats directly for child badges to prevent stale states
  // and avoid mutating the shared navConfig objects.
  const filteredChildren = React.useMemo(() => {
    const list = children?.filter(child => !child.roles || child.roles.includes(userRole || "")) || [];
    return list.map(child => {
      let childBadge = 0;
      if (child.to === "/documents/all") childBadge = (window as any).__NAV_STATS__?.workflowBadge || 0;
      if (child.to === "/document-requests") childBadge = (window as any).__NAV_STATS__?.requestBadge || 0;
      
      return { ...child, badgeCount: childBadge };
    });
  }, [children, userRole, badgeCount]); // dependencies include badgeCount to trigger refresh when parent stats update

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
    "group relative flex w-full items-center cursor-pointer overflow-hidden transition-all duration-300 ease-in-out",
    // Desktop Styles
    !mobileOpen ? [
      "rounded-lg text-[14px] font-medium h-9.5",
      collapsed ? "justify-center px-0" : "px-2.5 gap-2.5",
      isActuallyActive
        ? "text-slate-900 dark:text-surface-50"
        : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-surface-50",
    ].join(" ") : [
      "rounded-xl text-[13px] font-semibold duration-150 active:scale-[0.98] h-11 gap-3 px-3",
      isActuallyActive
        ? "text-brand-600 dark:text-brand-400"
        : "text-slate-500 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-surface-50 shadow-none",
    ].join(" ")
  ].join(" ");

  const iconCls = [
    "shrink-0 transition-all duration-300 z-10",
    isActuallyActive ? "opacity-100 scale-105" : "opacity-70 group-hover:opacity-100",
    // Desktop Icon colors
    !mobileOpen ? [
      isActuallyActive ? "text-brand-500 dark:text-brand-400" : "text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300"
    ].join(" ") : "",
    // Mobile Icon colors
    mobileOpen ? [
      "h-4 w-4",
      isActuallyActive ? "text-brand-500" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-surface-50"
    ].join(" ") : ""
  ].join(" ");

  return (
    <li className={isSharedMobile ? "md:block hidden" : ""}>
      <NavLink
        to={to}
        onClick={handleToggle}
        className={navCls}
      >
        {isActuallyActive && !mobileOpen ? (
          <>
            <motion.div
              layoutId="active-bg"
              className="absolute inset-0 bg-neutral-100/80 dark:bg-surface-400/80 rounded-lg border border-neutral-200/50 dark:border-surface-300/30 "
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            />
            {collapsed && (
              <motion.div
                layoutId="active-pill"
                className="absolute left-0 top-2 bottom-2 w-1 bg-brand-500 rounded-r-full shadow-[0_0_8px_rgba(14,165,233,0.3)]"
                transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              />
            )}
          </>
        ) : null}
        
        {isActuallyActive && mobileOpen && (
          <motion.div
            layoutId="active-bg-mobile"
            className="absolute inset-0 bg-brand-500/10 rounded-xl"
            transition={{ type: "spring", bounce: 0, duration: 0.2 }}
          />
        )}
        
        {Icon && (
          <div className={!mobileOpen ? "flex items-center justify-center w-10 shrink-0 relative z-10" : "relative z-10"}>
            <Icon className={iconCls} size={mobileOpen ? 18 : 20} />
          </div>
        )}
        
        {(!collapsed || mobileOpen) && (
          <motion.span 
            initial={collapsed ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
            animate={{ opacity: 1, x: 0 }}
            className={[
              "z-10 transition-all duration-300 truncate flex-1",
              isActuallyActive ? "font-semibold" : "font-medium text-neutral-600 dark:text-neutral-400",
              mobileOpen ? "tracking-tight select-none" : ""
            ].join(" ")}
          >
            {label}
          </motion.span>
        )}

        {hasChildren && (!collapsed || mobileOpen) && (
          <ChevronDown 
            size={14}
            className={[
              "transition-transform duration-300 z-10",
              isExpanded ? "rotate-0" : "-rotate-90",
              isActuallyActive ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-500"
            ].join(" ")} 
          />
        )}
        
        {/* Badge bubble for parent or standalone items */}
        {badgeCount !== undefined && badgeCount > 0 && (
          <span 
            className={[
              "absolute z-[100] flex items-center justify-center rounded-full bg-rose-600 text-[10px] font-semibold text-white ring-2 ring-white dark:ring-surface-500",
              collapsed && !mobileOpen
                ? "right-1.5 top-1.5 h-4 w-4" // Collapsed dot/small badge
                : "right-7 top-1/2 -translate-y-1/2 px-1 min-w-[20px] h-5 " // Expanded label badge
            ].join(" ")}
          >
            {collapsed && !mobileOpen ? (badgeCount > 9 ? "!" : badgeCount) : (badgeCount > 99 ? "99+" : badgeCount)}
          </span>
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
              "mt-1 mb-2 flex flex-col gap-1 relative",
              !mobileOpen ? "ml-[1.875rem]" : "ml-4"
            ].join(" ")}>
              {filteredChildren.map((child, idx) => {
                const isLast = idx === filteredChildren.length - 1;
                return (
                  <li key={child.to} className="relative">
                    {!mobileOpen && (
                      <>
                        {/* Vertical Connector Segment */}
                        <div className={[
                          "absolute -left-[1px] top-0",
                          isLast ? "h-4.5" : "bottom-[-10px]", 
                          "w-0.5 bg-slate-300 dark:bg-surface-300"
                        ].join(" ")} />
                        
                        {/* Horizontal Branch */}
                        <div className="absolute -left-[1px] top-4.5 w-3.5 h-0.5 bg-slate-300 dark:bg-surface-300" />
                      </>
                    )}
                    <NavLink
                      to={child.to}
                      onClick={() => {
                        if (mobileOpen) onMobileClose?.();
                      }}
                      className={({ isActive }) => [
                        "group relative flex items-center gap-3 px-3 py-1.5 rounded-md transition-all cursor-pointer",
                        "text-[13px] font-medium leading-tight",
                        !mobileOpen ? "ml-3" : "",
                        isActive
                          ? "text-brand-600 dark:text-brand-400"
                          : "text-slate-600 hover:bg-slate-200/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200",
                      ].join(" ")}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.div
                              layoutId="sub-active-bg"
                              className="absolute inset-0 bg-slate-100/60 dark:bg-white/5 rounded-md"
                              transition={{ type: "spring", bounce: 0, duration: 0.2 }}
                            />
                          )}
                      {(() => {
                        const ChildIcon = child.icon;
                        return ChildIcon ? (
                          <ChildIcon size={14} className={[
                            "shrink-0 transition-colors z-10",
                            isActive ? "text-brand-600 dark:text-brand-400" : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600"
                          ].join(" ")} />
                        ) : (
                          <div className={[
                            "w-1.5 h-1.5 rounded-full z-10 mx-1 transition-all",
                            isActive 
                              ? "bg-brand-500 dark:bg-brand-400 scale-110" 
                              : "border border-slate-300 dark:border-surface-300"
                          ].join(" ")} />
                        );
                      })()}
                        <span className={[
                          "truncate z-10",
                          isActive ? "font-semibold text-slate-700 dark:text-slate-100" : "font-medium text-neutral-600 dark:text-neutral-400"
                        ].join(" ")}>{child.label}</span>

                        {/* Child Badge */}
                        {(child as any).badgeCount > 0 && (
                          <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-semibold text-white  ring-1 ring-white dark:ring-surface-400">
                            {(child as any).badgeCount > 99 ? "99+" : (child as any).badgeCount}
                          </span>
                        )}
                      </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </li>

  );
};

export default SidebarNavItem;
