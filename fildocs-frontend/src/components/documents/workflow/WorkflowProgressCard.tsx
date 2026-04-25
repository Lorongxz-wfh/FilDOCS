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
    // In FilDOCS, they should match for custom routing or the standard ones
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
        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
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
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold  transition-all duration-300 ${stepIsCurrent
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
                        ? "text-slate-900 dark:text-slate-100 font-semibold"
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
    <div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 overflow-hidden shadow-sm">
      {/* ── Header bar — always visible, click to toggle ── */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="group w-full text-left px-4 py-3 transition hover:bg-slate-50/50 dark:hover:bg-surface-400/20"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  Workflow Progress
                </p>
                <span
                  className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${routeStepsCount > 0
                    ? "bg-brand-50 text-brand-600 border border-brand-100 dark:bg-brand-500/10 dark:text-brand-400 dark:border-brand-900/30"
                    : "bg-slate-50 text-slate-500 border border-slate-200 dark:bg-surface-400/50 dark:text-slate-300 dark:border-surface-300/30"
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

            <div className="mt-3 flex items-center gap-3">
              <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-surface-400 overflow-hidden border border-slate-200/50 dark:border-surface-300/10">
                {!isTasksReady ? (
                  <div className="h-full w-1/3 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                ) : (
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPct}%` }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
                    className="h-full rounded-full bg-brand-500 shadow-[0_0_8px_rgba(var(--brand-500-rgb),0.3)]"
                  />
                )}
              </div>
              {!isTasksReady ? (
                <div className="h-3 w-16 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse shrink-0" />
              ) : (
                <div className="shrink-0 flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    {currentPhase.label}
                  </span>
                  <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 tabular-nums">
                    {progressPct}%
                  </span>
                </div>
              )}
            </div>

            <div className={`grid transition-all duration-300 ease-in-out ${!expanded ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0 overflow-hidden"}`}>
              <div className="min-h-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {isTasksReady ? (
                      <>
                        <span className="uppercase tracking-widest text-[9px] font-bold mr-1.5">Current:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{currentStep.label}</span>
                      </>
                    ) : (
                      <Skeleton className="h-3 w-40" />
                    )}
                  </div>
                  {isTasksReady && nextStep && (
                    <div className="shrink-0 text-right text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="uppercase tracking-widest text-[9px] font-bold mr-1.5">Next:</span>
                      <span className="font-bold text-slate-700 dark:text-slate-300">{nextStep.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </button>

      <div className={`grid transition-all duration-300 ease-in-out ${expanded ? "grid-rows-[1fr] opacity-100 border-t border-slate-100 dark:border-surface-400/50" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">

          {/* ══════════════════════════════════════════════
              MOBILE LAYOUT — accordion phases (< md)
          ══════════════════════════════════════════════ */}
          <div className="md:hidden px-4 pb-4">
            <div className="pt-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current Step</p>
                {!isTasksReady ? (
                  <Skeleton className="mt-1 h-5 w-48" />
                ) : (
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {currentStep.label}
                  </p>
                )}
              </div>
              {isTasksReady && nextStep && (
                <div className="text-right shrink-0 max-w-[45%]">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next</p>
                  <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                    {nextStep.label}
                  </p>
                </div>
              )}
            </div>

            {/* Phase accordion */}
            <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 dark:border-surface-400 divide-y divide-slate-200 dark:divide-surface-400 shadow-sm">
              {!isTasksReady
                ? phases.map((_, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-3 py-3">
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
                        className="w-full flex items-center gap-2.5 px-3 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-surface-400/30"
                      >
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${isCurrent
                              ? "bg-brand-500 shadow-[0_0_6px_rgba(var(--brand-500-rgb),0.4)]"
                              : isCompleted
                                ? "bg-emerald-500"
                                : "bg-slate-200 dark:bg-surface-300"
                            }`}
                        />
                        <span
                          className={`flex-1 min-w-0 text-[11px] font-bold uppercase tracking-wider ${isCurrent
                              ? "text-slate-900 dark:text-slate-100"
                              : isCompleted
                                ? "text-slate-600 dark:text-slate-300"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                        >
                          {phase.label}
                        </span>
                        {isCurrent && (
                          <Circle
                            className="shrink-0 h-3.5 w-3.5 text-brand-500 animate-pulse"
                            strokeWidth={3}
                          />
                        )}
                        {!isCurrent && isCompleted && (
                          <CheckCircle2
                            className="shrink-0 h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 fill-emerald-50 dark:fill-emerald-950/20"
                            strokeWidth={2.5}
                          />
                        )}
                        {!isCurrent && !isCompleted && (
                          <Circle
                            className="shrink-0 h-3.5 w-3.5 text-slate-300 dark:text-surface-300"
                            strokeWidth={2}
                          />
                        )}
                        <svg
                          className={`shrink-0 h-3 w-3 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={3}
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
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
                            className="border-t border-slate-100 dark:border-surface-400/50 bg-slate-50/30 dark:bg-surface-600/20 px-3 py-4 overflow-hidden"
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
          <div className="hidden md:block px-6 pb-6">
            <div className="pt-5 flex items-start justify-between gap-6">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Current step</p>
                {!isTasksReady ? (
                  <Skeleton className="mt-1 h-5 w-52" />
                ) : (
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">
                    {currentStep.label}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 min-w-55">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Next step</p>
                {!isTasksReady ? (
                  <Skeleton className="mt-1 h-3 w-20 ml-auto" />
                ) : nextStep ? (
                  <p className="mt-1 text-xs font-bold text-slate-800 dark:text-slate-200 text-right whitespace-nowrap">
                    {nextStep.label}
                  </p>
                ) : (
                  <p className="mt-1 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">—</p>
                )}
              </div>
            </div>

            {/* Phase rail */}
            {!isTasksReady ? (
              <div className="mt-4 flex items-center gap-2">
                {phases.map((_, i) => (
                  <React.Fragment key={i}>
                    <div className="flex-1 min-w-0 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/50 px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-slate-200 dark:bg-surface-300 shrink-0" />
                        <div className="h-3 w-full rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                      </div>
                    </div>
                    {i < phases.length - 1 && (
                      <div className="h-3 w-3 rounded bg-slate-200 dark:bg-surface-300 shrink-0 animate-pulse" />
                    )}
                  </React.Fragment>
                ))}
              </div>
            ) : (
              <div className="mt-5 flex items-stretch gap-2">
                {phases.map((phase, index) => {
                  const isCurrent = index === currentPhaseIndex;
                  const isCompleted = index < currentPhaseIndex;
                  const isSelected = selectedPhaseId === phase.id;

                  return (
                    <React.Fragment key={phase.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedPhaseId(phase.id)}
                        className={`flex-1 min-w-0 rounded-lg border px-3 py-2.5 text-left transition-all duration-400 cursor-pointer ${isCurrent
                            ? "border-brand-500/30 bg-brand-50 dark:border-brand-500/20 dark:bg-brand-500/10 shadow-[0_2px_8px_rgba(var(--brand-500-rgb),0.05)]"
                            : isSelected
                              ? "border-slate-400 bg-slate-100/50 dark:border-slate-400 dark:bg-surface-400/40"
                              : isCompleted
                                ? "border-slate-200 bg-slate-50/40 dark:border-surface-400/50 dark:bg-surface-600/30 hover:border-slate-300 dark:hover:border-slate-300"
                                : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600 hover:border-slate-300 dark:hover:border-slate-300"
                          }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`h-2 w-2 shrink-0 rounded-full transition-colors duration-500 ${isCurrent
                                  ? "bg-brand-500 shadow-[0_0_6px_rgba(var(--brand-500-rgb),0.4)]"
                                  : isCompleted
                                    ? "bg-slate-400 dark:bg-slate-500"
                                    : "bg-slate-200 dark:bg-surface-300"
                                }`}
                            />
                            <span
                              className={`text-[10px] font-bold uppercase tracking-widest truncate transition-colors duration-500 ${isCurrent
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
                              className="shrink-0 h-3 w-3 text-brand-500 animate-pulse"
                              strokeWidth={4}
                            />
                          )}
                          {!isCurrent && isCompleted && (
                            <CheckCircle2
                              className="shrink-0 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                              strokeWidth={2.5}
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
                                  ? "text-brand-300 dark:text-brand-700"
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
              <div className="mt-4 rounded-lg border border-slate-200/60 dark:border-surface-400/40 bg-slate-50/20 dark:bg-surface-600/10 p-4">
                <div className="flex justify-center items-center gap-6 py-2">
                  {[1, 2, 3].map((i) => (
                    <React.Fragment key={i}>
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                        <div className="h-3 w-20 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                      </div>
                      {i < 3 && (
                        <div className="flex items-center gap-1 mb-7">
                          <div className="h-1.5 w-12 rounded-full bg-slate-200 dark:bg-surface-300 animate-pulse" />
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/10 p-4">
                <p className="text-center text-[9px] font-bold mb-4 uppercase tracking-[0.25em] text-slate-400 dark:text-slate-500">
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
