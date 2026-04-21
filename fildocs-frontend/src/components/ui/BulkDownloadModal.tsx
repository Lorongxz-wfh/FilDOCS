import React, { useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Download, FileArchive } from "lucide-react";

interface BulkDownloadModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (filename: string) => void;
  selectedCount: number;
  defaultPrefix?: string;
}

export default function BulkDownloadModal({
  open,
  onClose,
  onConfirm,
  selectedCount,
  defaultPrefix = "Export",
}: BulkDownloadModalProps) {
  const [filename, setFilename] = useState(
    `${defaultPrefix}_Batch_${new Date().toISOString().split('T')[0]}`
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(filename.trim() || defaultPrefix);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirm Bulk Download"
      widthClassName="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 dark:bg-surface-400 border border-slate-200 dark:border-surface-300">
          <div className="p-2.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 shrink-0">
            <FileArchive size={24} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Generating ZIP Archive
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              You have selected <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedCount} items</span>. 
              We will package these into a single compressed file for download.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">
            ZIP Filename
          </label>
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="Enter filename..."
              className="w-full h-11 pl-4 pr-12 rounded-lg border border-slate-200 dark:border-surface-300 bg-white dark:bg-surface-600 text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all outline-none"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-slate-400 uppercase">
              .zip
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} type="button">
            Cancel
          </Button>
          <Button variant="primary" type="submit" className="gap-2">
            <Download size={16} />
            Start Download
          </Button>
        </div>
      </form>
    </Modal>
  );
}
