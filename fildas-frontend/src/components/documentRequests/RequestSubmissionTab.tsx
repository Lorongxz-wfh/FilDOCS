import { Upload, CheckCircle, XCircle, Clock, ChevronDown, Download } from "lucide-react";
import { StatusBadge } from "./shared";
import RequestPreviewBox from "./RequestPreviewBox";
import { getDocumentRequestSubmissionFileDownloadLink } from "../../services/documentRequests";

type Props = {
  isQa: boolean;
  req: any;
  submissions: any[];
  selectedSubmission: any;
  selectedSubmissionId: number | null;
  selectedFileId: number | null;
  onSelectSubmission: (id: number | null) => void;

  // QA review
  qaNote: string;
  reviewing: boolean;
  reviewErr: string | null;
  reviewMsg: string | null;
  canQaReview: boolean;
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
  showLockNotice: boolean;
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
  isQa,
  req,
  submissions,
  selectedSubmission,
//   selectedSubmissionId,
  selectedFileId,
  onSelectSubmission,
  qaNote,
  reviewing,
  reviewErr,
  reviewMsg,
  canQaReview,
  onQaNoteChange,
  onQaReview,
  hasExample,
  onDownloadExample,
  files,
  localPreviewUrl,
  hasLocalFile,
  showUploadArea,
  showLockNotice,
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
  return (
    <>
      {/* ── QA view ── */}
      {isQa && (
        <>
          {submissions.length > 0 && (
            <div className="shrink-0 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-surface-400 dark:bg-surface-600">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500 shrink-0">
                  Attempt
                </span>
                {selectedSubmission && (
                  <StatusBadge status={selectedSubmission.status} />
                )}
                {selectedSubmission?.qa_review_note && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 italic truncate">
                    "{selectedSubmission.qa_review_note}"
                  </span>
                )}
              </div>
              <div className="relative shrink-0">
                <select
                  value={selectedSubmission?.id ?? ""}
                  onChange={(e) =>
                    onSelectSubmission(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                  className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-xs text-slate-700 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200"
                >
                  <option value="">None</option>
                  {submissions.map((s) => (
                    <option key={s.id} value={s.id}>
                      #{s.attempt_no} — {String(s.status).toUpperCase()}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={12}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>
          )}

          <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-surface-400 dark:bg-surface-600">
            <div className="flex items-center justify-between gap-3 mb-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Review Decision
              </p>
              {!canQaReview && selectedSubmission?.id && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500">
                  Only available for SUBMITTED
                </span>
              )}
            </div>
            <textarea
              rows={2}
              value={qaNote}
              onChange={(e) => onQaNoteChange(e.target.value)}
              placeholder="Optional note for the office…"
              disabled={reviewing || !canQaReview}
              className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500 mb-2.5"
            />
            {reviewMsg && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400 mb-2">
                <CheckCircle size={12} /> {reviewMsg}
              </div>
            )}
            {reviewErr && (
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400 mb-2">
                <XCircle size={12} /> {reviewErr}
              </div>
            )}
            <div className="flex items-center justify-end gap-2">
              <button
                disabled={!canQaReview || reviewing}
                onClick={() => onQaReview("rejected")}
                className="flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
              >
                <XCircle size={12} /> Reject
              </button>
              <button
                disabled={!canQaReview || reviewing}
                onClick={() => onQaReview("accepted")}
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle size={12} /> Accept
              </button>
            </div>
          </div>

          <RequestPreviewBox
            url={submissionPreviewUrl}
            loading={submissionPreviewLoading}
            error={submissionPreviewError}
            filename={selectedSubmission?.files?.[0]?.original_filename}
            emptyLabel="No submission to preview."
            onDownload={
              selectedFileId
                ? async () => {
                    const win = window.open("about:blank", "_blank");
                    const res =
                      await getDocumentRequestSubmissionFileDownloadLink(
                        selectedFileId,
                      );
                    if (win) win.location.href = res.url;
                  }
                : undefined
            }
            onViewModal={
              submissionPreviewUrl
                ? () =>
                    onViewModal(
                      submissionPreviewUrl,
                      selectedSubmission?.files?.[0]?.original_filename,
                    )
                : undefined
            }
          />
        </>
      )}

      {/* ── Office view ── */}
      {!isQa && (
        <>
          {showLockNotice && (
            <div className="shrink-0 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400">
              <Clock size={13} /> Waiting for QA review. You cannot resubmit
              yet.
            </div>
          )}
          {!canSubmit && req.status !== "open" && (
            <div className="shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-400">
              This request is closed.
            </div>
          )}

          {hasExample && (
            <div className="shrink-0 flex items-center justify-between gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-800 dark:bg-sky-950/30">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-sky-800 dark:text-sky-300">Step 1 — Download the example document</p>
                <p className="text-[11px] text-sky-600 dark:text-sky-400 mt-0.5">Fill in or sign the downloaded file, then upload it below.</p>
              </div>
              <button
                type="button"
                onClick={onDownloadExample}
                className="shrink-0 flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                <Download size={12} /> Download
              </button>
            </div>
          )}

          {showUploadArea && (
            <div className="shrink-0">
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelectFiles(e.dataTransfer.files);
                }}
                className="rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/60 px-4 py-6 text-center hover:border-sky-300 hover:bg-sky-50/30 transition dark:border-surface-400 dark:bg-surface-600 dark:hover:border-sky-700"
              >
                <Upload
                  size={20}
                  className="mx-auto text-slate-300 dark:text-slate-600"
                />
                <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  {hasExample ? "Step 2 — Upload completed document" : "Drop your file here"}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  PDF, Word, Excel, PowerPoint · max 10MB
                </p>
                <label className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-sky-700 transition">
                  <Upload size={12} /> Choose file
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                    onChange={(e) => onSelectFiles(e.target.files)}
                  />
                </label>
              </div>
              {submitErr && (
                <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400">
                  <XCircle size={12} /> {submitErr}
                </div>
              )}
            </div>
          )}

          {hasLocalFile && (
            <div className="shrink-0 space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-surface-400 dark:bg-surface-600">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {files[0].name}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {(files[0].size / 1024).toFixed(0)} KB
                  </p>
                </div>
                <button
                  onClick={onRemoveFile}
                  disabled={submitting}
                  className="text-xs text-slate-500 hover:text-rose-600 transition ml-3 shrink-0"
                >
                  Remove
                </button>
              </div>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => onNoteChange(e.target.value)}
                placeholder="Optional note to QA…"
                disabled={submitting}
                className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500"
              />
              {submitMsg && (
                <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400">
                  <CheckCircle size={12} /> {submitMsg}
                </div>
              )}
              {submitErr && (
                <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-400">
                  <XCircle size={12} /> {submitErr}
                </div>
              )}
              <div className="flex justify-end">
                <button
                  onClick={onSubmit}
                  disabled={submitting || files.length !== 1}
                  className="flex items-center gap-1.5 rounded-lg bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-50 transition"
                >
                  <Upload size={13} />
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          )}

          {!hasLocalFile && selectedSubmission && (
            <div className="shrink-0 flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-surface-400 dark:bg-surface-600">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                  {selectedSubmission.files?.[0]?.original_filename ??
                    "No file"}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    Attempt #{selectedSubmission.attempt_no}
                  </span>
                  <StatusBadge status={selectedSubmission.status} />
                </div>
                {selectedSubmission.qa_review_note && (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 italic">
                    QA: {selectedSubmission.qa_review_note}
                  </p>
                )}
              </div>
              {submissions.length > 1 && (
                <div className="relative shrink-0">
                  <select
                    value={selectedSubmission?.id ?? ""}
                    onChange={(e) =>
                      onSelectSubmission(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                    className="appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-7 py-1.5 text-xs text-slate-700 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200"
                  >
                    {submissions.map((s) => (
                      <option key={s.id} value={s.id}>
                        #{s.attempt_no} — {String(s.status).toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={12}
                    className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                </div>
              )}
            </div>
          )}

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
                    const res =
                      await getDocumentRequestSubmissionFileDownloadLink(
                        selectedFileId,
                      );
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
        </>
      )}
    </>
  );
}
