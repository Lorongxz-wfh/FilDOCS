import React, { useState, useMemo, useEffect } from "react";
import { 
  GitCommit, 
  Send, 
  CheckCircle2, 
  XCircle, 
  CornerDownRight,
  History,
  AlertCircle,
  MessageSquare,
  FileEdit,
  FileCheck,
  Calendar,
  Layers,
  ChevronDown,
  User,
  Activity
} from "lucide-react";
import type { ActivityLogItem } from "../../../services/documents";
import { formatDateTime } from "../../../utils/formatters";

interface Props {
  logs: ActivityLogItem[];
  isLoading: boolean;
  versionNumber?: number;
}

const MACRO_EVENTS = [
  "document.created",
  "version.revision_created",
  "workflow.sent_to_review",
  "workflow.sent_to_approval",
  "workflow.forwarded_to_vp",
  "workflow.forwarded_to_president",
  "workflow.returned_for_check",
  "workflow.returned_to_draft",
  "workflow.rejected",
  "workflow.registered",
  "workflow.distributed",
  "workflow.cancelled",
  "document.sharing_updated",
];

const DETAIL_EVENTS = [
  "document.comment_added",
  "document.updated",
  "document.field_changed",
  "version.file_replaced",
  "version.effective_date_updated",
  "version.description_updated",
];

