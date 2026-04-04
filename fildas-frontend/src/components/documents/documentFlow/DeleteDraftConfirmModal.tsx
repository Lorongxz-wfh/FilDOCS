import React from "react";

type Props = {
  pendingDelete: "draft" | "revision";
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

const DeleteDraftConfirmModal: React.FC<Props> = ({
  pendingDelete,
  isDeleting,
  onCancel,
  onConfirm,
}) => {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 shadow-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
          {pendingDelete === "draft" ? "Delete draft?" : "Cancel revision?"}
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
          {pendingDelete === "draft"
            ? "This will permanently remove the document draft. This cannot be undone."
            : "This will delete the revision draft and return to the last official version."}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={isDeleting}
            onClick={onCancel}
            className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
            className="rounded-md bg-rose-500 hover:bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {isDeleting && (
              <span className="h-3 w-3 rounded-full border-2 border-white border-t-transparent animate-spin" />
            )}
            {pendingDelete === "draft" ? "Delete" : "Cancel revision"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteDraftConfirmModal;
