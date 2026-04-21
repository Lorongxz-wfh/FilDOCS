import { Upload, XCircle, Download, CheckCircle, AlertCircle } from "lucide-react";
import Button from "../ui/Button";

function statusDot(status: string): string {
  switch (status?.toLowerCase()) {
    case "accepted": return "bg-emerald-500";
    case "rejected": return "bg-red-500";
    case "submitted": return "bg-amber-400";
    default: return "bg-slate-400";
  }
}
import { StatusBadge } from "./shared";
import RequestPreviewBox from "./RequestPreviewBox";
import { getDocumentRequestSubmissionFileDownloadLink } from "../../services/documentRequests";
import SelectDropdown from "../ui/SelectDropdown";

type Props = {
  isReviewer: boolean;
  isSubmitter: boolean;
  req: any;
  submissions: any[];
  selectedSubmission: any;
  selectedSubmissionId: number | null;
  selectedFileId: number | null;
  onSelectSubmission: (id: number | null) => void;

  // Review
  qaNote: string;
  reviewing: boolean;
  canReview: boolean;
  onQaNoteChange: (v: string) => void;
  onQaReview: (decision: "accepted" | "rejected") => void;

  // Example download
  hasExample: boolean;
  onDownloadExample: () => void;

  // Office upload
  files: File[];
  localPreviewUrl: string;
  hasLocalFile: boolean;
  showUploadArea: boolean;

  canSubmit: boolean;
  note: string;
  submitting: boolean;
  submitMsg: string | null;
  submitErr: string | null;
  onNoteChange: (v: string) => void;
  onSelectFiles: (f: FileList | null) => void;
  onRemoveFile: () => void;
  onSubmit: () => void;

  // Preview
  submissionPreviewUrl: string;
  submissionPreviewLoading: boolean;
  submissionPreviewError: string | null;
  onViewModal: (url: string, filename?: string) => void;
};

