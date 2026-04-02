import React from "react";
import { Loader2 } from "lucide-react";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import type { HeaderActionButton } from "./types";

type Props = {
  actions: HeaderActionButton[];
  isChangingStatus: boolean;
  canAct: boolean;
};

// Replaces window.prompt/confirm with proper modals
const WorkflowActionBar: React.FC<Props> = ({
  actions,
  isChangingStatus,
  canAct,
}) => {
  const [confirmAction, setConfirmAction] =
    React.useState<HeaderActionButton | null>(null);
  const [rejectNote, setRejectNote] = React.useState("");
  const [rejectError, setRejectError] = React.useState("");
  const [processingKey, setProcessingKey] = React.useState<string | null>(null);

  if (!actions.length) return null;

  const handleClick = async (action: HeaderActionButton) => {
    const bypassCanAct = action.key === "CANCEL_DOCUMENT";
    if (isChangingStatus || (!bypassCanAct && !canAct)) return;

    if (action.skipConfirm) {
      setProcessingKey(action.key);
      try { await action.onClick(); }
      finally { setProcessingKey(null); }
      return;
    }

    setRejectNote("");
    setRejectError("");
    setConfirmAction(action);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    if (
      (confirmAction.key === "REJECT" ||
        confirmAction.key === "CANCEL_DOCUMENT") &&
      !rejectNote.trim()
    ) {
      setRejectError(
        confirmAction.key === "CANCEL_DOCUMENT"
          ? "A reason is required when cancelling."
          : "A note is required when rejecting.",
      );
      return;
    }

    setProcessingKey(confirmAction.key);
    try {
      await confirmAction.onClick();
    } finally {
      setProcessingKey(null);
      setConfirmAction(null);
    }
  };

  const isReject = confirmAction?.key === "REJECT";
  const isCancel = confirmAction?.key === "CANCEL_DOCUMENT";
  const needsNote = isReject || isCancel;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const isThis = processingKey === a.key;
          const isBusy = isChangingStatus || !!processingKey;
          return (
            <Button
              key={a.key}
              type="button"
              size="sm"
              variant={a.variant === "danger" ? "danger" : "primary"}
              disabled={isBusy || (a.key !== "CANCEL_DOCUMENT" && !canAct)}
              onClick={() => handleClick(a)}
              className={
                (a.key !== "CANCEL_DOCUMENT" && !canAct) && !isBusy ? "opacity-40 cursor-not-allowed" : ""
              }
            >
              {isThis ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="animate-spin h-3 w-3" />
                  Processing…
                </span>
              ) : (
                a.label
              )}
            </Button>
          );
        })}
      </div>

      {/* Confirm / Reject modal */}
      <Modal
        open={!!confirmAction}
        title={
          isReject
            ? "Reject document"
            : isCancel
              ? "Cancel document"
              : confirmAction?.label ?? "Confirm"
        }
        onClose={() => setConfirmAction(null)}
        widthClassName="max-w-md"
      >
        <div className="space-y-4">
          {needsNote ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                {isCancel ? "Cancellation reason" : "Rejection note"}
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
                  isCancel
                    ? "Explain why this document is being cancelled…"
                    : "Explain why this document is being rejected…"
                }
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-400 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-200"
              />
              {rejectError && (
                <p className="mt-1 text-xs text-rose-600">{rejectError}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {confirmAction?.confirmMessage ??
                `Are you sure you want to ${confirmAction?.label}? This action cannot be undone.`}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmAction(null)}
              disabled={isChangingStatus}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={isReject || isCancel ? "danger" : "primary"}
              size="sm"
              disabled={isChangingStatus}
              onClick={handleConfirm}
            >
              {isChangingStatus
                ? "Processing…"
                : isReject
                  ? "Reject"
                  : isCancel
                    ? "Confirm cancellation"
                    : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default WorkflowActionBar;
