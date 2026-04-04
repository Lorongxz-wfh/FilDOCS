import { useState, useEffect } from "react";
import { ShieldAlert, Mail, RefreshCw, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";

export default function MaintenancePage() {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [reason, setReason] = useState<string>("System is currently undergoing scheduled maintenance.");

  useEffect(() => {
    // Get maintenance info from query or localStorage fallback
    const params = new URLSearchParams(window.location.search);
    const msg = params.get("message") || localStorage.getItem("maintenance_message");
    const expires = params.get("expires_at") || localStorage.getItem("maintenance_expires_at");

    if (msg) setReason(msg);

    if (expires) {
      const targetDate = new Date(expires);
      const timer = setInterval(() => {
        const now = new Date();
        const diff = targetDate.getTime() - now.getTime();

        if (diff <= 0) {
          setTimeLeft("0:00");
          clearInterval(timer);
          return;
        }

        const hrs = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`${hrs > 0 ? `${hrs}:` : ""}${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-surface-600 flex items-center justify-center p-6 font-sans">
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
         <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-500/20 blur-[120px] rounded-full" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-xl text-center"
      >
        {/* Icon & Status */}
        <div className="flex justify-center mb-8">
           <div className="relative">
              <div className="absolute inset-0 scale-150 bg-brand-500/10 blur-xl rounded-full animate-pulse" />
              <div className="relative h-20 w-20 rounded-3xl bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 shadow-2xl flex items-center justify-center text-brand-500">
                <ShieldAlert size={40} strokeWidth={1.5} />
              </div>
           </div>
        </div>

        {/* Content */}
        <h1 className="text-4xl font-display font-black tracking-tighter text-slate-900 dark:text-slate-50 mb-4 uppercase">
          System Maintenance
        </h1>
        
        <div className="mx-auto w-20 h-1 bg-brand-500 rounded-full mb-8" />

        <div className="bg-white dark:bg-surface-500 rounded-2xl border border-slate-200 dark:border-surface-400 p-8 shadow-2xl shadow-slate-200/50 dark:shadow-none">
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium mb-8">
            {reason}
          </p>

          {timeLeft && (
            <div className="mb-8 p-6 rounded-xl bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400 flex flex-col items-center">
              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Estimated Back Online in</span>
              <span className="text-4xl font-mono font-black text-brand-500 dark:text-brand-400 tracking-tighter">
                {timeLeft}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
             <a 
               href="mailto:support@fildas.fcu.edu.ph"
               className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-slate-200 dark:border-surface-400 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition text-[13px] font-bold"
             >
                <Mail size={16} />
                Contact Support
             </a>
             <button 
               onClick={() => window.location.reload()}
               className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-brand-500 text-white hover:bg-brand-600 shadow-lg shadow-brand-500/20 transition text-[13px] font-bold"
             >
                <RefreshCw size={16} />
                Check Status
             </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-black tracking-widest">
            Quality Assurance Office • Filamer Christian University
          </p>
          <div className="flex items-center gap-6 opacity-40 hover:opacity-100 transition duration-300">
             <div className="h-[1px] w-8 bg-slate-300 dark:bg-surface-400" />
             <AlertTriangle size={14} className="text-amber-500" />
             <div className="h-[1px] w-8 bg-slate-300 dark:bg-surface-400" />
          </div>
        </div>
      </motion.div>
    </main>
  );
}
