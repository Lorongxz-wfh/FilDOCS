import { NavLink } from "react-router-dom";
import { 
  BookOpen, 
  Layout, 
  Zap, 
  Settings, 
  CheckCircle2, 
  HelpCircle 
} from "lucide-react";

interface SidebarItemProps {
  to: string;
  icon: typeof BookOpen;
  label: string;
}

function SidebarItem({ to, icon: Icon, label }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-2 text-[13px] font-medium rounded-lg transition-all
        ${isActive 
          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20 " 
          : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-surface-400"
        }
      `}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </NavLink>
  );
}

export default function KnowledgeBaseSidebar() {
  return (
    <div className="w-64 shrink-0 hidden lg:block sticky top-24 h-[calc(100vh-8rem)]">
      <div className="space-y-8 h-full overflow-y-auto pr-4 pb-8 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-surface-400">
        
        {/* Categories */}
        <section className="space-y-2">
          <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-brand-500" />
            Manual Categories
          </p>
          <div className="space-y-1">
            <SidebarItem to="/help/getting-started" icon={BookOpen} label="Getting Started" />
            <SidebarItem to="/help/document-workflow" icon={Zap} label="Document Workflow" />
            <SidebarItem to="/help/documents-and-requests" icon={Layout} label="Docs & Requests" />
            <SidebarItem to="/help/reports-logs-notifications" icon={Settings} label="Reports & Logs" />
          </div>
        </section>

        {/* Resources */}
        <section className="space-y-2">
          <p className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
            <div className="h-1 w-1 rounded-full bg-slate-400" />
            Quick Resources
          </p>
          <div className="space-y-1">
            <SidebarItem to="/report-issue" icon={HelpCircle} label="Contact Support" />
            <NavLink
              to="/help"
              className="flex items-center gap-3 px-4 py-2 text-[13px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              <CheckCircle2 className="h-4 w-4" />
              Manual Library
            </NavLink>
          </div>
        </section>

        {/* Pro Tip */}
        <div className="mt-auto p-4 rounded-xl bg-slate-900 dark:bg-brand-600 shadow-xl border border-white/10">
          <p className="text-[11px] font-semibold text-white mb-1">Knowledge is Power</p>
          <p className="text-[10px] text-white/70 leading-relaxed">
            Use the search bar on any chapter page to find specific technical procedures.
          </p>
        </div>
      </div>
    </div>
  );
}
