import React from "react";
import { Activity } from "lucide-react";
import { EVENT_DOT, EVENT_LABEL, FIELD_LABEL } from "../../../lib/activityConstants";
import type { ActivityLogItem } from "../../../services/documents";

import { formatRelative, formatDateTime } from "../../../utils/formatters";

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
};

type FieldChange = { field: string; old: string | null; new: string | null };

function FieldChangeDiff({ changes }: { changes: FieldChange[] }) {
  return (
    <div className="mt-1.5 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      {changes.map((c, i) => (
        <div key={i} className="rounded border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 text-[10px] overflow-hidden shadow-sm">
          <div className="px-2 py-0.5 bg-slate-50 dark:bg-surface-500 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-surface-400">
            {FIELD_LABEL[c.field] ?? c.field}
          </div>
          <div className="flex divide-x divide-slate-200 dark:divide-surface-400">
            <div className="flex-1 px-2 py-1 text-slate-400 dark:text-slate-500 line-through min-w-0 bg-slate-50/30 dark:bg-transparent">
              <span className="block truncate">{c.old ?? <em className="not-italic opacity-50">empty</em>}</span>
            </div>
            <div className="flex-1 px-2 py-1 text-slate-800 dark:text-slate-200 font-medium min-w-0">
              <span className="block truncate">{c.new ?? <em className="not-italic opacity-50">empty</em>}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const DocumentActivityPanel: React.FC<Props> = ({ logs, loading }) => {

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-slate-200 dark:border-surface-400 border-t-brand-500 animate-spin" />
          <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Loading...</span>
        </div>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 opacity-60">
        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-50 dark:bg-surface-400">
          <Activity size={20} className="text-slate-400" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 text-center">
          No activity recorded
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-1 py-1 space-y-1">
      {logs.map((log) => {
        const dotCls = EVENT_DOT[log.event] ?? "bg-slate-300 dark:bg-surface-300";
        const displayLabel = log.label || EVENT_LABEL[log.event] || log.event;
        const changes: FieldChange[] | null =
          (log.event.endsWith(".updated") || log.event.includes(".field_changed")) && 
          Array.isArray(log.meta?.changes)
            ? (log.meta.changes as FieldChange[])
            : null;

        return (
          <div
            key={log.id}
            className="group flex items-start gap-3 rounded-lg px-3 py-3 hover:bg-slate-50 dark:hover:bg-surface-400/20 transition-all border border-transparent hover:border-slate-100 dark:hover:border-surface-400"
          >
            <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotCls} shadow-sm group-hover:scale-125 transition-transform`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-0.5">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-snug">
                  {displayLabel}
                </p>
                <div className="flex items-center gap-1.5">
                  {log.actor_user && (
                    <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                      {log.actor_user.full_name || `${log.actor_user.first_name} ${log.actor_user.last_name}`}
                      {log.actor_office?.code && (
                        <span className="ml-1 opacity-60">({log.actor_office.code})</span>
                      )}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    • {formatRelative(log.created_at)} ({formatDateTime(log.created_at)})
                  </span>
                </div>
              </div>
              
              {changes && changes.length > 0 && (
                <FieldChangeDiff changes={changes} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DocumentActivityPanel;
