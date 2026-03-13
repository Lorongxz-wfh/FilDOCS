import React from "react";
import { CheckCircle2, Circle } from "lucide-react";
import Skeleton from "../../ui/loader/Skeleton";
import type { FlowStep, Phase, PhaseId } from "./flowConfig";
import type { WorkflowTask } from "../../../services/documents";

type Props = {
  phases: Phase[];
  routeStepsCount: number;
  isTasksReady: boolean;
  currentStep: FlowStep;
  nextStep: FlowStep | null;
  currentPhaseIndex: number;
  currentGlobalIndex: number;
  currentPhaseId: PhaseId;
  activeFlowSteps: FlowStep[];
  tasks: WorkflowTask[];
};

const WorkflowProgressCard: React.FC<Props> = ({
  phases,
  routeStepsCount,
  isTasksReady,
  currentStep,
  nextStep,
  currentPhaseIndex,
  currentGlobalIndex,
  currentPhaseId,
  activeFlowSteps,
  // tasks,
}) => {
  const currentPhase = phases.find((p) => p.id === currentPhaseId) ?? phases[0];

  // Task-based progress across entire flow
  // Total = all flow steps. Completed = steps before current global index.
  const totalSteps = Math.max(activeFlowSteps.length, 1);
  const completedSteps =
    currentPhaseId === "completed"
      ? totalSteps
      : Math.max(0, currentGlobalIndex); // steps before current = completed
  const progressPct = Math.min(
    100,
    Math.round((completedSteps / totalSteps) * 100),
  );

  // Collapsed by default on mobile, expanded on desktop
  const [expanded, setExpanded] = React.useState(() => {
    if (typeof window !== "undefined") return window.innerWidth >= 1024;
    return true;
  });

  return (
    <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden">
      {/* ── Collapsed / header bar ── always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-4 py-2.5 transition hover:bg-slate-50 dark:hover:bg-surface-400/40"
      >
        <div className="flex items-center justify-between gap-4">
          {/* Left: label + routing badge + current step */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Workflow progress
              </p>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                  routeStepsCount > 0
                    ? "bg-violet-50 text-violet-700 border border-violet-200 dark:bg-violet-950/40 dark:text-violet-400 dark:border-violet-800"
                    : "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-300"
                }`}
              >
                {routeStepsCount > 0 ? "Custom" : "Default"}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                {!isTasksReady ? (
                  <div className="h-full w-1/3 rounded-full bg-slate-300 dark:bg-surface-300 animate-pulse" />
                ) : (
                  <div
                    className="h-full rounded-full bg-sky-500 transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                )}
              </div>
              {!isTasksReady ? (
                <div className="h-3 w-16 rounded-full bg-slate-300 dark:bg-surface-300 animate-pulse shrink-0" />
              ) : (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-sky-600 dark:text-sky-400">
                    {currentPhase.label}
                  </span>
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    {progressPct}%
                  </span>
                </div>
              )}
            </div>

            {/* Current + Next step — shown when collapsed */}
            {!expanded && (
              <div className="mt-1 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {isTasksReady ? (
                    <>
                      Current:{" "}
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {currentStep.label}
                      </span>
                    </>
                  ) : (
                    <Skeleton className="h-3 w-40" />
                  )}
                </div>
                {isTasksReady && nextStep && (
                  <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                    Next:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {nextStep.label}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: chevron only — next step moved to expanded body */}
          <div className="shrink-0 flex items-center gap-3">
            <svg
              className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${expanded ? "rotate-180" : "rotate-0"}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
        </div>
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-100 dark:border-surface-400">
          {/* Current step detail */}
          <div className="pt-3 flex items-start justify-between gap-6">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Current step
              </p>
              {!isTasksReady ? (
                <Skeleton className="mt-1 h-5 w-52" />
              ) : (
                <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {currentStep.label}
                </p>
              )}
            </div>
            {/* Next step — always visible inside expanded */}
            <div className="text-right shrink-0 min-w-55">
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Next step
              </p>
              {!isTasksReady ? (
                <Skeleton className="mt-1 h-3 w-20 ml-auto" />
              ) : nextStep ? (
                <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
                  {nextStep.label}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                  —
                </p>
              )}
            </div>
          </div>

          {/* Phase rail */}
          {!isTasksReady ? (
            <div className="mt-3 flex items-center gap-1.5">
              {phases.map((_, i) => (
                <React.Fragment key={i}>
                  <div className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-slate-200 dark:bg-surface-300 shrink-0" />
                      <div className="h-2.5 w-full rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                    </div>
                  </div>
                  {i < phases.length - 1 && (
                    <div className="h-3 w-3 rounded bg-slate-200 dark:bg-surface-300 shrink-0 animate-pulse" />
                  )}
                </React.Fragment>
              ))}
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-1.5 sm:flex-row sm:items-stretch">
              {phases.map((phase, index) => {
                const isCurrent = index === currentPhaseIndex;
                const isCompleted = index < currentPhaseIndex;

                return (
                  <React.Fragment key={phase.id}>
                    <div
                      className={`flex-1 min-w-0 rounded-lg border px-3 py-2 ${
                        isCurrent
                          ? "border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/40"
                          : isCompleted
                            ? "border-emerald-200 bg-emerald-50/40 dark:border-emerald-800 dark:bg-emerald-950/20"
                            : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                              isCurrent
                                ? "bg-sky-600"
                                : isCompleted
                                  ? "bg-emerald-500"
                                  : "bg-slate-300 dark:bg-surface-300"
                            }`}
                          />
                          <span
                            className={`text-xs font-semibold truncate ${
                              isCurrent
                                ? "text-sky-800 dark:text-sky-300"
                                : isCompleted
                                  ? "text-slate-700 dark:text-slate-300"
                                  : "text-slate-500 dark:text-slate-400"
                            }`}
                            title={phase.label}
                          >
                            {phase.label}
                          </span>
                        </div>
                        {isCurrent && (
                          <Circle
                            className="shrink-0 h-4 w-4 text-sky-500 dark:text-sky-400 animate-pulse fill-sky-100 dark:fill-sky-950/60"
                            strokeWidth={2}
                          />
                        )}
                        {!isCurrent && isCompleted && (
                          <CheckCircle2
                            className="shrink-0 h-4 w-4 text-emerald-500 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950/40"
                            strokeWidth={2}
                          />
                        )}
                        {!isCurrent && !isCompleted && (
                          <Circle
                            className="shrink-0 h-4 w-4 text-slate-300 dark:text-surface-300"
                            strokeWidth={2}
                          />
                        )}
                      </div>
                    </div>

                    {index < phases.length - 1 && (
                      <div className="flex items-center justify-center sm:shrink-0">
                        <svg
                          className={`h-4 w-4 rotate-90 sm:rotate-0 ${
                            isCompleted
                              ? "text-emerald-400"
                              : isCurrent
                                ? "text-sky-400"
                                : "text-slate-300 dark:text-surface-300"
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M7.5 4.5 13 10l-5.5 5.5-1.4-1.4L10.2 10 6.1 5.9 7.5 4.5z" />
                        </svg>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}

          {/* Steps timeline */}
          {!isTasksReady ? (
            <div className="mt-3 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50/40 dark:bg-surface-600/40 p-3">
              <div className="flex items-center justify-between mb-4">
                <div className="h-2.5 w-28 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                <div className="h-2.5 w-20 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
              </div>
              <div className="flex justify-center items-center gap-6 py-2">
                {[1, 2, 3].map((i) => (
                  <React.Fragment key={i}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                      <div className="h-2.5 w-20 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                      <div className="h-2 w-14 rounded-full bg-slate-100 dark:bg-surface-400 animate-pulse" />
                    </div>
                    {i < 3 && (
                      <div className="flex items-center gap-1 mb-6">
                        <div className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                        <div className="h-3 w-3 rounded bg-slate-200 dark:bg-surface-300 animate-pulse" />
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3 dark:border-surface-400 dark:bg-surface-600/40">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {currentPhase.label} steps
                </p>
                {nextStep ? (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Next:{" "}
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {nextStep.label}
                    </span>
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    No next step
                  </p>
                )}
              </div>

              <div className="mt-4 -mx-2 overflow-x-auto px-2">
                <div className="flex w-full justify-center">
                  <div className="flex w-max items-center gap-3">
                    {(() => {
                      const phaseSteps = activeFlowSteps.filter(
                        (s) => s.phase === currentPhaseId,
                      );

                      if (phaseSteps.length <= 1) {
                        const step = phaseSteps[0] ?? currentStep;
                        const isCurrent = step.id === currentStep.id;
                        return (
                          <div className="flex w-full justify-center">
                            <div className="flex w-56 flex-col items-center text-center">
                              <div
                                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold shadow-sm ${
                                  isCurrent
                                    ? "bg-sky-600 text-white"
                                    : "bg-white text-slate-600 border border-slate-200 dark:bg-surface-500 dark:text-slate-300 dark:border-surface-300"
                                }`}
                              >
                                1
                              </div>
                              <span
                                className={`mt-2 text-[11px] font-medium leading-snug ${
                                  isCurrent
                                    ? "text-sky-800 dark:text-sky-300"
                                    : "text-slate-600 dark:text-slate-400"
                                }`}
                                title={step.label}
                              >
                                {step.label}
                              </span>
                            </div>
                          </div>
                        );
                      }

                      return phaseSteps.map((step, index, arr) => {
                        const stepIndex = activeFlowSteps.findIndex(
                          (s) => s.id === step.id,
                        );
                        const isCurrent = step.id === currentStep.id;
                        const isCompleted =
                          currentGlobalIndex >= 0 &&
                          stepIndex >= 0 &&
                          stepIndex < currentGlobalIndex;

                        return (
                          <React.Fragment key={`${step.id}-${index}`}>
                            <div className="flex w-40 flex-col items-center justify-start">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shadow-sm ${
                                  isCurrent
                                    ? "bg-sky-600 text-white"
                                    : isCompleted
                                      ? "bg-emerald-500 text-white"
                                      : "bg-white text-slate-600 border border-slate-200 dark:bg-surface-500 dark:text-slate-300 dark:border-surface-300"
                                }`}
                              >
                                {index + 1}
                              </div>
                              <span
                                className={`mt-2 max-w-40 text-center text-[11px] font-medium leading-snug line-clamp-2 ${
                                  isCurrent
                                    ? "text-sky-800 dark:text-sky-300"
                                    : isCompleted
                                      ? "text-slate-700 dark:text-slate-300"
                                      : "text-slate-500 dark:text-slate-400"
                                }`}
                                title={step.label}
                              >
                                {step.label}
                              </span>
                            </div>
                            {index < arr.length - 1 && (
                              <div className="flex items-center px-1">
                                <div
                                  className={`h-1.5 w-10 rounded-full ${
                                    isCompleted
                                      ? "bg-emerald-400"
                                      : isCurrent
                                        ? "bg-sky-300 dark:bg-sky-800"
                                        : "bg-slate-200 dark:bg-surface-300"
                                  }`}
                                />
                                <svg
                                  viewBox="0 0 20 20"
                                  fill="currentColor"
                                  className={`ml-1 h-4 w-4 ${
                                    isCompleted
                                      ? "text-emerald-400"
                                      : isCurrent
                                        ? "text-sky-300 dark:text-sky-800"
                                        : "text-slate-300 dark:text-surface-300"
                                  }`}
                                  aria-hidden="true"
                                >
                                  <path d="M7.5 4.5 13 10l-5.5 5.5-1.4-1.4L10.2 10 6.1 5.9 7.5 4.5z" />
                                </svg>
                              </div>
                            )}
                          </React.Fragment>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};;

export default WorkflowProgressCard;
