import React from "react";
import { motion } from "framer-motion";
import { Activity, Clock, Undo2 } from "lucide-react";
import { formatRelative } from "../../../utils/formatters";
import SkeletonList from "../../ui/loader/SkeletonList";
import type { ActivityLogItem } from "../../../services/documents";

const EVENT_LABEL: Record<string, string> = {
  "document.created": "Document Created",
  "document.updated": "Metadata Updated",
  "document.deleted": "Document Deleted",
  "document.archived": "Document Archived",
  "document.restored": "Document Restored",
  "document.forwarded": "Step Forwarded",
  "document.returned": "Step Returned",
  "document.signed": "Document Signed",
  "document.file_replaced": "File Replaced",
  "document.distributed": "Distributed",
  "document.finalized": "Finalized",
};

const EVENT_DOT: Record<string, string> = {
  "document.created": "bg-sky-500",
  "document.forwarded": "bg-brand-500",
  "document.returned": "bg-amber-500",
  "document.signed": "bg-emerald-500",
  "document.file_replaced": "bg-indigo-500",
  "document.distributed": "bg-purple-500",
  "document.deleted": "bg-rose-500",
};

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  description: "Description",
  doctype: "Type",
  effective_date: "Effective Date",
  retention_date: "Retention Date",
  status: "Status",
};

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
};

type FieldChange = { field: string; old: string | null; new: string | null };

function FieldChangeDiff({ changes }: { changes: FieldChange[] }) {
  return (
    <div className="mt-2 space-y-2">
      {changes.map((c, i) => (
        <div key={i} className="rounded-lg border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 text-[10px] overflow-hidden shadow-sm">
          <div className="px-3 py-1 bg-slate-50/50 dark:bg-surface-500 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-[0.1em] border-b border-slate-200 dark:border-surface-400">
            {FIELD_LABEL[c.field] ?? c.field}
          </div>
          <div className="flex divide-x divide-slate-200 dark:divide-surface-400">
            <div className="flex-1 px-3 py-1.5 text-slate-400 dark:text-slate-500 line-through min-w-0 bg-slate-50/30 dark:bg-transparent">
              <span className="block truncate">{c.old ?? <em className="not-italic opacity-40">empty</em>}</span>
            </div>
            <div className="flex-1 px-3 py-1.5 text-slate-800 dark:text-slate-200 font-bold min-w-0">
              <span className="block truncate">{c.new ?? <em className="not-italic opacity-40">empty</em>}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const WorkflowActivityPanel: React.FC<Props> = ({ logs, loading }) => {

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto px-1 py-1">
        <SkeletonList variant="activity" rows={6} className="divide-y divide-slate-100 dark:divide-surface-400/30" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 gap-3 text-center">
        <div className="h-10 w-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400 border border-slate-200 dark:border-surface-300/30">
          <Activity size={20} className="text-slate-300" />
        </div>
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">History Empty</p>
          <p className="text-[11px] font-medium text-slate-300 dark:text-slate-600">No activity has been recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={{
        visible: { transition: { staggerChildren: 0.05 } }
      }}
      className="flex-1 overflow-y-auto px-1 py-1 space-y-1"
    >
      {logs.map((log) => {
        const dotCls = EVENT_DOT[log.event] ?? "bg-slate-300 dark:bg-surface-300";
        const displayLabel = log.label || EVENT_LABEL[log.event] || log.event;
        const changes: FieldChange[] | null =
          (log.event.endsWith(".updated") || log.event.includes(".field_changed")) && 
          Array.isArray(log.meta?.changes)
            ? (log.meta.changes as FieldChange[])
            : null;

        return (
          <motion.div
            key={log.id}
            variants={{
              hidden: { opacity: 0, x: -5 },
              visible: { opacity: 1, x: 0 }
            }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="group flex items-start gap-4 rounded-xl px-4 py-4 hover:bg-slate-50/50 dark:hover:bg-surface-400/10 transition-all border border-transparent hover:border-slate-200 dark:hover:border-surface-400/50"
          >
            <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotCls} group-hover:ring-4 group-hover:ring-slate-100 dark:group-hover:ring-surface-400/20 transition-all`} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-1">
                <div className={`flex flex-wrap items-center gap-2 ${log.is_loop ? "py-1 px-2 rounded bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30 w-fit" : ""}`}>
                  {log.is_loop && <Undo2 className="h-3 w-3 text-amber-600 dark:text-amber-500 shrink-0" />}
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                    {displayLabel}
                  </span>
                  
                  {log.duration_human && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-slate-200 dark:border-surface-400 text-[9px] font-bold uppercase tracking-widest bg-white dark:bg-surface-500 text-slate-500 dark:text-slate-400">
                      <Clock className="h-2.5 w-2.5" />
                      {log.duration_human}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {log.actor_user && (
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                      {log.actor_user.full_name || `${log.actor_user.first_name} ${log.actor_user.last_name}`}
                      {log.actor_office?.code && (
                        <span className="ml-1 opacity-50">({log.actor_office.code})</span>
                      )}
                    </span>
                  )}
                  <span className="text-[9px] font-bold uppercase tracking-widest text-slate-300 dark:text-slate-600">
                    {formatRelative(log.created_at)}
                  </span>
                </div>
              </div>
              
              {changes && changes.length > 0 && (
                <FieldChangeDiff changes={changes} />
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default WorkflowActivityPanel;
