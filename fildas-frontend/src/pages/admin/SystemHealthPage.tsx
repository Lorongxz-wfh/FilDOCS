import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import Skeleton from "../../components/ui/loader/Skeleton";
import { 
  Activity, 
  Database, 
  ShieldAlert, 
  HardDrive, 
  Mail, 
  Users, 
  Server, 
  Terminal, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Clock,
  MessageSquare,
  Zap,
  Send,
  Timer
} from "lucide-react";
import { PageActions, RefreshAction, ActionButton } from "../../components/ui/PageActions";
import { 
  getSystemHealth, 
  updateMaintenanceMode, 
  getSystemLogs,
  runSystemDiagnostics,
  sendSystemTestEmail,
  scheduleMaintenance,
  cancelMaintenance,
  type SystemHealthStatus,
  type MaintenanceMode,
  type SystemDiagnostics
} from "../../services/systemHealthApi";
import { useToast } from "../../components/ui/toast/ToastContext";

// ── Components ──────────────────────────────────────────────────────────────

function HealthCard({ 
  title, 
  status, 
  icon: Icon, 
  label, 
  subLabel,
  action
}: { 
  title: string; 
  status: 'ok' | 'error' | 'warning' | 'loading'; 
  icon: any; 
  label: string; 
  subLabel?: string;
  action?: React.ReactNode;
}) {
  const statusColors = {
    ok: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30",
    error: "text-rose-500 bg-rose-50 dark:bg-rose-950/30",
    warning: "text-amber-500 bg-amber-50 dark:bg-amber-950/30",
    loading: "text-slate-400 bg-slate-50 dark:bg-surface-400/20"
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 dark:border-surface-400 dark:bg-surface-500 relative group">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-md ${statusColors[status]}`}>
          <Icon size={18} />
        </div>
        <div className="flex items-center gap-2">
          {action}
          {status === 'ok' && <CheckCircle2 size={16} className="text-emerald-500" />}
          {status === 'error' && <XCircle size={16} className="text-rose-500" />}
          {status === 'warning' && <AlertTriangle size={16} className="text-amber-500" />}
          {status === 'loading' && <RefreshCw size={16} className="text-slate-300 animate-spin" />}
        </div>
      </div>
      <div>
        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{title}</h4>
        <p className="text-lg font-bold text-slate-900 dark:text-slate-50">{label}</p>
        {subLabel && <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{subLabel}</p>}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function SystemHealthPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const [health, setHealth] = useState<SystemHealthStatus | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [diagnostics, setDiagnostics] = useState<SystemDiagnostics | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [fetchingLogs, setFetchingLogs] = useState(false);
  const [runningDiag, setRunningDiag] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  // Form State
  const [mMode, setMMode] = useState<MaintenanceMode>("off");
  const [mMessage, setMMessage] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSystemHealth();
      setHealth(data);
      setMMode(data.maintenance.mode);
      setMMessage(data.maintenance.message || "");
    } catch (error) {
      push({ message: "Failed to fetch system health", type: "error" });
    } finally {
      setLoading(false);
    }
  }, [push]);

  const fetchLogs = useCallback(async () => {
    setFetchingLogs(true);
    try {
      const { logs } = await getSystemLogs();
      setLogs(logs);
    } catch (error) {
      push({ message: "Failed to fetch system logs", type: "error" });
    } finally {
      setFetchingLogs(false);
    }
  }, [push]);

  const handleRunDiagnostics = async () => {
    setRunningDiag(true);
    try {
      const results = await runSystemDiagnostics();
      setDiagnostics(results);
      push({ message: "Infrastructure diagnostics complete", type: "success" });
    } catch (error) {
      push({ message: "Diagnostic suite execution failed", type: "error" });
    } finally {
      setRunningDiag(false);
    }
  };

  const handleSendTestEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await sendSystemTestEmail();
      push({ message: res.message, type: "success" });
    } catch (error) {
      push({ message: "Failed to send verification email", type: "error" });
    } finally {
      setSendingEmail(false);
    }
  };

  // Scheduling State
  const [scheduledMinutes, setScheduledMinutes] = useState(10);
  const [schedulingMode, setSchedulingMode] = useState<'soft' | 'hard'>('soft');
  const [isScheduling, setIsScheduling] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const handleUpdateMaintenance = async () => {
    setUpdating(true);
    try {
      await updateMaintenanceMode({
        mode: mMode,
        message: mMessage
      });
      push({ message: "Maintenance settings updated", type: "success" });
      fetchData();
    } catch (error) {
      push({ message: "Failed to update maintenance settings", type: "error" });
    } finally {
      setUpdating(false);
    }
  };

  const handleScheduleMaintenance = async () => {
    setIsScheduling(true);
    try {
      await scheduleMaintenance({
        minutes: scheduledMinutes,
        message: mMessage,
        mode: schedulingMode
      });
      push({ message: `Maintenance scheduled in ${scheduledMinutes} minutes`, type: "success" });
      fetchData();
    } catch (error) {
      push({ message: "Failed to schedule maintenance", type: "error" });
    } finally {
      setIsScheduling(false);
    }
  };

  const handleCancelSchedule = async () => {
    setIsCancelling(true);
    try {
      await cancelMaintenance();
      push({ message: "Scheduled maintenance cancelled", type: "success" });
      fetchData();
    } catch (error) {
      push({ message: "Failed to cancel scheduled maintenance", type: "error" });
    } finally {
      setIsCancelling(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchLogs();
  }, [fetchData, fetchLogs]);

  const formatSize = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  };

  if (!health && loading) {
    return (
      <PageFrame title="System Health" onBack={() => navigate(-1)}>
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      </PageFrame>
    );
  }

  return (
    <PageFrame 
      title="System Health & Maintenance" 
      onBack={() => navigate(-1)}
      right={
        <PageActions>
          <ActionButton 
            label={runningDiag ? "Running Diagnostics..." : "Run Diagnostics"} 
            icon={Zap} 
            onClick={handleRunDiagnostics} 
            loading={runningDiag}
            variant="secondary"
          />
          <RefreshAction onRefresh={fetchData} loading={loading} />
        </PageActions>
      }
    >
      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        
        {/* ── Status Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <HealthCard 
            title="Database"
            status={health?.status.database ? 'ok' : 'error'}
            icon={Database}
            label={health?.status.database ? "Connected" : "Disconnected"}
            subLabel="Relational data store"
          />
          <HealthCard 
            title="Cache"
            status={health?.status.cache ? 'ok' : 'error'}
            icon={Activity}
            label={health?.status.cache ? "Active" : "Failure"}
            subLabel="Redis / Application Cache"
          />
          <HealthCard 
            title="Storage"
            status={(health?.status.storage.percentage || 0) > 90 ? 'error' : (health?.status.storage.percentage || 0) > 80 ? 'warning' : 'ok'}
            icon={HardDrive}
            label={`${health?.status.storage.percentage}% Used`}
            subLabel={`${formatSize(health?.status.storage.free || 0)} available of ${formatSize(health?.status.storage.total || 0)}`}
          />
          <HealthCard 
            title="Email Service"
            status={health?.status.mail ? 'ok' : 'warning'}
            icon={Mail}
            label={health?.status.mail ? "Configured" : "Not Set"}
            subLabel="SMTP Relay status"
            action={
              <button 
                onClick={handleSendTestEmail}
                disabled={sendingEmail}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition text-slate-500 hover:text-brand-500 disabled:opacity-50"
                title="Send test email"
              >
                {sendingEmail ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              </button>
            }
          />
        </div>

        {/* ── Diagnostic Report (Conditional) ── */}
        {diagnostics && (
          <div className="rounded-xl border border-brand-200 bg-white p-5 dark:border-brand-500/20 dark:bg-surface-600/50 flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in slide-in-from-top-2 duration-500 shadow-sm">
             <div className="flex items-center gap-4">
               <div className="p-3 bg-brand-500 text-white rounded-lg shadow-lg shadow-brand-500/20">
                 <Zap size={22} />
               </div>
               <div>
                 <h3 className="text-sm font-bold text-slate-900 dark:text-slate-50">Infrastructure Diagnostic Report</h3>
                 <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">
                   Executed at {new Date(diagnostics.timestamp).toLocaleTimeString()}
                 </p>
               </div>
             </div>
             
             <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">DB Latency</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-slate-50 flex items-center justify-center gap-1">
                    <Timer size={14} className="text-slate-400" />
                    {diagnostics.db_latency}ms
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Cache I/O</p>
                  <p className={`text-sm font-bold ${diagnostics.cache_io ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {diagnostics.cache_io ? 'VERIFIED' : 'FAILED'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Storage I/O</p>
                  <p className={`text-sm font-bold ${diagnostics.storage_io ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {diagnostics.storage_io ? 'VERIFIED' : 'FAILED'}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Broadcasting</p>
                  <p className={`text-sm font-bold ${diagnostics.pusher ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {diagnostics.pusher ? 'VERIFIED' : 'FAILED'}
                  </p>
                </div>
             </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* ── Maintenance Control ── */}
          <div className="lg:col-span-1 space-y-6">
            <div className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/50 flex items-center gap-2">
                <ShieldAlert size={18} className="text-brand-500" />
                <h3 className="font-bold text-slate-900 dark:text-slate-50 font-heading">Maintenance Control</h3>
              </div>
              <div className="p-5 space-y-5">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Operating Mode</label>
                  <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-black/20 rounded-lg">
                    {(['off', 'soft', 'hard'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setMMode(mode)}
                        className={`py-2 px-3 rounded-md text-xs font-bold transition-all ${
                          mMode === mode 
                            ? "bg-white dark:bg-surface-400 text-brand-600 dark:text-brand-400 shadow-sm" 
                            : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                        }`}
                      >
                        {mode.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
                    {mMode === 'off' && "System is live for everyone."}
                    {mMode === 'soft' && "Non-admins can browse but cannot edit or upload."}
                    {mMode === 'hard' && "Non-admins are blocked from accessing the system."}
                  </p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Message to Users</label>
                  <textarea 
                    value={mMessage}
                    onChange={(e) => setMMessage(e.target.value)}
                    placeholder="Enter maintenance reason..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-100 dark:placeholder:text-slate-500"
                  />
                </div>

                <button
                  onClick={handleUpdateMaintenance}
                  disabled={updating}
                  className="w-full py-3 rounded-lg bg-brand-500 text-white text-xs font-bold hover:bg-brand-600 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {updating ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
                  Apply Settings
                </button>
              </div>
            </div>

            {/* ── Maintenance Scheduler ── */}
            <div className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock size={18} className="text-amber-500" />
                  <h3 className="font-bold text-slate-900 dark:text-slate-50 font-heading">Maintenance Scheduler</h3>
                </div>
                {health?.maintenance.starts_at && (
                   <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                )}
              </div>
              
              <div className="p-5 space-y-5">
                {health?.maintenance.starts_at ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
                       <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-widest mb-1">Upcoming Deployment</p>
                       <p className="text-sm font-bold text-slate-900 dark:text-slate-50">
                         Starting at {new Date(health.maintenance.starts_at).toLocaleTimeString()}
                       </p>
                    </div>
                    <button
                      onClick={handleCancelSchedule}
                      disabled={isCancelling}
                      className="w-full py-2.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition disabled:opacity-50 flex items-center justify-center gap-2 dark:border-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      {isCancelling ? <RefreshCw size={12} className="animate-spin" /> : <XCircle size={14} />}
                      Cancel Schedule
                    </button>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Time Delay</label>
                      <div className="grid grid-cols-4 gap-2">
                        {[5, 10, 30, 60].map(mins => (
                          <button
                            key={mins}
                            onClick={() => setScheduledMinutes(mins)}
                            className={`py-2 rounded-md text-[10px] font-bold transition-all border ${
                              scheduledMinutes === mins 
                                ? "bg-amber-500 border-amber-600 text-white shadow-sm" 
                                : "border-slate-200 dark:border-surface-400 text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {mins >= 60 ? `${mins/60}H` : `${mins}M`}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Grace Period Mode</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-black/20 rounded-lg">
                        {(['soft', 'hard'] as const).map(mode => (
                          <button
                            key={mode}
                            onClick={() => setSchedulingMode(mode)}
                            className={`py-1.5 rounded-md text-[10px] font-bold transition-all ${
                              schedulingMode === mode 
                                ? "bg-white dark:bg-surface-400 text-amber-600 dark:text-amber-400 shadow-sm" 
                                : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
                            }`}
                          >
                            {mode.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={handleScheduleMaintenance}
                      disabled={isScheduling}
                      className="w-full py-3 rounded-lg bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                    >
                      {isScheduling ? <RefreshCw size={14} className="animate-spin" /> : <Timer size={14} />}
                      Schedule & Broadcast
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Quick Stats ── */}
            <div className="rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 p-5 divide-y divide-slate-100 dark:divide-surface-400">
               <div className="flex items-center justify-between pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-sky-50 dark:bg-sky-950/30 text-sky-500 rounded-lg">
                       <Users size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-50">Active Users</p>
                      <p className="text-[10px] text-slate-500">Live sessions (15m)</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold font-mono text-slate-900 dark:text-slate-50">{health?.active_sessions || 0}</span>
               </div>
               <div className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-violet-50 dark:bg-violet-950/30 text-violet-500 rounded-lg">
                       <Server size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-50">PHP Version</p>
                      <p className="text-[10px] text-slate-500">Laravel v{health?.server_info.laravel_version}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold font-mono text-slate-500 dark:text-slate-400">v{health?.server_info.php_version}</span>
               </div>
               <div className="flex items-center justify-between pt-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-500 rounded-lg">
                       <Clock size={18} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-50">Server Time</p>
                      <p className="text-[10px] text-slate-500">System timezone (UTC)</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                    {health ? new Date(health.server_info.server_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                  </span>
               </div>
            </div>
          </div>

          {/* ── System Logs ── */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="rounded-xl border border-slate-200 bg-slate-900 dark:border-surface-400 overflow-hidden shadow-2xl">
              <div className="px-4 py-3 bg-slate-800 border-b border-slate-700 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Terminal size={14} className="text-emerald-400" />
                  <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest">System Engine Logs</span>
                </div>
                <button 
                  onClick={fetchLogs} 
                  disabled={fetchingLogs}
                  className="p-1 hover:bg-white/10 rounded transition text-slate-400 hover:text-white"
                >
                  <RefreshCw size={14} className={fetchingLogs ? "animate-spin" : ""} />
                </button>
              </div>
              <div className="h-[450px] p-4 overflow-y-auto font-mono text-[11px] text-emerald-400 leading-relaxed custom-scrollbar bg-slate-900/50">
                {logs ? (
                  <pre className="whitespace-pre-wrap opacity-90">{logs}</pre>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-500 gap-2">
                    <MessageSquare size={14} />
                    <span>No log entries recorded yet.</span>
                  </div>
                )}
              </div>
            </div>
            <p className="mt-3 text-[10px] text-slate-400 flex items-center gap-1.5 px-1">
              <AlertTriangle size={12} className="text-amber-500" />
              Logs show the last 100 entries from laravel.log. Sensitive data is automatically masked.
            </p>
          </div>

        </div>

      </div>
    </PageFrame>
  );
}
