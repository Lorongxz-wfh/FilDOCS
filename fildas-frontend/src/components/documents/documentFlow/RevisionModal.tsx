import React, { useState } from "react";
import Button from "../../ui/Button";
import { createRevision, type DocumentVersion } from "../../../services/documents";

interface RevisionModalProps {
  open: boolean;
  documentId: number;
  onClose: () => void;
  onRevised: (revised: DocumentVersion) => void;
}

const RevisionModal: React.FC<RevisionModalProps> = ({
  open,
  documentId,
  onClose,
  onRevised,
}) => {
  const [revisionReason, setRevisionReason] = useState("");
  const [isRevising, setIsRevising] = useState(false);

  if (!open) return null;

  const handleRevise = async () => {
    setIsRevising(true);
    try {
      const revised = await createRevision(documentId, {
        revision_reason: revisionReason.trim() || null,
      });
      setRevisionReason("");
      onRevised(revised);
    } catch (e: any) {
      alert(`Revision failed: ${e.message}`);
    } finally {
      setIsRevising(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-surface-400">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Start revision
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Optionally describe why this document is being revised.
          </p>
        </div>
        <div className="px-5 py-4">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5">
            Revision reason{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            className="w-full rounded-lg border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-500 px-3 py-2 text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
            rows={3}
            maxLength={1000}
            placeholder="e.g. Updated to reflect new compliance requirements…"
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
          />
          <p className="mt-1 text-right text-[10px] text-slate-400">
            {revisionReason.length}/1000
          </p>
        </div>
        <div className="px-5 py-3 border-t border-slate-100 dark:border-surface-400 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRevising}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            disabled={isRevising}
            onClick={handleRevise}
          >
            {isRevising ? "Creating…" : "Start revision"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default RevisionModal;
