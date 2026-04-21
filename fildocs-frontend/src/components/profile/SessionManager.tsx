import React, { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  Laptop, 
  Smartphone, 
  Trash2, 
  ShieldCheck, 
  AlertCircle,
  Globe,
  Clock,
  Monitor
} from "lucide-react";
import Button from "../ui/Button";
import { useToast } from "../ui/toast/ToastContext";
import { format } from "date-fns";

interface UserSession {
  id: number;
  ip_address: string;
  user_agent: string;
  last_used_at: string;
  created_at: string;
  is_current: boolean;
}

export const SessionManager: React.FC<{ refreshTrigger?: number }> = ({ refreshTrigger }) => {
  const { push } = useToast();
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingOthers, setRevokingOthers] = useState(false);

  const fetchSessions = async () => {
    try {
      const res = await api.get("/profile/sessions");
      setSessions(res.data);
    } catch (err) {
      push({ type: "error", title: "Load Failed", message: "Failed to retrieve active sessions." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [refreshTrigger]);

  const handleRevoke = async (id: number) => {
    setRevokingId(id);
    try {
      await api.delete(`/profile/sessions/${id}`);
      push({ type: "success", title: "Session Revoked", message: "Device has been successfully logged out." });
      setSessions(s => s.filter(item => item.id !== id));
    } catch (err) {
      push({ type: "error", title: "Revocation Failed", message: "Could not logout this device." });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeOthers = async () => {
    setRevokingOthers(true);
    try {
      await api.post("/profile/sessions/revoke-others");
      push({ type: "success", title: "Sessions Cleared", message: "All other devices have been logged out." });
      setSessions(s => s.filter(item => item.is_current));
    } catch (err) {
      push({ type: "error", title: "Action Failed", message: "Could not clear other sessions." });
    } finally {
      setRevokingOthers(false);
    }
  };

  const parseUA = (ua: string) => {
    if (!ua) return { device: "Unknown Device", browser: "Unknown Browser" };
    
    // Simple parsing for FilDAS high-density UI
    const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
    const deviceType = isMobile ? "Mobile Device" : "Desktop Device";
    
    let browser = "Web Browser";
    if (ua.includes("Chrome")) browser = "Google Chrome";
    else if (ua.includes("Firefox")) browser = "Mozilla Firefox";
    else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Apple Safari";
    else if (ua.includes("Edge")) browser = "Microsoft Edge";
    
    let os = "OS";
    if (ua.includes("Windows")) os = "Windows";
    else if (ua.includes("Mac OS")) os = "macOS";
    else if (ua.includes("Linux")) os = "Linux";
    else if (ua.includes("Android")) os = "Android";
    else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

    return { 
      device: `${os} ${deviceType}`, 
      browser 
    };
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-surface-400 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Login Sessions</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage all devices where you are currently signed in.</p>
         </div>
          {sessions.length > 1 && (
            <Button 
                variant="outline" 
                size="sm" 
                className="text-rose-600 border-rose-100 dark:border-rose-900/30 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                onClick={handleRevokeOthers}
                loading={revokingOthers}
            >
                Revoke All Others
            </Button>
          )}
      </div>

      <div className="space-y-3">
        {sessions.map(session => {
          const { device, browser } = parseUA(session.user_agent);
          return (
            <div 
              key={session.id} 
              className={`group relative flex items-center justify-between p-4 rounded-lg border transition-all ${
                session.is_current 
                  ? "border-brand-200 bg-brand-50/30 dark:border-brand-500/20 dark:bg-brand-500/5 " 
                  : "border-slate-100 dark:border-surface-400 bg-white dark:bg-surface-500 hover:border-slate-200 dark:hover:border-surface-300"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`h-10 w-10 flex items-center justify-center rounded-lg ${
                  session.is_current ? "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400" : "bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400"
                }`}>
                  {device.includes("Mobile") ? <Smartphone className="h-5 w-5" /> : <Laptop className="h-5 w-5" />}
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">{device}</span>
                    {session.is_current && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20 ">
                        <ShieldCheck className="h-2.5 w-2.5" />
                        Current Session
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3 opacity-70" />
                        {session.ip_address}
                    </span>
                    <span className="flex items-center gap-1">
                        <Monitor className="h-3 w-3 opacity-70" />
                        {browser}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 opacity-70" />
                        Last used: {session.last_used_at ? format(new Date(session.last_used_at), "MMM d, h:mm a") : "Just now"}
                    </span>
                  </div>
                </div>
              </div>

              {!session.is_current && (
                <button 
                  onClick={() => handleRevoke(session.id)}
                  disabled={revokingId === session.id}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-all opacity-0 group-hover:opacity-100"
                  title="Revoke session"
                >
                  {revokingId === session.id ? (
                      <div className="h-4 w-4 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin" />
                  ) : (
                      <Trash2 className="h-4 w-4" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 rounded-lg bg-slate-50 dark:bg-surface-400/20 border border-slate-100 dark:border-surface-400 flex gap-3 ">
         <AlertCircle className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0" />
         <div className="space-y-1">
            <h4 className="text-[10px] font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-widest">Account Security Tip</h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400/90 leading-normal">
                If you see a device you don't recognize, revoke it immediately and change your account password. 
                We recommend enabling Two-Factor Authentication for maximum account integrity.
            </p>
         </div>
      </div>
    </div>
  );
};
