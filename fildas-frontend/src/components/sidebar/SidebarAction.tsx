import React from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SidebarActionProps {
  collapsed: boolean;
  newOpen: boolean;
  setNewOpen: (open: boolean) => void;
  newRef: React.RefObject<HTMLDivElement | null>;
  visibleNewActions: any[];
}

const SidebarAction: React.FC<SidebarActionProps> = ({
  collapsed,
  newOpen,
  setNewOpen,
  newRef,
  visibleNewActions,
}) => {
  const navigate = useNavigate();

  if (visibleNewActions.length === 0) return null;

  return (
    <div className="hidden md:block shrink-0 px-2 py-3" ref={newRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setNewOpen(!newOpen)}
          className={[
            "cursor-pointer flex items-center rounded-md text-sm font-semibold transition-all duration-150 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sm",
            collapsed ? "justify-center w-full px-0 h-9" : "gap-2 px-4 h-9",
          ].join(" ")}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New</span>}
        </button>
        {newOpen && (
          <div className={[
            "absolute z-50 rounded-md border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-500 shadow-md py-1",
            collapsed ? "left-[calc(100%+8px)] top-0 w-64 animate-pop-in-left" : "left-0 top-full mt-1 w-52 animate-pop-in-top"
          ].join(" ")}>
            {visibleNewActions.map((action) => (
              <button
                key={action.to}
                onClick={() => {
                  setNewOpen(false);
                  navigate(action.to, action.state ? { state: action.state } : undefined);
                }}
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
  );
};

export default SidebarAction;
