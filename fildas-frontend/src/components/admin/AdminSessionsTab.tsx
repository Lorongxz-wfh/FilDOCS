import React, { useEffect, useState, useMemo } from "react";
import { 
  getAdminSessions, 
  revokeAdminSession, 
  getAdminSessionActivity, 
  type AdminSession 
} from "../../services/admin";
import Table, { type TableColumn } from "../ui/Table";
import { useToast } from "../ui/toast/ToastContext";
import { 
  Laptop, 
  Trash2, 
  History, 
  Globe, 
  X,
  Activity,
  Smartphone
} from "lucide-react";
import { formatDate } from "../../utils/formatters";
import { ActivityTimeline } from "../profile/ActivityTimeline";
import Button from "../ui/Button";
import SearchFilterBar from "../ui/SearchFilterBar";

const parseUA = (ua: string | null) => {
  if (!ua) return { device: "Unknown Device", browser: "Unknown Browser" };
  const isMobile = /mobile|android|iphone|ipad|phone/i.test(ua);
  const deviceType = isMobile ? "Mobile" : "Desktop";
  
  let os = "OS";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Mac OS")) os = "macOS";
  else if (ua.includes("Linux")) os = "Linux";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";

  let browser = "Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Safari") && !ua.includes("Chrome")) browser = "Safari";
  else if (ua.includes("Edge")) browser = "Edge";

  return { device: `${os} ${deviceType}`, browser };
};

