import { useNavigate } from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import {
  BookOpen,
  Layout,
  Zap,
  Settings,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import OnboardingChecklist from "../../components/support/OnboardingChecklist";

export const HELP_CATEGORIES = [
  {
    slug: "getting-started",
    title: "Getting Started",
    description: "Foundations of navigation, access, and profile identity.",
    icon: BookOpen,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    chapters: [
      { id: "1.1", title: "System Overview" },
      { id: "1.2", title: "Login and Authentication" },
      { id: "1.3", title: "Two-Factor Authentication" },
      { id: "1.4", title: "Profile and Account Settings" },
      { id: "1.5", title: "Navigation and Dashboard" },
    ],
  },
  {
    slug: "document-workflow",
    title: "Document Workflow",
    description: "Comprehensive guides to the 5-phase document lifecycle.",
    icon: Zap,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    chapters: [
      { id: "2.1", title: "How the Workflow Works" },
      { id: "2.2", title: "Draft Phase" },
      { id: "2.3", title: "Review Phase" },
      { id: "2.4", title: "Approval Phase" },
      { id: "2.5", title: "Finalization Phase" },
      { id: "2.6", title: "Completed and Revision" },
    ],
  },
  {
    slug: "documents-and-requests",
    title: "Documents and Requests",
    description: "Managing the document library, templates, and requests.",
    icon: Layout,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    chapters: [
      { id: "3.1", title: "Document Library" },
      { id: "3.2", title: "Archive" },
      { id: "3.3", title: "Templates" },
      { id: "3.4", title: "Document Requests" },
    ],
  },
  {
    slug: "reports-logs-notifications",
    title: "Reports and Logs",
    description: "Analytics, activity tracking, and system support.",
    icon: Settings,
    iconBg: "bg-slate-100 dark:bg-surface-400",
    iconColor: "text-slate-900 dark:text-slate-100",
    chapters: [
      { id: "4.1", title: "Reports and Analytics" },
      { id: "4.2", title: "Activity Logs" },
      { id: "4.3", title: "Notifications" },
      { id: "4.4", title: "Announcements" },
      { id: "4.5", title: "Support and Help" },
    ],
  },
];

export default function HelpPage() {
  const navigate = useNavigate();

  return (
    <PageFrame title="User Manual & Support" contentClassName="max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* Main Content Area */}
        <div className="flex-1 min-w-0 space-y-12">
          
          {/* Welcome Header */}
          <section className="space-y-4">
             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 border border-brand-100 dark:border-brand-500/20">
                <Sparkles className="h-3.5 w-3.5 text-brand-500" />
                <span className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wider">FilDOCS Professional Manual</span>
             </div>
             <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">
               Knowledge Base Center
             </h1>
             <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xl">
               Welcome to the central documentation hub. This manual is designed to turn new users into workflow experts. Choose a category below to begin your journey.
             </p>
          </section>

          {/* Category Grid */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {HELP_CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.slug}
                  type="button"
                  onClick={() => navigate(`/help/${cat.slug}`)}
                  className="group relative flex flex-col p-6 rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 hover:border-brand-400 dark:hover:border-brand-600 hover:shadow-2xl hover:shadow-brand-500/10 transition-all duration-500 overflow-hidden text-left"
                >
                  <div className={`h-12 w-12 rounded-xl flex items-center justify-center transition-all group-hover:scale-110 group-hover:rotate-3 ${cat.iconBg} mb-4`}>
                    <Icon className={`h-6 w-6 ${cat.iconColor}`} />
                  </div>
                  
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{cat.title}</h3>
                    <ChevronRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-brand-500" />
                  </div>
                  
                  <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                    {cat.description}
                  </p>

                  <div className="mt-auto flex flex-wrap gap-2">
                    {cat.chapters.map((chap) => (
                      <span key={chap.id} className="px-2 py-0.5 rounded-md bg-slate-50 dark:bg-surface-400 text-[10px] font-medium text-slate-500 dark:text-slate-300 border border-slate-100 dark:border-surface-300 group-hover:border-brand-100 dark:group-hover:border-brand-500/20 transition-colors">
                        Chapter {chap.id}
                      </span>
                    ))}
                  </div>

                  {/* Decorative background accent */}
                  <div className="absolute top-0 right-0 -mr-8 -mt-8 h-24 w-24 rounded-full bg-brand-500/5 blur-2xl group-hover:bg-brand-500/10 transition-all" />
                </button>
              );
            })}
          </section>

          {/* Footer Support */}
          <div className="p-8 rounded-2xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 flex flex-col md:flex-row items-center justify-between gap-6">
             <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-white dark:bg-surface-400  flex items-center justify-center">
                   <MessageSquare className="h-6 w-6 text-brand-500" />
                </div>
                <div>
                   <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Help is just a click away.</p>
                   <p className="text-xs text-slate-500 dark:text-slate-400">Can't find what you need in the manual? Contact technical support.</p>
                </div>
             </div>
             <button
               onClick={() => navigate("/report-issue")}
               className="w-full md:w-auto px-8 py-3 bg-slate-900 dark:bg-brand-500 text-white text-xs font-semibold rounded-xl hover:bg-slate-800 transition-colors"
             >
               Open Support Ticket
             </button>
          </div>
        </div>

        {/* Sidebar / Checklist Area */}
        <aside className="w-full lg:w-80 space-y-6">
          <OnboardingChecklist />
          
          <div className="p-5 rounded-2xl border border-dashed border-slate-200 dark:border-surface-400">
             <p className="text-[11px] font-black uppercase text-slate-400 mb-3 tracking-widest">Mastery Tip</p>
             <p className="text-[13px] text-slate-600 dark:text-slate-400 leading-relaxed italic">
               "The most successful users check their **Work Queue** twice daily – once in the morning to see new tasks, and once before leaving to ensure the chain isn't stalled."
             </p>
          </div>
        </aside>

      </div>
    </PageFrame>
  );
}
