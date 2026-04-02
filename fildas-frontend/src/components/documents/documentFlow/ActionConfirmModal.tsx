import React, { useState, useEffect } from "react";
import Button from "../../ui/Button";

export interface ConfirmAction {
  key: string;
  label: string;
  variant: "primary" | "danger" | "outline";
  skipConfirm?: boolean;
  confirmMessage?: string;
  onClick: (note?: string) => Promise<void> | void;
}

interface ActionConfirmModalProps {
  action: ConfirmAction | null;
  processingKey: string | null;
  onClose: () => void;
  onConfirm: (note?: string) => void;
}

const ActionConfirmModal: React.FC<ActionConfirmModalProps> = ({
  action,
  processingKey,
  onClose,
  onConfirm,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
          {title}
        </h2>

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

export default ActionConfirmModal;
