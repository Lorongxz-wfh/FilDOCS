import React from "react";
import Modal from "../../ui/Modal";
import Button from "../../ui/Button";
import { ShieldCheck, Calendar, Building2, Hash, FileText } from "lucide-react";

interface WorkflowRegisterModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentCode: string; // The system-generated code (reserved_code)
  officeName: string;
  effectiveDate: string; // YYYY-MM-DD
  onEffectiveDateChange: (newDate: string) => void;
  isProcessing: boolean;
  onConfirm: () => void;
}

export const WorkflowRegisterModal: React.FC<WorkflowRegisterModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  documentCode,
  officeName,
  effectiveDate,
  onEffectiveDateChange,
  isProcessing,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Register Document"
      widthClassName="max-w-lg"
    >
      <div className="flex flex-col gap-6">
        {/* Document Primary Detail */}
        <div className="flex flex-col gap-1 px-1">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            Document Title
          </span>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 leading-snug">
            {documentTitle}
          </h3>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-6 px-1">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <Hash className="h-3 w-3" />
              System Code
            </div>
            <p className="text-sm font-mono font-semibold text-sky-600 dark:text-sky-400">
              {documentCode || "Pending"}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-500 dark:text-emerald-400">
              <Calendar className="h-3 w-3" />
              Effective Date
            </div>
            <input
              type="date"
              value={effectiveDate}
              onChange={(e) => onEffectiveDateChange(e.target.value)}
              className="w-full bg-transparent border-b border-emerald-100 dark:border-emerald-900/30 pb-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 outline-none focus:border-emerald-400 transition cursor-pointer"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <Building2 className="h-3 w-3" />
              Originating Office
            </div>
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {officeName}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              <ShieldCheck className="h-3 w-3" />
              Process
            </div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Final Lifecycle Registration
            </p>
          </div>
        </div>

        {/* Action Hint */}
        <div className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 dark:bg-surface-600 border border-slate-100 dark:border-surface-400">
          <div className="mt-0.5 p-1 rounded bg-sky-100 dark:bg-sky-900/30">
            <FileText className="h-3 w-3 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
            Registration formally completes the drafting cycle. Ensure all details match the signed copy before proceeding.
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 dark:border-surface-400 pt-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          disabled={isProcessing}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={onConfirm}
          loading={isProcessing}
          className="px-6"
        >
          Complete Registration
        </Button>
      </div>
    </Modal>
  );
};
export default WorkflowRegisterModal;
