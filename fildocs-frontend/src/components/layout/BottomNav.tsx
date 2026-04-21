import React from "react";
import { NavLink } from "react-router-dom";
import { 
  LayoutDashboard, 
  ClipboardList, 
  Inbox, 
  FolderOpen
} from "lucide-react";

const BottomNav: React.FC = () => {
  const navItems = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Home" },
    { to: "/work-queue", icon: ClipboardList, label: "Work" },
    { to: "/document-requests", icon: Inbox, label: "Requests" },
    { to: "/documents", icon: FolderOpen, label: "Library" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 h-16 border-t border-slate-200 bg-white/80 backdrop-blur-sm dark:border-surface-400 dark:bg-surface-500/80 md:hidden">
      <div className="grid h-full grid-cols-4 items-center justify-items-center">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              [
                "flex flex-col items-center justify-center gap-1 transition-all duration-200",
                isActive
                  ? "text-brand-500 dark:text-brand-400 scale-105"
                  : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300",
              ].join(" ")
            }
          >
            <item.icon className="h-5 w-5" />
            <span className="text-[10px] font-medium tracking-tight">
              {item.label}
            </span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
