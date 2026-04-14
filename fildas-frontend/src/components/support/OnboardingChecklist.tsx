import { useState, useEffect } from "react";
import { CheckCircle2, Circle, PartyPopper, RefreshCw } from "lucide-react";
import { useAuthUser } from "../../hooks/useAuthUser";
import { api } from "../../services/api";
import { setAuthUser } from "../../lib/auth";

interface ChecklistItem {
  id: string;
  label: string;
}

const DEFAULT_ITEMS: ChecklistItem[] = [
  { id: "1.2", label: "Signed in and exploring" },
  { id: "1.3", label: "Configured Two-Factor (2FA)" },
  { id: "1.4", label: "Uploaded Signature in Settings" },
  { id: "2.1", label: "Reviewed Workflow Logic Chapter" },
  { id: "3.1", label: "Browsed the Document Library" },
];

export default function OnboardingChecklist() {
  const user = useAuthUser();
  const [completed, setCompleted] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Sync initial state from User object
  useEffect(() => {
    if (user?.onboarding_progress) {
      setCompleted(user.onboarding_progress);
    }
  }, [user]);

  const toggleItem = async (id: string) => {
    if (!user) return;

    const next = completed.includes(id)
      ? completed.filter((i) => i !== id)
      : [...completed, id];
    
    // Optimistic Update
    setCompleted(next);
    
    setSyncing(true);
    try {
      await api.patch("/profile/onboarding", { progress: next });
      
      // Update global auth state
      setAuthUser({ ...user, onboarding_progress: next });
      window.dispatchEvent(new Event("auth_user_updated"));
      
      if (next.length === DEFAULT_ITEMS.length && !completed.includes(id)) {
        setShowCelebration(true);
        setTimeout(() => setShowCelebration(false), 5000);
      }
    } catch (err) {
      console.error("Failed to sync onboarding progress:", err);
      // Rollback on error
      setCompleted(completed);
    } finally {
      setSyncing(false);
    }
  };

  const progress = Math.round((completed.length / DEFAULT_ITEMS.length) * 100);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden shadow-sm">
      <div className="px-6 py-5 border-b border-slate-100 dark:border-surface-400 flex items-center justify-between bg-slate-50/50 dark:bg-surface-600/50">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Quick Start Checklist</h3>
            {syncing && <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Essential steps for every new user</p>
        </div>
        <div className="text-right">
          <p className="text-xs font-black text-brand-600 dark:text-brand-400">{progress}%</p>
          <div className="w-24 h-1.5 bg-slate-200 dark:bg-surface-400 rounded-full mt-1 overflow-hidden">
            <div 
              className="h-full bg-brand-500 transition-all duration-500 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-1">
        {DEFAULT_ITEMS.map((item) => {
          const isDone = completed.includes(item.id);
          return (
            <button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              disabled={syncing}
              className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all group text-left ${
                isDone 
                  ? "bg-slate-50 dark:bg-surface-400/30 opacity-60" 
                  : "hover:bg-slate-50 dark:hover:bg-surface-400"
              }`}
            >
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-slate-900 dark:text-slate-100 fill-slate-50" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors" />
                )}
              </div>
              <span className={`text-[13px] font-medium leading-none ${
                isDone ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {showCelebration && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border-t border-emerald-100 dark:border-emerald-800/50 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-400/20 flex items-center justify-center">
            <PartyPopper className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
            Certified! You're ready to master the FilDOCS workflows.
          </p>
        </div>
      )}
    </div>
  );
}
