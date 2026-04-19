import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import { AlertCircle, Terminal, HelpCircle, ChevronRight } from "lucide-react";
import SupportEmailModal from "../../components/help/SupportEmailModal";
import { useAuthUser } from "../../hooks/useAuthUser";

const ReportIssuePage: React.FC = () => {
  const navigate = useNavigate();
  const user = useAuthUser();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <PageFrame
      title="Report an Issue"
      onBack={() => navigate("/help")}
      breadcrumbs={[{ label: "Help & Support", to: "/help" }]}
      contentClassName="max-w-3xl mx-auto"
    >
      <div className="mb-8 p-6 rounded-xl border border-rose-100 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/30 ">
        <div className="flex items-start gap-4">
          <div className="p-2 rounded-lg bg-rose-500 text-white shadow-md">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 tracking-tight">Encountered a problem?</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Help us improve FilDOCS by reporting technical issues, bugs, or suggesting improvements.
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 ">
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100 mb-2 uppercase tracking-wider">
              <Terminal className="h-4 w-4 text-slate-400" />
              Technical Support
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 leading-relaxed">
              For urgent technical assistance, please contact the System Administrator or IT Support:
            </p>
            <div className="rounded-lg bg-slate-50 dark:bg-surface-400 p-4 border border-slate-100 dark:border-surface-300">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-100">Document Workflow Support</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">laquino@filamer.edu.ph</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">IT/QA Technical Division</p>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 dark:border-surface-400">
             <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-900 dark:text-slate-100 mb-2 uppercase tracking-wider">
              <HelpCircle className="h-4 w-4 text-slate-400" />
              Before reporting
            </h3>
            <ul className="space-y-3">
              {[
                "Check the Help & Support page for known solutions",
                "Try refreshing your browser page",
                "Ensure you have a stable internet connection",
              ].map((text) => (
                <li key={text} className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                   <ChevronRight className="h-3 w-3 text-brand-500" />
                   {text}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="pt-8">
            <button 
               onClick={() => setIsModalOpen(true)}
               className="w-full h-11 flex items-center justify-center rounded-xl bg-brand-500 text-white font-semibold text-sm shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-[0.98]"
            >
              Compose Support Email
            </button>
          </div>
        </div>
      </div>

      <SupportEmailModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userEmail={user?.email || ""}
        defaultSubject={`Issue Report - ${user?.full_name || "User"}`}
      />
    </PageFrame>
  );
};

export default ReportIssuePage;
