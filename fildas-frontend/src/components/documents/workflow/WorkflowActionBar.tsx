import React from "react";
import { Loader2 } from "lucide-react";
import Button from "../../ui/Button";
import Modal from "../../ui/Modal";
import type { HeaderActionButton } from "./config/types";

type Props = {
  actions: HeaderActionButton[];
  isChangingStatus: boolean;
  canAct: boolean;
  adminDebugMode?: boolean;
  routingUsers?: any[];
  actingAsUserId?: number;
  setActingAsUserId?: (id: number | undefined) => void;
  isLoadingRoutingUsers?: boolean;
};

import { motion, AnimatePresence } from "framer-motion";

// Replaces window.prompt/confirm with proper modals
const WorkflowActionBar: React.FC<Props> = ({
  actions,
  isChangingStatus,
  canAct,
  adminDebugMode,
  routingUsers = [],
  actingAsUserId,
  setActingAsUserId,
  isLoadingRoutingUsers,
}) => {
  const [confirmAction, setConfirmAction] =
    React.useState<HeaderActionButton | null>(null);
  const [rejectNote, setRejectNote] = React.useState("");
  const [rejectError, setRejectError] = React.useState("");
  const [processingKey, setProcessingKey] = React.useState<string | null>(null);

  if (!actions.length) return null;

  const handleClick = async (action: HeaderActionButton) => {
    if (isChangingStatus || !canAct) return;

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
    <div className="space-y-3">
      {adminDebugMode && routingUsers.length > 0 && (
        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-brand-200 bg-brand-50/50 dark:border-brand-900/30 dark:bg-brand-900/10">
          <div className="flex flex-col">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
              Dev Mode Impersonation
            </label>
            <div className="flex items-center gap-2 mt-1">
              <select
                disabled={isChangingStatus || isLoadingRoutingUsers}
                value={actingAsUserId ?? ""}
                onChange={(e) => setActingAsUserId?.(e.target.value ? Number(e.target.value) : undefined)}
                className="h-8 pr-8 pl-2.5 text-xs rounded-md border border-brand-200 bg-white text-slate-700 outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200"
              >
                <option value="">Acting as: Yourself (Admin)</option>
                {routingUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.office?.code ?? u.role?.name ?? "User"})
                  </option>
                ))}
              </select>
              {isLoadingRoutingUsers && <Loader2 className="animate-spin h-3.5 w-3.5 text-brand-500" />}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <AnimatePresence mode="popLayout">
          {actions.map((a) => {
            const isThis = processingKey === a.key;
            const isBusy = isChangingStatus || !!processingKey;
            return (
              <motion.div
                key={a.key}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
              >
                <Button
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
                      <Loader2 className="animate-spin h-3 w-3" />
                      Processing…
                    </span>
                  ) : (
                    a.label
                  )}
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
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
    </div>
  );
};

export default WorkflowActionBar;
