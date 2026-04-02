import React from "react";
import { NavLink } from "react-router-dom";
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
  const isSharedMobile = ["/dashboard", "/work-queue", "/document-requests", "/documents"].includes(to);

  return (
    <li className={isSharedMobile ? "md:block hidden" : ""}>
      <NavLink
        to={to}
        onClick={() => {
          if (mobileOpen) onMobileClose?.();
        }}
        className={({ isActive }) => [
          "group relative flex w-full items-center transition-all cursor-pointer overflow-hidden",
          // Desktop Styles
          !mobileOpen ? [
            "rounded-md text-sm font-medium duration-150",
            collapsed ? "justify-center px-0 py-2" : "gap-3 px-3 py-2",
            isActive
              ? "bg-slate-100 dark:bg-surface-400 text-slate-800 dark:text-slate-100"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-surface-400 dark:hover:text-slate-200",
          ].join(" ") : "",
          // Mobile Styles
          mobileOpen ? [
            "rounded-xl text-[12px] font-bold duration-200 active:scale-[0.98] gap-3 px-3 py-1.5 h-9.5",
            isActive
              ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
              : "text-slate-500 hover:bg-slate-100/50 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200 shadow-none",
          ].join(" ") : ""
        ].join(" ")}
      >
        {({ isActive }) => (
          <>
            <Icon className={[
              "shrink-0 transition-all duration-200",
              // Desktop Icon
              !mobileOpen ? "h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" : "",
              // Mobile Icon
              mobileOpen ? [
                "h-4 w-4",
                isActive ? "text-brand-500" : "text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-200"
              ].join(" ") : ""
            ].join(" ")} />
            
            {!collapsed || mobileOpen ? (
              <span className={mobileOpen ? "truncate tracking-tight select-none" : "truncate"}>
                {label}
              </span>
            ) : null}
          </>
        )}
      </NavLink>
    </li>
  );
};

export default SidebarNavItem;