const WorkflowFlowTimeline: React.FC<Props> = ({ logs, isLoading, versionNumber = 0 }) => {
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);

  // Grouping logic: Macro events contain all DETAIL events that happened since the previous macro event
  const groupedLogs = useMemo(() => {
    if (!logs.length) return [];
    
    const sorted = [...logs].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const macroItems = sorted.filter(l => MACRO_EVENTS.includes(l.event));
    
    if (macroItems.length === 0 && sorted.length > 0) {
      // Fallback if no macro events found but we have logs
      return [{
        ...sorted[0],
        id: -2,
        label: "Document Activity",
        subActions: sorted
      }].reverse();
    }

    const result = macroItems.map((m, i) => {
      const prevTime = i === 0 ? 0 : new Date(macroItems[i-1].created_at).getTime();
      const currTime = new Date(m.created_at).getTime();
      
      const subActions = sorted.filter(l => {
        if (!DETAIL_EVENTS.includes(l.event)) return false;
        const t = new Date(l.created_at).getTime();
        // Include actions that happened between the end of the previous step and completion of this one
        return t > prevTime && t <= currTime;
      });

      return { ...m, subActions };
    });

    // Check for "Current" actions (after last macro transition)
    const lastMacro = macroItems[macroItems.length - 1];
    const lastMacroTime = lastMacro ? new Date(lastMacro.created_at).getTime() : 0;
    const currentActions = sorted.filter(l => {
      return DETAIL_EVENTS.includes(l.event) && new Date(l.created_at).getTime() > lastMacroTime;
    });

    if (currentActions.length > 0) {
      result.push({
        id: -1, // Virtual current ID
        event: "current_step",
        label: "Current In-Progress Activity",
        created_at: new Date().toISOString(),
        subActions: currentActions,
      } as any);
    }

    return result.reverse(); // Newest first
  }, [logs]);

  // Auto-expand the latest item on first load
  useEffect(() => {
    if (groupedLogs.length > 0 && expandedLogId === null) {
      setExpandedLogId(groupedLogs[0].id);
    }
  }, [groupedLogs, expandedLogId]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-surface-400 shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 bg-slate-200 dark:bg-surface-400 rounded w-3/4" />
              <div className="h-2 bg-slate-100 dark:bg-surface-500 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groupedLogs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center min-h-[300px]">
        <div className="rounded-full bg-slate-50 dark:bg-surface-600/50 p-4 mb-3 border border-slate-100 dark:border-surface-400/30">
          <History className="h-8 w-8 text-slate-300 dark:text-slate-500" />
        </div>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          No workflow transitions recorded yet.
        </p>
      </div>
    );
  }

  const getEventIcon = (event: string) => {
    switch (event) {
      case "document.created":
      case "version.revision_created":
        return <GitCommit className="h-3.5 w-3.5" />;
      case "workflow.rejected":
      case "workflow.cancelled":
        return <XCircle className="h-3.5 w-3.5" />;
      case "workflow.distributed":
      case "workflow.registered":
        return <CheckCircle2 className="h-3.5 w-3.5" />;
      case "workflow.returned_to_draft":
      case "workflow.returned_for_check":
        return <AlertCircle className="h-3.5 w-3.5" />;
      case "current_step":
        return <Activity className="h-3.5 w-3.5 animate-pulse" />;
      default:
        return <Send className="h-3.5 w-3.5" />;
    }
  };

  const getSubEventIcon = (event: string) => {
    switch (event) {
      case "document.comment_added": return <MessageSquare className="h-3 w-3" />;
      case "document.field_changed": 
      case "document.updated": return <FileEdit className="h-3 w-3" />;
      case "version.file_replaced": return <FileCheck className="h-3 w-3" />;
      case "version.effective_date_updated": return <Calendar className="h-3 w-3" />;
      case "document.sharing_updated": return <Layers className="h-3 w-3" />;
      default: return <Activity className="h-3 w-3" />;
    }
  };

  const getEventBg = (event: string) => {
    if (event === "workflow.rejected" || event === "workflow.cancelled") {
      return "bg-rose-50 text-rose-500 border-rose-100 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-800";
    }
    if (event === "workflow.distributed" || event === "workflow.registered") {
      return "bg-emerald-50 text-emerald-500 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800";
    }
    if (event.includes("returned")) {
      return "bg-amber-50 text-amber-500 border-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800";
    }
    if (event === "current_step") {
      return "bg-brand-50 text-brand-500 border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/30";
    }
    return "bg-slate-50 text-slate-500 border-slate-100 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-300";
  };

  return (
    <div className="flex-1 px-1 py-1">
      <div className="relative pl-10 space-y-4 before:absolute before:left-[17px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200 dark:before:bg-surface-400">
        {groupedLogs.map((log: any, index) => {
          const isLatest = index === 0;
          const fromStatus = log.meta?.from_status;
          const toStatus = log.meta?.to_status;
          const note = log.meta?.note;
          const isExpanded = expandedLogId === log.id;
          
          let displayLabel = log.label;
          if (log.event === "document.created") {
            displayLabel = versionNumber > 0 ? "Revision Created" : "Draft Created";
          } else if (log.event === "version.revision_created") {
            displayLabel = "Revision Started";
          } else if (!displayLabel) {
            displayLabel = log.event === "current_step" ? "Recent Activity" : "Status Changed";
          }

          return (
            <div key={log.id} className="relative group">
              {/* Timeline Connector Dot */}
              <div 
                className={`absolute -left-10 top-0.5 flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white dark:bg-surface-600 z-10 transition-all ${getEventBg(log.event)} ${isLatest ? 'ring-4 ring-brand-500/10 dark:ring-brand-500/20 scale-110 shadow-sm border-brand-200 dark:border-brand-500/40' : 'border-white dark:border-surface-400 shadow-sm'}`}
              >
                {getEventIcon(log.event)}
              </div>

              {/* Content Card */}
              <div 
                onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                className={`rounded-xl border p-4 transition-all cursor-pointer ${isExpanded ? 'border-brand-200 bg-brand-50/20 dark:border-brand-500/20 dark:bg-brand-500/5 shadow-sm' : 'border-slate-100 bg-white dark:border-surface-400 dark:bg-surface-500 hover:border-slate-300 dark:hover:border-slate-400'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                       <p className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-none">
                        {displayLabel}
                      </p>
                      <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                    <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                      {formatDateTime(log.created_at)}
                    </p>
                  </div>
                </div>

                {/* Transition Flow */}
                {(fromStatus || log.event === "document.created") && toStatus && (
                  <div className="mt-3 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200/60 bg-slate-50/50 text-slate-500 dark:bg-surface-400/40 dark:text-slate-400 dark:border-surface-300/20">
                      {fromStatus || "New"}
                    </span>
                    <CornerDownRight className="h-3 w-3 text-slate-300 dark:text-surface-400" />
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded border ${
                      log.event === 'workflow.rejected' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-800/50 shadow-sm' : 
                      log.event.includes('distributed') || log.event.includes('registered') ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50 shadow-sm' :
                      'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-500/10 dark:text-brand-300 dark:border-brand-500/30'
                    }`}>
                      {toStatus}
                    </span>
                  </div>
                )}

                {/* Actor Info (Only for actual transition) */}
                {log.id !== -1 && (
                  <div className="mt-4 flex items-center gap-3 border-t border-slate-100 dark:border-surface-400/50 pt-4">
                    <div className="h-6 w-6 rounded-full bg-slate-100 dark:bg-surface-400 flex items-center justify-center text-[11px] font-black text-slate-500 dark:text-slate-300 border border-white dark:border-surface-500 shadow-sm">
                      {(log.actor_user?.first_name?.[0] || log.actor_user?.name?.[0] || '?').toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200 truncate">
                        {log.actor_user?.full_name || log.actor_user?.name || "System"}
                      </p>
                      {log.actor_office && (
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate font-semibold uppercase">
                          {log.actor_office.name}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Optional Note */}
                {note && (
                  <div className="mt-3 rounded-lg bg-slate-50/80 dark:bg-surface-600/30 p-2.5 border border-slate-200/50 dark:border-surface-400/40">
                    <p className="text-[11px] leading-relaxed text-slate-600 dark:text-slate-300 italic">
                      "{note}"
                    </p>
                  </div>
                )}

                {/* Micro-actions (Sub-logs) */}
                {isExpanded && log.subActions && log.subActions.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-surface-400/50 animate-in slide-in-from-top-2 duration-300">
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-3 px-1">Phase Actions</p>
                    <div className="space-y-4 pl-3 relative before:absolute before:left-[5.5px] before:top-1 before:bottom-1 before:w-[1.5px] before:bg-slate-100 dark:before:bg-surface-400/30">
                      {log.subActions.map((sub: ActivityLogItem) => (
                        <div key={sub.id} className="relative flex items-start gap-3 group/sub">
                          <div className="absolute -left-[3.5px] top-1 h-3 w-3 rounded-full border border-white dark:border-surface-600 bg-slate-200 dark:bg-surface-400 flex items-center justify-center z-10 group-hover/sub:bg-brand-400 group-hover/sub:scale-110 transition-all">
                            <div className="scale-75 text-slate-500 dark:text-slate-300 group-hover/sub:text-white">
                              {getSubEventIcon(sub.event)}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                               <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                                {sub.label || sub.event}
                              </p>
                              <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                {formatDateTime(sub.created_at).split(',').pop()}
                              </span>
                            </div>
                            
                            {/* Actor for sub-action */}
                            <div className="flex items-center gap-1.5 mt-0.5">
                               <div className="flex -space-x-1">
                                  <div className="h-3.5 w-3.5 rounded-full bg-slate-50 dark:bg-surface-400 border border-slate-200 dark:border-surface-300 flex items-center justify-center">
                                    <User className="h-2 w-2 text-slate-500 dark:text-slate-300" />
                                  </div>
                               </div>
                               <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                  {sub.actor_user?.first_name} {sub.actor_user?.last_name}
                               </p>
                            </div>

                            {sub.meta?.message && (
                               <p className="mt-1.5 text-[10px] text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-surface-600/40 rounded px-2 py-1 italic border-l-2 border-slate-200 dark:border-surface-400 line-clamp-2">
                                  "{sub.meta.message}"
                               </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {isExpanded && (!log.subActions || log.subActions.length === 0) && (
                   <div className="mt-4 pt-2 border-t border-slate-100 dark:border-surface-400/50 text-center">
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">No secondary actions recorded for this phase.</p>
                   </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WorkflowFlowTimeline;
