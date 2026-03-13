import React from "react";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import type { HeaderActionButton } from "../DocumentFlow";

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

  const handleClick = (action: HeaderActionButton) => {
    if (!canAct || isChangingStatus) return;
    setRejectNote("");
    setRejectError("");
    setConfirmAction(action);
  };

  const handleConfirm = async () => {
    if (!confirmAction) return;

    if (confirmAction.key === "REJECT" && !rejectNote.trim()) {
      setRejectError("A note is required when rejecting.");
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
              disabled={isBusy || !canAct}
              onClick={() => handleClick(a)}
              className={
                !canAct && !isBusy ? "opacity-40 cursor-not-allowed" : ""
              }
            >
              {isThis ? (
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
          isReject ? "Reject document" : `Confirm: ${confirmAction?.label}`
        }
        onClose={() => setConfirmAction(null)}
        widthClassName="max-w-md"
      >
        <div className="space-y-4">
          {isReject ? (
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Rejection note <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectNote}
                onChange={(e) => {
                  setRejectNote(e.target.value);
                  setRejectError("");
                }}
                placeholder="Explain why this document is being rejected…"
                className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-100 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-200"
              />
              {rejectError && (
                <p className="mt-1 text-xs text-rose-600">{rejectError}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Are you sure you want to{" "}
              <span className="font-semibold">{confirmAction?.label}</span>?
              This action cannot be undone.
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
              variant={isReject ? "danger" : "primary"}
              size="sm"
              disabled={isChangingStatus}
              onClick={handleConfirm}
            >
              {isChangingStatus
                ? "Processing…"
                : isReject
                  ? "Reject"
                  : "Confirm"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};

export default WorkflowActionBar;
