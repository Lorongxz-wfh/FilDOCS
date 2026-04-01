import { Activity } from "lucide-react";
import { formatDateTime } from "./shared";
import { EVENT_DOT, EVENT_LABEL, FIELD_LABEL } from "../../lib/activityConstants";
import type { ActivityLogItem } from "../../services/types";

type FieldChange = { field: string; old: string | null; new: string | null };

function FieldChangeDiff({ changes }: { changes: FieldChange[] }) {
  return (
    <div className="mt-1.5 space-y-1.5">
      {changes.map((c, i) => (
        <div key={i} className="rounded border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 text-[11px] overflow-hidden">
          <div className="px-2 py-0.5 bg-slate-100 dark:bg-surface-500 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-surface-400">
            {FIELD_LABEL[c.field] ?? c.field}
          </div>
          <div className="flex divide-x divide-slate-200 dark:divide-surface-400">
            <div className="flex-1 px-2 py-1 text-slate-400 dark:text-slate-500 line-through min-w-0">
              <span className="block truncate">{c.old ?? <em className="not-italic opacity-50">empty</em>}</span>
            </div>
            <div className="flex-1 px-2 py-1 text-slate-700 dark:text-slate-300 min-w-0">
              <span className="block truncate">{c.new ?? <em className="not-italic opacity-50">empty</em>}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type Props = {
  logs: ActivityLogItem[];
  loading: boolean;
};

export default function RequestActivityPanel({ logs, loading }: Props) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 bg-slate-50/30 dark:bg-surface-600/30">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2">
          <Activity size={28} className="text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-400 dark:text-slate-500">
            No activity recorded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-1">
          {logs.map((l) => {
            const dotCls = EVENT_DOT[l.event] ?? "bg-sky-400";
            const displayLabel = l.label || EVENT_LABEL[l.event] || l.event;
            const changes: FieldChange[] | null =
              (l.event.endsWith(".updated") || l.event.includes(".field_changed")) && 
              Array.isArray(l.meta?.changes)
                ? (l.meta.changes as FieldChange[])
                : null;

            return (
              <div
                key={l.id}
                className="flex items-start gap-3 rounded-md px-3 py-2.5 hover:bg-white/60 dark:hover:bg-surface-500/40 transition"
              >
                <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${dotCls}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                      {displayLabel}
                    </p>
                    {l.actor_user && (
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-normal">
                        by {l.actor_user.first_name} {l.actor_user.last_name}
                        {l.actor_office?.code && ` (${l.actor_office.code})`}
                      </span>
                    )}
                  </div>
                  {changes && changes.length > 0 && <FieldChangeDiff changes={changes} />}
                  <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                    {formatDateTime(l.created_at)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
