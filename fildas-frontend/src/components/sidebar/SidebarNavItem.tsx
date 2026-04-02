import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface SidebarNavItemProps {
  to: string;
  label: string;
  icon: LucideIcon;
  collapsed: boolean;
  mobileOpen: boolean;
  onMobileClose?: () => void;
}

const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  to,
  label,
  icon: Icon,
  collapsed,
  mobileOpen,
  onMobileClose,
}) => {
  const { pathname } = useLocation();
  const isSharedMobile = ["/dashboard", "/work-queue", "/document-requests", "/documents"].includes(to);

  // Custom active logic to handle /documents/:id (Flow) vs /documents (Library)
  const isActuallyActive = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    
    // Work Queue highlights for: /work-queue, /documents/all, or /documents/:id (Flow)
    if (to === "/work-queue") {
      if (pathname === "/work-queue" || pathname === "/documents/all") return true;
      // It's a flow page if path is /documents/:id AND not /documents/create AND not /view
      // Path segments for /documents/123 are ['documents', '123'] (length 2)
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
  }, [pathname, to]);

  return (
    <li className={isSharedMobile ? "md:block hidden" : ""}>
      <NavLink
        to={to}
        onClick={() => {
          if (mobileOpen) onMobileClose?.();
        }}
        className={[
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
        ].join(" ")}
      >
        <Icon className={[
          "shrink-0 transition-all duration-200",
          // Desktop Icon
          !mobileOpen ? "h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" : "",
          // Mobile Icon
          mobileOpen ? [
            "h-4 w-4",
            isActuallyActive ? "text-brand-500" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
          ].join(" ") : ""
        ].join(" ")} />
        
        {!collapsed || mobileOpen ? (
          <span className={mobileOpen ? "truncate tracking-tight select-none" : "truncate"}>
            {label}
          </span>
        ) : null}
      </NavLink>
    </li>
  );
};

export default SidebarNavItem;
