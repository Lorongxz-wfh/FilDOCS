import React, { useState, useEffect } from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { Users, Info } from "lucide-react";
import OfficeCheckList from "../../ui/OfficeCheckList";
import type { Office } from "../../../services/documents";

interface WorkflowDistributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (officeIds: number[]) => void;
  offices: Office[];
  participantOfficeIds: number[];
  ownerOfficeId: number | null;
  isProcessing?: boolean;
}

export const WorkflowDistributeModal: React.FC<WorkflowDistributeModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  offices,
  participantOfficeIds,
  ownerOfficeId,
  isProcessing = false,
}) => {
  // Filter out the owner office from selection options
  const selectableOffices = offices.filter(o => o.id !== ownerOfficeId);
  const initialSelection = participantOfficeIds.filter(id => id !== ownerOfficeId);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Pre-select participants when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(initialSelection);
    }
  }, [isOpen, JSON.stringify(initialSelection)]);

  const handleToggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedIds(selectableOffices.map((o) => o.id));
  };

  const handleDeselectAll = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedIds([]);
  };

  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedIds(participantOfficeIds);
  };

  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Distribute Document"
      widthClassName="max-w-xl"
    >
      <div className="flex flex-col gap-5">
        {/* Recipient Header / Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <Users className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Recipients ({selectedIds.length})
            </span>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={handleSelectAll}
              className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 uppercase tracking-tight transition"
            >
              Select All
            </button>
            <span className="text-slate-200 dark:text-surface-400 text-[10px]">|</span>
            <button
              onClick={handleReset}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 uppercase tracking-tight transition"
            >
              Reset
            </button>
            <span className="text-slate-200 dark:text-surface-400 text-[10px]">|</span>
            <button
              onClick={handleDeselectAll}
              className="text-[10px] font-semibold text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 uppercase tracking-tight transition"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Office Selection List */}
        <div className="h-[300px] border border-slate-200 dark:border-surface-400 rounded-xl overflow-hidden bg-white dark:bg-surface-500/30 ">
          <OfficeCheckList
            offices={selectableOffices}
            loading={false}
            selectedIds={selectedIds}
            onToggle={handleToggle}
          />
        </div>

        {/* Action Note */}
        <div className="flex items-start gap-2.5 py-2 px-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/30">
          <Info className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <p className="text-[11px] text-amber-900/90 dark:text-amber-200 font-semibold leading-tight">
              Selected offices will receive a Controlled Copy notice.
            </p>
            <p className="text-[10px] text-amber-800/70 dark:text-amber-300/60 leading-tight italic">
              The originating office ({offices.find(o => o.id === ownerOfficeId)?.code || "Owner"}) is already included.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-surface-400 pt-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={() => onConfirm(selectedIds)}
          loading={isProcessing}
          disabled={selectedIds.length === 0}
          className="px-8"
        >
          Distribute Controlled Copies
        </Button>
      </div>
    </Modal>
  );
};
export default WorkflowDistributeModal;
