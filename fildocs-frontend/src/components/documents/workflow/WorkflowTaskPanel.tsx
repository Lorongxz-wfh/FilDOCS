import React from "react";
import Skeleton from "../../ui/loader/Skeleton";
import type { WorkflowTask, Office } from "../../../services/documents";
import type { FlowStep } from "./config/flowConfig";

type Props = {
  isTasksReady: boolean;
  currentStep: FlowStep;
  nextStep: FlowStep | null;
  assignedOfficeId: number | null;
  myOfficeId: number | null;
  currentTask: WorkflowTask | null;
  canAct: boolean;
  isBurstPolling: boolean;
  stopBurstPolling: () => void;
  taskChanged: boolean;
  clearTaskChanged: () => void;
  offices: Office[];
};

const WorkflowTaskPanel: React.FC<Props> = ({
  isTasksReady,
  currentStep,
  nextStep,
  assignedOfficeId,
  myOfficeId,
  currentTask,
  canAct,
  isBurstPolling,
  stopBurstPolling,
  taskChanged,
  clearTaskChanged,
  offices,
}) => {
  const [pulse, setPulse] = React.useState(false);

  React.useEffect(() => {
    if (!taskChanged) return;
    setPulse(true);
    const t = window.setTimeout(() => {
      setPulse(false);
      clearTaskChanged();
    }, 3000);
    return () => window.clearTimeout(t);
  }, [taskChanged, clearTaskChanged]);

  const assignedOfficeName = React.useMemo(() => {
    if (!assignedOfficeId || !offices.length) return null;
    const o = offices.find((x) => Number(x.id) === Number(assignedOfficeId));
    return o ? `${o.name} (${o.code})` : `Office #${assignedOfficeId}`;
  }, [assignedOfficeId, offices]);

  const myOfficeName = React.useMemo(() => {
    if (!myOfficeId || !offices.length) return null;
    const o = offices.find((x) => Number(x.id) === Number(myOfficeId));
    return o ? `${o.name} (${o.code})` : `Office #${myOfficeId}`;
  }, [myOfficeId, offices]);

  const openedAt = currentTask?.opened_at
    ? new Date(currentTask.opened_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div
      className={[
        "rounded-xl border px-4 py-4 transition-all duration-500",
        pulse
          ? "border-brand-400 bg-brand-50/50 dark:border-brand-500/50 dark:bg-brand-950/20 shadow-[0_0_12px_rgba(var(--brand-500-rgb),0.1)]"
          : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 shadow-sm",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
            Current Task
          </p>
          <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {isTasksReady ? currentStep.label : "Retrieving task details..."}
          </p>
          {nextStep && (
            <p className="mt-1 text-[11px] font-medium text-slate-400 dark:text-slate-500 truncate flex items-center gap-1.5">
              <span className="uppercase tracking-widest text-[9px] font-bold opacity-60">Next:</span>
              <span className="font-bold text-slate-500 dark:text-slate-400">{nextStep.label}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={[
              "rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border transition-colors duration-300",
              !isTasksReady
                ? "bg-slate-50 text-slate-400 border-slate-100 dark:bg-surface-400 dark:text-slate-400 dark:border-surface-300/30"
                : canAct
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-900/30"
                  : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-300/30",
            ].join(" ")}
          >
            {!isTasksReady
              ? "Checking"
              : canAct
                ? "Action Enabled"
                : "View Only"}
          </span>

          {taskChanged && (
            <span className="inline-flex items-center gap-1.5 rounded bg-brand-50 dark:bg-brand-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 animate-pulse border border-brand-100 dark:border-brand-900/30">
              <span className="h-1 w-1 rounded-full bg-brand-500" />
              Syncing
            </span>
          )}

          {isBurstPolling && (
            <button
              type="button"
              onClick={stopBurstPolling}
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition-colors"
            >
              Live
            </button>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div className="mt-4 space-y-2">
        {!isTasksReady ? (
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : (
          <>
            {/* From (your office — who sent it) */}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/50 dark:bg-surface-600/30 border border-slate-200 dark:border-surface-400/50 px-3 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">
                Source
              </span>
              <div className="flex items-center gap-2 min-w-0">
                {canAct && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
                )}
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 text-right truncate">
                  {myOfficeName ?? "—"}
                </span>
              </div>
            </div>

            {/* To (assigned office — who needs to act) */}
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/50 dark:bg-surface-600/30 border border-slate-200 dark:border-surface-400/50 px-3 py-2.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">
                Assigned
              </span>
              <span
                className={`text-[11px] font-bold text-right truncate ${canAct ? "text-emerald-600 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}
              >
                {assignedOfficeName ?? "—"}
              </span>
            </div>

            {/* Phase */}
            {currentTask && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/50 dark:bg-surface-600/30 border border-slate-200 dark:border-surface-400/50 px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">
                  Phase
                </span>
                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-right">
                  {currentTask.phase}
                </span>
              </div>
            )}

            {/* Date started */}
            {openedAt && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50/50 dark:bg-surface-600/30 border border-slate-200 dark:border-surface-400/50 px-3 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 shrink-0">
                  Started
                </span>
                <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 text-right tabular-nums">
                  {openedAt}
                </span>
              </div>
            )}

            {/* No task warning */}
            {!currentTask && (
              <div className="flex items-center justify-center py-2 px-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-rose-500 dark:text-rose-400 text-center">
                  No active workflow task found.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowTaskPanel;
