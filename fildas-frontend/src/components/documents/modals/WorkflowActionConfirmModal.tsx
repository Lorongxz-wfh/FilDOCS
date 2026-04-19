import React, { useState, useEffect } from "react";
import { User, Loader2 } from "lucide-react";
import Button from "../../ui/Button";

export interface ConfirmAction {
  key: string;
  label: string;
  variant: "primary" | "danger" | "outline";
  skipConfirm?: boolean;
  confirmMessage?: string;
  onClick: (note?: string) => Promise<void> | void;
}

interface WorkflowActionConfirmModalProps {
  action: ConfirmAction | null;
  processingKey: string | null;
  onClose: () => void;
  onConfirm: (note?: string) => void;

  // Impersonation
  adminDebugMode?: boolean;
  routingUsers?: any[];
  actingAsUserId?: number;
  setActingAsUserId?: (id: number | undefined) => void;
  isLoadingRoutingUsers?: boolean;
}

const WorkflowActionConfirmModal: React.FC<WorkflowActionConfirmModalProps> = ({
  action,
  processingKey,
  onClose,
  onConfirm,
  adminDebugMode,
  routingUsers = [],
  actingAsUserId,
  setActingAsUserId,
  isLoadingRoutingUsers,
}) => {
  const [rejectNote, setRejectNote] = useState("");
  const [rejectError, setRejectError] = useState("");

  // Reset note/error each time a new action is opened
  useEffect(() => {
    if (action) {
      setRejectNote("");
      setRejectError("");
    }
  }, [action?.key]);

  if (!action) return null;

  const needsNote =
    action.key === "REJECT" || action.key === "CANCEL_DOCUMENT";

  const handleConfirm = () => {
    if (needsNote && !rejectNote.trim()) {
      setRejectError(
        action.key === "CANCEL_DOCUMENT"
          ? "A reason is required when cancelling."
          : "A note is required when rejecting.",
      );
      return;
    }
    onConfirm(needsNote ? rejectNote : undefined);
  };

  const title =
    action.key === "REJECT"
      ? "Reject document"
      : action.key === "CANCEL_DOCUMENT"
        ? "Cancel document"
        : action.label;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {title}
        </h2>

        {adminDebugMode && (
          <div className="mb-6 p-3 rounded-lg border border-brand-200 bg-brand-50/30 dark:border-brand-900/40 dark:bg-brand-900/10">
            <div className="flex items-center gap-2 mb-2.5">
              <User className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-400">
                Dev Mode: Act as participant
              </span>
            </div>
            
            <div className="relative">
              <select
                disabled={!!processingKey || isLoadingRoutingUsers}
                value={actingAsUserId ?? ""}
                onChange={(e) => setActingAsUserId?.(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full h-9 pl-3 pr-10 text-xs font-medium rounded-md border border-brand-200 bg-white dark:bg-surface-600 text-slate-700 dark:text-slate-100 outline-none focus:ring-1 focus:ring-brand-500 transition-all disabled:opacity-50 appearance-none cursor-pointer"
              >
                <option value=""> Yourself (Admin Account)</option>
                {routingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} — {u.office?.code || u.role?.name || "Participant"}
                  </option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                {isLoadingRoutingUsers ? (
                  <Loader2 className="animate-spin h-3.5 w-3.5 text-brand-500" />
                ) : (
                  <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </div>
            </div>
            <p className="mt-2 text-[10px] text-slate-500 dark:text-slate-400 italic">
              * Choosing a user will attribute this action to them in the activity logs.
            </p>
          </div>
        )}

        {needsNote ? (
          <div className="mb-4">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              {action.key === "CANCEL_DOCUMENT"
                ? "Cancellation reason"
                : "Rejection note"}
              <span className="text-rose-500 ml-0.5">*</span>
            </label>
            <textarea
              rows={3}
              value={rejectNote}
              onChange={(e) => {
                setRejectNote(e.target.value);
                setRejectError("");
              }}
              placeholder={
                action.key === "CANCEL_DOCUMENT"
                  ? "Explain why this document is being cancelled…"
                  : "Explain why this document is being rejected…"
              }
              className="block w-full rounded-md border border-slate-300 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-rose-400 transition"
            />
            {rejectError && (
              <p className="mt-1 text-xs text-rose-600">{rejectError}</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-700 dark:text-slate-300 mb-4">
            {action.confirmMessage ?? "Please confirm to proceed."}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={!!processingKey}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={action.key === "REJECT" || action.key === "CANCEL_DOCUMENT" ? "danger" : "primary"}
            size="sm"
            disabled={!!processingKey}
            onClick={handleConfirm}
          >
            {processingKey ? (
              <span className="flex items-center gap-1.5">
                <svg
                  className="animate-spin h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
                Processing…
              </span>
            ) : action.key === "REJECT" ? (
              "Reject"
            ) : action.key === "CANCEL_DOCUMENT" ? (
              "Confirm cancellation"
            ) : (
              action.label
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowActionConfirmModal;
