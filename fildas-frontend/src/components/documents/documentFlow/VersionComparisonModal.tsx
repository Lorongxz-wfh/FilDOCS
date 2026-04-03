import React, { useState, useEffect } from "react";
import Modal from "../../ui/Modal";
import type { DocumentVersion } from "../../../services/types";
import { getDocumentPreviewLink } from "../../../services/documentApi";
import { Download, Check, ArrowRight } from "lucide-react";
import SelectDropdown from "../../ui/SelectDropdown";


type Props = {
  open: boolean;
  onClose: () => void;
  allVersions: DocumentVersion[];
  baseVersionId: number | null;
};

export default function VersionComparisonModal({
  open,
  onClose,
  allVersions,
  baseVersionId,
}: Props) {
  const [leftId, setLeftId] = useState<number | "">("");
  const [rightId, setRightId] = useState<number | "">("");

  // Default selection: Right is selected version (or newest), Left is the one before it.
  useEffect(() => {
    if (open && allVersions.length > 1) {
      const sorted = [...allVersions].sort(
        (a, b) => a.version_number - b.version_number,
      );
      
      let rIdx = sorted.length - 1;
      if (baseVersionId) {
        const foundIdx = sorted.findIndex((v) => v.id === baseVersionId);
        if (foundIdx > 0) {
          rIdx = foundIdx;
        }
      }
      const lIdx = rIdx > 0 ? rIdx - 1 : 0;

      setRightId(sorted[rIdx].id);
      setLeftId(sorted[lIdx].id);
    }
  }, [open, allVersions, baseVersionId]);

  const leftV = allVersions.find((v) => v.id === leftId);
  const rightV = allVersions.find((v) => v.id === rightId);

  const handleDownload = async (vId: number) => {
    const win = window.open("about:blank", "_blank");
    try {
      const { url } = await getDocumentPreviewLink(vId);
      if (win) win.location.href = url;
    } catch {
      win?.close();
    }
  };

  const DiffRow = ({
    label,
    leftVal,
    rightVal,
    isStatus = false,
  }: {
    label: string;
    leftVal: React.ReactNode;
    rightVal: React.ReactNode;
    isStatus?: boolean;
  }) => {
    const changed = leftVal !== rightVal;
    return (
      <div className="flex flex-col gap-1 border-b border-slate-100 dark:border-surface-400 py-3 last:border-0 last:pb-0">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 dark:bg-surface-600 rounded p-2.5 min-h-[40px] flex items-center">
            {isStatus ? (
              <span className="rounded-full bg-slate-200 dark:bg-surface-400 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                {leftVal || "—"}
              </span>
            ) : (
              <span className="text-sm text-slate-700 dark:text-slate-300">
                {leftVal || "—"}
              </span>
            )}
          </div>
          <div
            className={`rounded p-2.5 min-h-[40px] flex items-center transition-colors ${
              changed
                ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800"
                : "bg-slate-50 dark:bg-surface-600 border border-transparent"
            }`}
          >
            {isStatus ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  changed
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : "bg-slate-200 text-slate-600 dark:bg-surface-400 dark:text-slate-300"
                }`}
              >
                {rightVal || "—"}
              </span>
            ) : (
              <span
                className={`text-sm ${
                  changed
                    ? "text-emerald-700 dark:text-emerald-400 font-medium"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                {rightVal || "—"}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Compare Versions"
      widthClassName="max-w-4xl"
    >
      <div className="flex flex-col gap-6">
        {/* Selectors */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-slate-50 dark:bg-surface-600 p-4 rounded-xl border border-slate-200 dark:border-surface-400">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Base Version (Before)
            </label>
            <SelectDropdown
              value={String(leftId)}
              onChange={(val) => setLeftId(Number(val))}
              className="w-full"
              options={allVersions.map((v) => ({
                key: v.id,
                value: String(v.id),
                label: `v${v.version_number} — ${new Date(v.created_at).toLocaleDateString()}`,
              }))}
            />
          </div>

          <div className="flex items-center justify-center mt-6">
            <ArrowRight className="text-slate-300 dark:text-slate-500 h-5 w-5" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Target Version (After)
            </label>
            <SelectDropdown
              value={String(rightId)}
              onChange={(val) => setRightId(Number(val))}
              className="w-full"
              options={allVersions.map((v) => ({
                key: v.id,
                value: String(v.id),
                label: `v${v.version_number} — ${new Date(v.created_at).toLocaleDateString()}`,
              }))}
            />
          </div>
        </div>

        {/* Comparison Area */}
        {leftV && rightV && leftV.id !== rightV.id ? (
          <div className="flex flex-col gap-0 border border-slate-200 dark:border-surface-400 rounded-xl px-4 py-2 bg-white dark:bg-surface-500">
            {/* File Comparison Row (Custom) */}
            <div className="flex flex-col gap-2 border-b border-slate-100 dark:border-surface-400 py-4">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                File Attachment
              </span>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400 rounded-lg p-3 flex flex-col justify-between items-start gap-3">
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200 break-all line-clamp-2">
                    {leftV.original_filename || "No file"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownload(leftV.id)}
                    disabled={!leftV.original_filename}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </button>
                </div>
                
                <div
                  className={`border rounded-lg p-3 flex flex-col justify-between items-start gap-3 transition-colors ${
                    leftV.original_filename !== rightV.original_filename
                      ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/50"
                      : "bg-slate-50 dark:bg-surface-600 border-slate-200 dark:border-surface-400"
                  }`}
                >
                  <span
                    className={`text-sm font-medium break-all line-clamp-2 ${
                      leftV.original_filename !== rightV.original_filename
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {rightV.original_filename || "No file"}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownload(rightV.id)}
                    disabled={!rightV.original_filename}
                    className={`flex items-center gap-1.5 text-xs font-semibold hover:opacity-80 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                      leftV.original_filename !== rightV.original_filename
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-brand-600 dark:text-brand-400"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download File
                  </button>
                </div>
              </div>
            </div>

            <DiffRow
              label="Routing Mode"
              leftVal={leftV.routing_mode}
              rightVal={rightV.routing_mode}
            />
            
            <DiffRow
              label="Effective Date"
              leftVal={leftV.effective_date ? new Date(leftV.effective_date).toLocaleDateString() : "—"}
              rightVal={rightV.effective_date ? new Date(rightV.effective_date).toLocaleDateString() : "—"}
            />
            
            <DiffRow
              label="Author Description"
              leftVal={leftV.description}
              rightVal={rightV.description}
            />
            
            <DiffRow
              label="Revision Reason"
              leftVal={leftV.revision_reason}
              rightVal={rightV.revision_reason}
            />
            
            <DiffRow
              label="Phase Status"
              leftVal={leftV.status}
              rightVal={rightV.status}
              isStatus
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400">
            <Check className="h-8 w-8 text-slate-300 dark:text-slate-500 mb-2" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {leftV && rightV && leftV.id === rightV.id
                ? "Same version selected. Pick two different versions to compare."
                : "Select two versions to begin comparison."}
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}
