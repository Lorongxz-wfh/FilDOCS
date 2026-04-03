import React from "react";
import { Plus, X } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useVisibleNewActions } from "../../hooks/useVisibleNewActions";

const MobileActionFab: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const visibleNewActions = useVisibleNewActions();
  const [open, setOpen] = React.useState(false);
  const fabRef = React.useRef<HTMLDivElement>(null);

  // Top-level paths where FAB is allowed
  const FAB_ALLOWED_PATHS = [
    "/dashboard",
    "/work-queue",
    "/document-requests",
    "/documents",
    "/my-activity",
    "/settings",
    "/admin/users",
    "/admin/offices",
    "/templates",
  ];

  const isAllowedPath = FAB_ALLOWED_PATHS.includes(location.pathname);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (visibleNewActions.length === 0 || !isAllowedPath) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 md:hidden flex" ref={fabRef}>
      {/* Action Menu (upward popup) */}
      {open && (
        <>
            {/* Overlay backdrop */}
            <div 
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px] animate-in fade-in"
                onClick={() => setOpen(false)}
            />
            
            <div className="absolute bottom-full right-0 mb-4 z-50 w-52 overflow-hidden rounded-xl border border-slate-200 dark:border-surface-300 bg-white/95 dark:bg-surface-500/95 backdrop-blur-md shadow-2xl animate-in slide-in-from-bottom-4 duration-200">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-black/5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Create New
                    </p>
                </div>
                
                <div className="p-1">
                    {visibleNewActions.map((action) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.to}
                                type="button"
                                onClick={() => {
                                    setOpen(false);
                                    navigate(
                                        action.to,
                                        action.state ? { state: action.state } : undefined
                                    );
                                }}
                                className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100/50 dark:bg-surface-400/50 text-slate-500 dark:text-slate-400 shadow-sm border border-white/20 dark:border-white/5">
                                    <Icon className="h-4 w-4" />
                                </div>
                                <span className="font-semibold">{action.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </>
      )}

      {/* Main FAB Trigger - Smaller Circle and Clean Design */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={[
          "relative z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all duration-300 active:scale-95",
          open 
            ? "bg-slate-800 text-white" 
            : "bg-sky-600 text-white hover:bg-sky-700"
        ].join(" ")}
        aria-label="Toggle action menu"
      >
        <div className={`transition-transform duration-300 ${open ? "rotate-90" : ""}`}>
            {open ? <X className="h-5.5 w-5.5" /> : <Plus className="h-5.5 w-5.5" />}
        </div>
      </button>
    </div>
  );
};

export default MobileActionFab;