const AdminSessionsTab: React.FC = () => {
  const { push } = useToast();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);
  const [sessionLogs, setSessionLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const [search, setSearch] = useState("");

  const filteredSessions = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s => {
      const { device, browser } = parseUA(s.user_agent);
      return (
        s.user.full_name?.toLowerCase().includes(q) || 
        s.user.email?.toLowerCase().includes(q) ||
        s.user.office?.name?.toLowerCase().includes(q) ||
        s.user.office?.code?.toLowerCase().includes(q) ||
        s.ip_address?.includes(q) ||
        device.toLowerCase().includes(q) ||
        browser.toLowerCase().includes(q)
      );
    });
  }, [sessions, search]);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const data = await getAdminSessions();
      setSessions(data);
    } catch (err) {
      push({ type: "error", title: "Load Failed", message: "Could not retrieve active sessions." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleRevoke = async (id: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!window.confirm("Are you sure you want to terminate this session? The user will be logged out immediately.")) return;
    
    setRevokingId(id);
    try {
      await revokeAdminSession(id);
      push({ type: "success", title: "Session Terminated", message: "User has been logged out." });
      setSessions(prev => prev.filter(s => s.id !== id));
      if (selectedSession?.id === id) setSelectedSession(null);
    } catch (err) {
      push({ type: "error", title: "Action Failed", message: "Failed to revoke session." });
    } finally {
      setRevokingId(null);
    }
  };

  const handleSelectSession = async (session: AdminSession) => {
    setSelectedSession(session);
    setLogsLoading(true);
    try {
      const logs = await getAdminSessionActivity(session.id);
      setSessionLogs(logs);
    } catch (err) {
      setSessionLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  const columns: TableColumn<AdminSession>[] = useMemo(() => [
    {
      key: "user",
      header: "User",
      render: (s) => <span className="font-bold text-slate-900 dark:text-slate-100">{s.user.full_name}</span>
    },
    {
      key: "office",
      header: "Office",
      render: (s) => (
        <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">
          {s.user.office?.code || "—"}
        </span>
      )
    },
    {
        key: "device",
        header: "Device / Browser",
        render: (s) => {
            const { device, browser } = parseUA(s.user_agent);
            const isMobile = s.user_agent?.toLowerCase().includes("mobile") ?? false;
            return (
                <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded bg-slate-50 dark:bg-surface-400 flex items-center justify-center text-slate-400 shrink-0">
                        {isMobile ? <Smartphone size={13} /> : <Laptop size={13} />}
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{device}</span>
                        <span className="text-[10px] text-slate-400 truncate">{browser}</span>
                    </div>
                </div>
            )
        }
    },
    {
      key: "ip",
      header: "IP Address",
      render: (s) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Globe size={12} className="opacity-50" />
          {s.ip_address}
        </div>
      )
    },
    {
      key: "last_active",
      header: "Last Activity",
      render: (s) => (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{formatDate(s.last_used_at)}</span>
          <span className="text-[10px] text-slate-400">{new Date(s.last_used_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )
    },
    {
      key: "actions",
      header: "",
      render: (s) => (
        <div className="flex justify-end gap-2">
           <button 
              onClick={(e) => { e.stopPropagation(); handleSelectSession(s); }}
              className="p-1.5 text-slate-400 hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 rounded-md transition-all"
              title="Track Activity"
           >
              <Activity size={15} />
           </button>
           <button 
              onClick={(e) => handleRevoke(s.id, e)}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-md transition-all"
              title="Log Out User"
           >
              {revokingId === s.id ? <div className="h-4 w-4 border-2 border-slate-300 border-t-rose-600 rounded-full animate-spin" /> : <Trash2 size={15} />}
           </button>
        </div>
      )
    }
  ], [revokingId]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SearchFilterBar
        search={search}
        setSearch={setSearch}
        placeholder="Search name, email, or IP..."
        onClear={() => setSearch("")}
      />
      
      <div className="flex-1 flex min-h-0 relative">
        <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${selectedSession ? "mr-[400px]" : "mr-0"}`}>
          <div className="flex-1 min-h-0 bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 rounded-sm overflow-hidden">
            <Table<AdminSession>
              bare
              columns={columns}
              rows={filteredSessions}
              rowKey={(s) => s.id}
              loading={loading}
              onRowClick={handleSelectSession}
              emptyMessage={search ? "No sessions match your search." : "No active sessions found."}
              gridTemplateColumns="1.2fr 0.8fr 1.5fr 1fr 1fr 6rem"
            />
          </div>
        </div>
      </div>

      {/* Activity Sidepanel */}
      <aside 
        className={`fixed top-[113px] right-0 bottom-0 w-[400px] bg-white dark:bg-surface-500 border-l border-slate-200 dark:border-surface-400 shadow-2xl z-20 transition-transform duration-300 transform ${selectedSession ? "translate-x-0" : "translate-x-full"}`}
      >
        {selectedSession && (
          <div className="flex flex-col h-full">
            <div className="shrink-0 p-4 border-b border-slate-100 dark:border-surface-400 flex items-center justify-between bg-slate-50/50 dark:bg-surface-600/50">
               <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-brand-500/10 dark:bg-brand-500/20 flex items-center justify-center text-brand-600 dark:text-brand-400">
                    <History size={18} />
                  </div>
                  <div className="min-w-0">
                     <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">Session Tracking</h3>
                     <p className="text-[10px] text-slate-400 truncate uppercase tracking-widest font-bold">{selectedSession.user.full_name}</p>
                  </div>
               </div>
               <button 
                  onClick={() => setSelectedSession(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-surface-400 rounded-md"
               >
                  <X size={18} />
               </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-1">
               <div className="p-4 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100/50 dark:border-amber-900/20 rounded-md m-3 mb-6">
                  <p className="text-[11px] text-amber-700 dark:text-amber-300 leading-relaxed font-medium">
                    Tracking all activities recorded during this specific login session (IP: {selectedSession.ip_address}). 
                    Actions reflect real-time enterprise operations.
                  </p>
               </div>
               
               <ActivityTimeline 
                  items={sessionLogs} 
                  loading={logsLoading} 
               />
               
               {!logsLoading && sessionLogs.length === 0 && (
                 <div className="flex flex-col items-center justify-center py-20 text-center px-10">
                    <Activity className="h-10 w-10 text-slate-200 dark:text-surface-300 mb-4 opacity-50" />
                    <p className="text-sm font-bold text-slate-400 uppercase tracking-tight">No Session Activity</p>
                    <p className="text-xs text-slate-400 mt-1">This user has not performed any loggable actions during this session yet.</p>
                 </div>
               )}
            </div>

            <div className="shrink-0 p-4 bg-slate-50 dark:bg-surface-600/50 border-t border-slate-100 dark:border-surface-400">
               <Button 
                  variant="danger" 
                  size="sm" 
                  loading={revokingId === selectedSession.id}
                  onClick={() => handleRevoke(selectedSession.id)}
                  className="w-full font-bold uppercase tracking-wider text-[11px]"
               >
                  <div className="flex items-center gap-2">
                    <Trash2 size={14} />
                    <span>Revoke & Expel Session</span>
                  </div>
               </Button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
};

export default AdminSessionsTab;
