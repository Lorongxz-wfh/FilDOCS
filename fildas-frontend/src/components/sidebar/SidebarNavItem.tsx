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
    "group relative flex w-full items-center cursor-pointer overflow-hidden transition-all duration-300 ease-in-out",
    // Desktop Styles
    !mobileOpen ? [
      "rounded-lg text-[14px] font-medium h-9.5",
      collapsed ? "justify-center px-0" : "px-2.5 gap-2.5",
      isActuallyActive
        ? "text-neutral-900 dark:text-surface-50"
        : "text-neutral-500 hover:bg-neutral-200/50 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-surface-50",
    ].join(" ") : [
      "rounded-xl text-[13px] font-bold duration-150 active:scale-[0.98] h-11 gap-3 px-3",
      isActuallyActive
        ? "text-brand-600 dark:text-brand-400"
        : "text-neutral-500 hover:bg-neutral-200/50 dark:text-neutral-400 dark:hover:bg-white/10 dark:hover:text-surface-50 shadow-none",
    ].join(" ")
  ].join(" ");

  const iconCls = [
    "shrink-0 transition-all duration-300 z-10",
    isActuallyActive ? "opacity-100 scale-105" : "opacity-70 group-hover:opacity-100",
    // Desktop Icon colors
    !mobileOpen ? [
      isActuallyActive ? "text-brand-500 dark:text-brand-400" : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
    ].join(" ") : "",
    // Mobile Icon colors
    mobileOpen ? [
      "h-4 w-4",
      isActuallyActive ? "text-brand-500" : "text-neutral-400 group-hover:text-neutral-700 dark:group-hover:text-surface-50"
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
              className="absolute inset-0 bg-neutral-100/80 dark:bg-surface-400/80 rounded-lg border border-neutral-200/50 dark:border-surface-300/30 shadow-xs"
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
              isActuallyActive ? "font-semibold" : "font-medium text-neutral-500 dark:text-neutral-400",
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
              isActuallyActive ? "text-neutral-900 dark:text-neutral-100" : "text-neutral-400"
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
              "mt-1 mb-2 flex flex-col gap-1 relative",
              !mobileOpen ? "ml-5" : "ml-4"
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
                          isLast ? "h-4.5" : "bottom-[-10px]", // Stop at junction for last, else continue to next gap
                          "w-[1.5px] bg-slate-300 dark:bg-surface-300"
                        ].join(" ")} />
                        
                        {/* Horizontal Branch */}
                        <div className="absolute -left-[1px] top-4.5 w-4.5 h-[1.5px] bg-slate-300 dark:bg-surface-300" />
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
                        !mobileOpen ? "ml-4.5" : "",
                        isActive
                          ? "text-slate-900 dark:text-slate-100"
                          : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200",
                      ].join(" ")}
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <motion.div
                              layoutId="sub-active-bg"
                              className="absolute inset-0 bg-neutral-100/50 dark:bg-surface-400/30 rounded-md"
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
                          <div className="w-1.5 h-1.5 rounded-full border border-slate-300 dark:border-surface-300 z-10 mx-1" />
                        );
                      })()}
                        <span className={[
                          "truncate z-10",
                          isActive ? "font-semibold text-neutral-900 dark:text-surface-50" : "font-medium text-neutral-500 dark:text-neutral-400"
                        ].join(" ")}>{child.label}</span>
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
