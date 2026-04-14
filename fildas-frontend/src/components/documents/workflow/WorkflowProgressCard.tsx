import React from "react";
import { CheckCircle2, Circle, Clock, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import Skeleton from "../../ui/loader/Skeleton";
import Tooltip from "../../ui/Tooltip";
import type { FlowStep, Phase, PhaseId } from "./config/flowConfig";
import type { WorkflowTask } from "../../../services/documents";
import { formatDateTime } from "../../../utils/formatters";

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
  tasks,
}) => {
  const currentPhase = phases.find((p) => p.id === currentPhaseId) ?? phases[0];

  const totalSteps = Math.max(activeFlowSteps.length, 1);
  const completedSteps =
    currentPhaseId === "completed"
      ? totalSteps
      : Math.max(0, currentGlobalIndex);
  const progressPct = Math.min(
    100,
    Math.round((completedSteps / totalSteps) * 100),
  );

  // Collapsed by default on mobile, expanded on desktop
  const [expanded, setExpanded] = React.useState(() => {
    if (typeof window !== "undefined") return window.innerWidth >= 1024;
    return true;
  });

  // Mobile accordion: which phase is open (defaults to current phase)
  const [openPhaseId, setOpenPhaseId] = React.useState<PhaseId | null>(currentPhaseId);
  React.useEffect(() => {
    setOpenPhaseId(currentPhaseId);
  }, [currentPhaseId]);

  // Desktop: which phase's steps are shown (defaults to current, user can click to preview others)
  const [selectedPhaseId, setSelectedPhaseId] = React.useState<PhaseId>(currentPhaseId);
  React.useEffect(() => {
    setSelectedPhaseId(currentPhaseId);
  }, [currentPhaseId]);

  const getStepCompletionInfo = (stepId: string) => {
    if (!tasks || tasks.length === 0) return null;

    // Map flowConfig step ID to backend task step name if needed
    // In FilDAS, they should match for custom routing or the standard ones
    // We'll look for a completed task that matches this step
    const task = tasks.find(t => {
      if (t.status !== 'completed') return false;

      // Exact match (normal steps)
      if (t.step === stepId) return true;

      // Custom routing steps: stepId is "custom_review_office:ID"
      if (stepId.includes('custom_review_office') && t.step === 'custom_review_office') {
        return Number(t.assigned_office_id) === Number(stepId.split(':')[1]);
      }
      if (stepId.includes('custom_approval_office') && t.step === 'custom_approval_office') {
        return Number(t.assigned_office_id) === Number(stepId.split(':')[1]);
      }

      return false;
    });

    if (!task || !task.completed_at) return null;

    return (
      <div className="space-y-1.5 min-w-[140px]">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <CheckCircle2 className="h-3 w-3" />
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-300">
          <Clock className="h-3 w-3" />
          <span>{formatDateTime(task.completed_at)}</span>
        </div>
        {/* If we had the user name in the task object, we'd show it here */}
        {/* Fallback to 'System' or actor from elsewhere if possible */}
      </div>
    );
  };

  // ── Shared step renderer (used by both desktop steps timeline and mobile accordion body) ──
  const renderStepBubbles = (phaseSteps: FlowStep[]) => {
    if (phaseSteps.length === 0) {
      return (
        <p className="text-center text-xs text-slate-400 dark:text-slate-500 py-1">
          No steps
        </p>
      );
    }

    return (
      <motion.div 
        key={selectedPhaseId}
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="overflow-x-auto -mx-1 px-1"
      >
        <div className="flex w-max items-start gap-2 mx-auto min-h-[64px] py-2">
          {phaseSteps.map((step, si, arr) => {
            const stepIndex = activeFlowSteps.findIndex((s) => s.id === step.id);
            const stepIsCurrent = step.id === currentStep.id;
            const completionInfo = getStepCompletionInfo(step.id);
            const stepIsCompleted =
              currentGlobalIndex >= 0 && stepIndex >= 0 && stepIndex < currentGlobalIndex;

            return (
              <React.Fragment key={`${step.id}-${si}`}>
                <div className="flex flex-col items-center" style={{ width: "80px" }}>
                  <Tooltip content={completionInfo}>
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold shadow-sm transition-all duration-300 ${stepIsCurrent
                          ? "bg-sky-600 text-white ring-2 ring-sky-100 dark:ring-sky-900/30"
                          : completionInfo || stepIsCompleted
                            ? "bg-emerald-500 text-white cursor-help"
                            : "bg-white text-slate-600 border border-slate-200 dark:bg-surface-500 dark:text-slate-300 dark:border-surface-300"
                        }`}
                    >
                      {si + 1}
                    </motion.div>
                  </Tooltip>
                  <span
                    className={`mt-1.5 text-center text-[10px] font-medium leading-tight line-clamp-2 transition-colors duration-300 ${stepIsCurrent
                        ? "text-slate-900 dark:text-slate-100 font-bold"
                        : stepIsCompleted
                          ? "text-slate-700 dark:text-slate-300"
                          : "text-slate-400 dark:text-slate-500"
                      }`}
                    title={step.label}
                  >
                    {step.label}
                  </span>
                </div>
                {si < arr.length - 1 && (
                  <div className="flex items-center mt-3.5 shrink-0">
                    <div
                      className={`h-1 w-5 rounded-full transition-colors duration-500 ${stepIsCompleted || !!completionInfo
                          ? "bg-emerald-400"
                          : stepIsCurrent
                            ? "bg-sky-400 dark:bg-sky-700"
                            : "bg-slate-200 dark:bg-surface-300"
                        }`}
                    />
                    <svg
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`ml-0.5 h-3 w-3 transition-colors duration-500 ${stepIsCompleted || !!completionInfo
                          ? "text-emerald-400"
                          : stepIsCurrent
                            ? "text-sky-400 dark:bg-sky-700"
                            : "text-slate-300 dark:text-surface-300"
                        }`}
                    >
                      <path d="M7.5 4.5 13 10l-5.5 5.5-1.4-1.4L10.2 10 6.1 5.9 7.5 4.5z" />
                    </svg>
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden shadow-sm shadow-slate-200/50 dark:shadow-none">
      {/* ── Header bar — always visible, click to toggle ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group w-full text-left px-4 py-2.5 transition hover:bg-slate-50/80 dark:hover:bg-surface-400/40"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                  Workflow progress
                </p>
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${routeStepsCount > 0
                    ? "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-300"
                    : "bg-slate-50 text-slate-600 border border-slate-200 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-300"
                  }`}
                >
                  {routeStepsCount > 0 ? "Custom" : "Default"}
                </span>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-300 ${expanded ? "rotate-0" : "rotate-180"}`} 
              />
            </div>

            <div className="mt-2 flex items-center gap-3">
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden">
                {!isTasksReady ? (
                  <div className="h-full w-1/3 rounded-full bg-slate-300 dark:bg-surface-300 animate-pulse" />
                ) : (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: "circOut" }}
                    className="h-full rounded-full bg-sky-600"
                  />
                )}
              </div>
              {!isTasksReady ? (
                <div className="h-3 w-16 rounded-full bg-slate-300 dark:bg-surface-300 animate-pulse shrink-0" />
              ) : (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                    {currentPhase.label}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {progressPct}%
                  </span>
                </div>
              )}
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${!expanded ? "grid-rows-[1fr] opacity-100 mt-1" : "grid-rows-[0fr] opacity-0 overflow-hidden"}`}>
              <div className="min-h-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {isTasksReady ? (
                      <>
                        Current: <span className="font-medium text-slate-800 dark:text-slate-200">{currentStep.label}</span>
                      </>
                    ) : (
                      <Skeleton className="h-3 w-40" />
                    )}
                  </div>
                  {isTasksReady && nextStep && (
                    <div className="shrink-0 text-right text-xs text-slate-500 dark:text-slate-400">
                      Next: <span className="font-medium text-slate-700 dark:text-slate-300">{nextStep.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${expanded ? "grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-surface-400" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">

          {/* ══════════════════════════════════════════════
              MOBILE LAYOUT — accordion phases (< md)
          ══════════════════════════════════════════════ */}
          <div className="md:hidden px-4 pb-4">
            <div className="pt-3 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Current step</p>
                {!isTasksReady ? (
                  <Skeleton className="mt-1 h-5 w-48" />
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {currentStep.label}
                  </p>
                )}
              </div>
              {isTasksReady && nextStep && (
                <div className="text-right shrink-0 max-w-[45%]">
                  <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Next</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                    {nextStep.label}
                  </p>
                </div>
              )}
            </div>

            {/* Phase accordion */}
            <div className="mt-3 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 divide-y divide-slate-200 dark:divide-surface-400">
              {!isTasksReady
                ? phases.map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                    <div className="h-2 w-2 shrink-0 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                    <div className="h-2.5 flex-1 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                    <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-slate-100 dark:bg-surface-400 animate-pulse" />
                  </div>
                ))
                : phases.map((phase, index) => {
                  const isCurrent = index === currentPhaseIndex;
                  const isCompleted = index < currentPhaseIndex;
                  const isOpen = openPhaseId === phase.id;
                  const phaseSteps = activeFlowSteps.filter((s) => s.phase === phase.id);

                  return (
                    <div key={phase.id}>
                      <button
                        type="button"
                        onClick={() => setOpenPhaseId(isOpen ? null : phase.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-surface-400/50"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${isCurrent
                              ? "bg-sky-600 dark:bg-sky-300"
                              : isCompleted
                                ? "bg-emerald-500"
                                : "bg-slate-300 dark:bg-surface-300"
                            }`}
                        />
                        <span
                          className={`flex-1 min-w-0 text-xs font-semibold ${isCurrent
                              ? "text-slate-900 dark:text-slate-100 font-semibold"
                              : isCompleted
                                ? "text-slate-600 dark:text-slate-300"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                        >
                          {phase.label}
                        </span>
                        {isCurrent && (
                          <Circle
                            className="shrink-0 h-3.5 w-3.5 text-sky-600 dark:text-sky-300 animate-pulse"
                            strokeWidth={2}
                          />
                        )}
                        {!isCurrent && isCompleted && (
                          <CheckCircle2
                            className="shrink-0 h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950/40"
                            strokeWidth={2}
                          />
                        )}
                        {!isCurrent && !isCompleted && (
                          <Circle
                            className="shrink-0 h-3.5 w-3.5 text-slate-300 dark:text-surface-300"
                            strokeWidth={2}
                          />
                        )}
                        <svg
                          className={`shrink-0 h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      <AnimatePresence>
                        {isOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="border-t border-slate-100 dark:border-surface-400 bg-slate-50/60 dark:bg-surface-600/50 px-3 py-3 overflow-hidden"
                          >
                            {renderStepBubbles(phaseSteps)}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              DESKTOP LAYOUT — horizontal phase rail + steps (md+)
          ══════════════════════════════════════════════ */}
          <div className="hidden md:block px-4 pb-4">
            <div className="pt-3 flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Current step</p>
                {!isTasksReady ? (
                  <Skeleton className="mt-1 h-5 w-52" />
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {currentStep.label}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 min-w-55">
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">Next step</p>
                {!isTasksReady ? (
                  <Skeleton className="mt-1 h-3 w-20 ml-auto" />
                ) : nextStep ? (
                  <p className="mt-0.5 text-xs font-semibold text-slate-900 dark:text-slate-100 text-right whitespace-nowrap">
                    {nextStep.label}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">—</p>
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
              <div className="mt-4 flex items-stretch gap-1.5">
                {phases.map((phase, index) => {
                  const isCurrent = index === currentPhaseIndex;
                  const isCompleted = index < currentPhaseIndex;
                  const isSelected = selectedPhaseId === phase.id;

                  return (
                    <React.Fragment key={phase.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPhaseId(phase.id)}
                        className={`flex-1 min-w-0 rounded-lg border px-3 py-2 text-left transition-all duration-300 cursor-pointer ${isCurrent
                            ? "border-sky-600/50 bg-sky-50 dark:border-sky-600/40 dark:bg-sky-500/10 shadow-sm shadow-sky-600/10"
                            : isSelected
                              ? "border-slate-400 bg-slate-100 dark:border-slate-400 dark:bg-surface-400/60"
                              : isCompleted
                                ? "border-slate-200 bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600 hover:border-slate-300 dark:hover:border-slate-300"
                                : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 hover:border-slate-300 dark:hover:border-slate-300"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-500 ${isCurrent
                                  ? "bg-sky-600 dark:bg-sky-300"
                                  : isCompleted
                                    ? "bg-slate-400 dark:bg-slate-500"
                                    : "bg-slate-300 dark:bg-surface-300"
                                }`}
                            />
                            <span
                              className={`text-xs font-bold truncate transition-colors duration-500 ${isCurrent
                                  ? "text-slate-900 dark:text-slate-100"
                                  : isCompleted
                                    ? "text-slate-600 dark:text-slate-200"
                                    : "text-slate-500 dark:text-slate-400"
                                }`}
                              title={phase.label}
                            >
                              {phase.label}
                            </span>
                          </div>
                          {isCurrent && (
                            <Circle
                              className="shrink-0 h-3.5 w-3.5 text-sky-600 dark:text-sky-300 animate-pulse"
                              strokeWidth={2.5}
                            />
                          )}
                          {!isCurrent && isCompleted && (
                            <CheckCircle2
                              className="shrink-0 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                              strokeWidth={2}
                            />
                          )}
                        </div>
                      </button>

                      {index < phases.length - 1 && (
                        <div className="flex items-center shrink-0">
                          <svg
                            className={`h-3 w-3 ${isCompleted
                                ? "text-slate-300 dark:text-slate-600"
                                : isCurrent
                                  ? "text-sky-300 dark:text-sky-400"
                                  : "text-slate-200 dark:text-surface-300"
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
                <div className="flex justify-center items-center gap-6 py-2">
                  {[1, 2, 3].map((i) => (
                    <React.Fragment key={i}>
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                        <div className="h-2.5 w-20 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                      </div>
                      {i < 3 && (
                        <div className="flex items-center gap-1 mb-6">
                          <div className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/40 p-3 dark:border-surface-400 dark:bg-surface-600/40">
                <p className="text-center text-[10px] font-bold mb-2 uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  {selectedPhaseId === currentPhaseId
                    ? "Current Steps"
                    : `${phases.find((p) => p.id === selectedPhaseId)?.label} steps`}
                </p>
                {renderStepBubbles(
                  activeFlowSteps.filter((s) => s.phase === selectedPhaseId),
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowProgressCard;
