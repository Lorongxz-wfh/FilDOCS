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
        "rounded-xl border px-4 py-3 transition-all duration-500",
        pulse
          ? "border-sky-400 bg-sky-50 dark:border-sky-500 dark:bg-sky-950/30 shadow-[0_0_0_3px_rgba(56,189,248,0.15)]"
          : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500",
      ].join(" ")}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Current task
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {isTasksReady ? currentStep.label : "Loading…"}
          </p>
          {nextStep && (
            <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500 truncate">
              Next → {nextStep.label}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span
            className={[
              "rounded-full px-2 py-0.5 text-xs font-semibold",
              !isTasksReady
                ? "bg-slate-100 text-slate-500 dark:bg-surface-400 dark:text-slate-400"
                : canAct
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-400",
            ].join(" ")}
          >
            {!isTasksReady
              ? "Checking…"
              : canAct
                ? "Action enabled"
                : "View only"}
          </span>

          {taskChanged && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-900/40 px-2 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400 animate-pulse">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              Workflow updated
            </span>
          )}

          {isBurstPolling && (
            <button
              type="button"
              onClick={stopBurstPolling}
              className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            >
              Stop live updates
            </button>
          )}
        </div>
      </div>

      {/* Info rows */}
      <div className="mt-3 space-y-1.5">
        {!isTasksReady ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <>
            {/* From (your office — who sent it) */}
            <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-400 px-3 py-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                From
              </span>
              <div className="flex items-center gap-1.5">
                {canAct && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                )}
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 text-right truncate">
                  {myOfficeName ?? "—"}
                </span>
              </div>
            </div>

            {/* To (assigned office — who needs to act) */}
            <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-400 px-3 py-2">
              <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                For
              </span>
              <span
                className={`text-xs font-semibold text-right truncate ${canAct ? "text-emerald-700 dark:text-emerald-400" : "text-slate-800 dark:text-slate-200"}`}
              >
                {assignedOfficeName ?? "—"}
              </span>
            </div>

            {/* Phase */}
            {currentTask && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-400 px-3 py-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  Phase
                </span>
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize text-right">
                  {currentTask.phase}
                </span>
              </div>
            )}

            {/* Date started */}
            {openedAt && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-400 px-3 py-2">
                <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  Started
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 text-right">
                  {openedAt}
                </span>
              </div>
            )}

            {/* No task warning */}
            {!currentTask && (
              <p className="text-xs text-rose-600 dark:text-rose-400 px-1">
                No open workflow task found for this version.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default WorkflowTaskPanel;
