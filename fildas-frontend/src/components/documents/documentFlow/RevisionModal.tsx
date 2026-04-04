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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-xl p-6">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">
          Start revision
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
          Optionally describe why this document is being revised.
        </p>

        <div className="mb-4">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
            Revision reason{" "}
            <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            rows={3}
            maxLength={1000}
            placeholder="e.g. Updated to reflect new compliance requirements…"
            value={revisionReason}
            onChange={(e) => setRevisionReason(e.target.value)}
            className="block w-full rounded-md border border-slate-300 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-brand-400 dark:focus:border-brand-300 resize-none transition"
          />
          <p className="mt-1 text-right text-xs text-slate-400">
            {revisionReason.length}/1000
          </p>
        </div>

        <div className="flex justify-end gap-2">
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
            loading={isRevising}
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