export default function RequestSubmissionTab({
  isReviewer,
  isSubmitter,
  req,
  submissions,
  selectedSubmission,
  //   selectedSubmissionId,
  selectedFileId,
  onSelectSubmission,
  qaNote,
  reviewing,
  canReview,
  onQaNoteChange,
  onQaReview,
  hasExample,
  onDownloadExample,
  files,
  localPreviewUrl,
  hasLocalFile,
  showUploadArea,

  canSubmit,
  note,
  submitting,
  submitMsg,
  submitErr,
  onNoteChange,
  onSelectFiles,
  onRemoveFile,
  onSubmit,
  submissionPreviewUrl,
  submissionPreviewLoading,
  submissionPreviewError,
  onViewModal,
}: Props) {
  const hasAnySub = submissions.length > 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {/* ── Role Message / Alerts ── */}
      {!isReviewer && !isSubmitter && (
        <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-surface-400 dark:bg-surface-600/50 dark:text-slate-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>You have read-only access to this request.</span>
        </div>
      )}

      {isReviewer && !hasAnySub && !isSubmitter && (
        <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-surface-400 dark:bg-surface-600/50 dark:text-slate-400">
          <AlertCircle size={14} className="shrink-0" />
          <span>Waiting for the office to submit the requested document.</span>
        </div>
      )}

      {isSubmitter && !canSubmit && req?.status !== "open" && (
        <div className="flex items-center gap-2.5 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-surface-400 dark:bg-surface-600/50 dark:text-slate-400">
          <XCircle size={14} className="shrink-0" />
          <span>This request is closed and no longer accepting submissions.</span>
        </div>
      )}

      {/* ── Main Controls Card ── */}
      {(isSubmitter || isReviewer) && (
        <div className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col">
          {/* Header Area: Submission Status & Attempts (Visible if submission exists or is being made) */}
          {(hasAnySub || hasLocalFile) && (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100 dark:border-surface-400">
              <div className="min-w-0 flex-1 flex items-center gap-2.5">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                  {hasLocalFile
                    ? files[0].name
                    : selectedSubmission?.files?.[0]?.original_filename ?? "No file attached"}
                </p>
                {!hasLocalFile && selectedSubmission && (
                  <StatusBadge status={selectedSubmission.status} />
                )}
                {hasLocalFile && (
                  <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
                    Ready to submit
                  </span>
                )}
              </div>

              {submissions.length > 0 && !hasLocalFile && (
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Attempt</span>
                  <SelectDropdown
                    value={selectedSubmission?.id ?? null}
                    onChange={(val) => onSelectSubmission(val ? Number(val) : null)}
                    options={submissions.map((s) => ({
                      value: s.id,
                      label: `#${s.attempt_no}`,
                      dot: statusDot(s.status),
                    }))}
                    placeholder="—"
                    clearable={false}
                    className="w-20"
                  />
                </div>
              )}
            </div>
          )}

          {/* Submitter: Example Download */}
          {isSubmitter && hasExample && !hasLocalFile && (
            <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-100 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/20">
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">
                  Reference
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Use the provided template as a reference.
                </p>
              </div>
              <button
                type="button"
                onClick={onDownloadExample}
                className="shrink-0 flex items-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-900 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white active:scale-95 transition-all"
              >
                <Download size={12} /> Download Example
              </button>
            </div>
          )}

          {/* Submitter: Upload Area */}
          {isSubmitter && showUploadArea && !hasLocalFile && (
            <div className="px-5 py-5">
              <label
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectFiles(e.dataTransfer.files);
                }}
                className="flex items-center justify-between gap-4 rounded-md border border-dashed border-slate-300 dark:border-surface-400 bg-slate-50 dark:bg-surface-600/40 px-4 py-3 cursor-pointer hover:border-brand-400 hover:bg-brand-50/20 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/5 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Upload size={14} className="shrink-0 text-slate-400" />
                  <span className="text-xs text-slate-400 dark:text-slate-500 truncate">
                    PDF, DOC, XLS, PPT · Max 10 MB
                  </span>
                </div>
                <span className="shrink-0 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 rounded px-2.5 py-1">
                  Choose file
                </span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                  onChange={(e) => onSelectFiles(e.target.files)}
                />
              </label>

              {submitErr && (
                <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:border-red-800 dark:text-red-400">
                  <AlertCircle size={13} className="shrink-0" /> {submitErr}
                </div>
              )}
            </div>
          )}

          {/* Submitter: Local File Review/Submit */}
          {isSubmitter && hasLocalFile && (
            <div className="p-5 flex flex-col gap-4 border-t border-slate-100 dark:border-surface-400">
              <div className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-surface-400 dark:bg-surface-600/40">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="shrink-0 h-9 w-9 rounded-md bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 flex items-center justify-center text-emerald-600">
                    <CheckCircle size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {files[0].name}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {(files[0].size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={onRemoveFile}
                  disabled={submitting}
                  className="text-xs font-medium text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors px-2 py-1"
                >
                  Remove
                </button>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">
                  Submission Note
                </p>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => onNoteChange(e.target.value)}
                  placeholder="Optional context for this submission…"
                  disabled={submitting}
                  className="block w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-slate-400 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-100 dark:placeholder-slate-500 resize-none"
                />
              </div>

              {submitMsg && (
                <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-400">
                  <CheckCircle size={13} className="shrink-0" /> {submitMsg}
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  onClick={onSubmit}
                  disabled={submitting || files.length !== 1}
                  className="flex items-center gap-1.5 rounded-md bg-brand-600 px-5 py-2 text-xs font-semibold text-white hover:bg-brand-700 active:scale-95 transition-all disabled:opacity-40"
                >
                  {submitting ? (
                    <>
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Submitting…
                    </>
                  ) : (
                    <>
                      <Upload size={13} /> Submit Document
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Reviewer: Decision Box */}
          {isReviewer && canReview && !hasLocalFile && (
            <div className="px-5 py-4 border-t border-slate-100 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/20">
              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3">
                Review Decision
              </p>
              <div className="flex items-start gap-3">
                <textarea
                  rows={1}
                  value={qaNote}
                  onChange={(e) => onQaNoteChange(e.target.value)}
                  placeholder="Reviewer note (optional)…"
                  disabled={reviewing}
                  className="flex-1 min-w-0 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs outline-none transition focus:border-slate-400 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-100 dark:placeholder-slate-500 resize-y min-h-[34px]"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="danger"
                    size="xs"
                    disabled={reviewing}
                    onClick={() => onQaReview("rejected")}
                  >
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    size="xs"
                    disabled={reviewing}
                    onClick={() => onQaReview("accepted")}
                  >
                    Accept
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Unified Preview Box ── */}
      <RequestPreviewBox
        url={hasLocalFile ? localPreviewUrl : submissionPreviewUrl}
        loading={!hasLocalFile && submissionPreviewLoading}
        error={!hasLocalFile ? submissionPreviewError : null}
        filename={
          hasLocalFile
            ? files[0]?.name
            : selectedSubmission?.files?.[0]?.original_filename
        }
        emptyLabel="No submission to preview."
        onDownload={
          selectedFileId && !hasLocalFile
            ? async () => {
                const win = window.open("about:blank", "_blank");
                const res = await getDocumentRequestSubmissionFileDownloadLink(selectedFileId);
                if (win) win.location.href = res.url;
              }
            : undefined
        }
        onViewModal={() => {
          const url = hasLocalFile ? localPreviewUrl : submissionPreviewUrl;
          const name = hasLocalFile
            ? files[0]?.name
            : selectedSubmission?.files?.[0]?.original_filename;
          if (url) onViewModal(url, name);
        }}
      />
    </div>
  );
}
