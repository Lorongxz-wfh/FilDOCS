import React from "react";
import { FIELD_LABEL } from "../../lib/activityConstants";

export type FieldChange = { field: string; old: string | null; new: string | null };

interface ActivityDiffProps {
  changes: FieldChange[];
  className?: string;
}

const ActivityDiff: React.FC<ActivityDiffProps> = ({ changes, className = "" }) => {
  if (!changes || !Array.isArray(changes) || changes.length === 0) return null;

  return (
    <div className={`mt-1.5 space-y-1.5 ${className}`}>
      {changes.map((c, i) => (
        <div 
          key={i} 
          className="rounded border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 text-[11px] overflow-hidden "
        >
          <div className="px-2 py-0.5 bg-slate-100 dark:bg-surface-500 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-surface-400">
            {FIELD_LABEL[c.field] ?? c.field}
          </div>
          <div className="flex divide-x divide-slate-200 dark:divide-surface-400">
            <div className="flex-1 px-2 py-1 text-slate-400 dark:text-slate-500 line-through min-w-0 bg-slate-50/50 dark:bg-surface-600/30">
              <span className="block truncate" title={String(c.old ?? "empty")}>
                {c.old ?? <em className="not-italic opacity-50">empty</em>}
              </span>
            </div>
            <div className="flex-1 px-2 py-1 text-slate-700 dark:text-slate-300 min-w-0 font-medium">
              <span className="block truncate" title={String(c.new ?? "empty")}>
                {c.new ?? <em className="not-italic opacity-50">empty</em>}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ActivityDiff;
