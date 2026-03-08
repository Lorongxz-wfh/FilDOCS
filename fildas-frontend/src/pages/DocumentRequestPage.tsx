import React from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame.tsx";
import Button from "../components/ui/Button.tsx";
import { getAuthUser } from "../lib/auth.ts";
import {
  getDocumentRequest,
  getDocumentRequestExamplePreviewLink,
  getDocumentRequestSubmissionFilePreviewLink,
  getDocumentRequestSubmissionFileDownloadLink,
  reviewDocumentRequestSubmission,
  submitDocumentRequestEvidence,
} from "../services/documentRequests";

function roleLower(me: any) {
  const raw = typeof me?.role === "string" ? me?.role : me?.role?.name;
  return String(raw ?? "").toLowerCase();
}

export default function DocumentRequestPage() {
  const navigate = useNavigate();
  const params = useParams();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId <= 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const role = roleLower(me);
  const isQa = role === "qa" || role === "sysadmin";

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [req, setReq] = React.useState<any | null>(null);

  const [recipient, setRecipient] = React.useState<any | null>(null);

  const [submissions, setSubmissions] = React.useState<any[]>([]);
  const [latestSubmission, setLatestSubmission] = React.useState<any | null>(
    null,
  );

  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState<
    number | null
  >(null);
  const selectedSubmission = React.useMemo(() => {
    if (!selectedSubmissionId) return latestSubmission;
    return (
      submissions.find((s) => Number(s.id) === Number(selectedSubmissionId)) ??
      latestSubmission
    );
  }, [selectedSubmissionId, submissions, latestSubmission]);

  const selectedFileId = React.useMemo(() => {
    const f0 = selectedSubmission?.files?.[0];
    return f0?.id ? Number(f0.id) : null;
  }, [selectedSubmission]);

  const latestFileId = React.useMemo(() => {
    const f0 = latestSubmission?.files?.[0];
    return f0?.id ? Number(f0.id) : null;
  }, [latestSubmission]);

  const [, setSubmissionPreviewUrl] = React.useState<string>("");
  const [, setSubmissionPreviewLoading] = React.useState(false);
  const [, setSubmissionPreviewError] = React.useState<string | null>(null);

  const [latestSubmissionPreviewUrl, setLatestSubmissionPreviewUrl] =
    React.useState<string>("");
  const [latestSubmissionPreviewLoading, setLatestSubmissionPreviewLoading] =
    React.useState(false);
  const [latestSubmissionPreviewError, setLatestSubmissionPreviewError] =
    React.useState<string | null>(null);

  const [qaNote, setQaNote] = React.useState("");
  const [reviewing, setReviewing] = React.useState(false);
  const [reviewErr, setReviewErr] = React.useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = React.useState<string | null>(null);

  const [rightTab, setRightTab] = React.useState<"example" | "submission">(
    "example",
  );

  const [leftTab, setLeftTab] = React.useState<"comments" | "activity">(
    "comments",
  );

  const [examplePreviewUrl, setExamplePreviewUrl] = React.useState<string>("");
  const [examplePreviewLoading, setExamplePreviewLoading] =
    React.useState(false);
  const [examplePreviewError, setExamplePreviewError] = React.useState<
    string | null
  >(null);

  const [note, setNote] = React.useState("");
  const [files, setFiles] = React.useState<File[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitMsg, setSubmitMsg] = React.useState<string | null>(null);
  const [submitErr, setSubmitErr] = React.useState<string | null>(null);
  const [forceSelectLatestOnce, setForceSelectLatestOnce] =
    React.useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState<string>("");

  React.useEffect(() => {
    let url: string | null = null;

    if (files.length === 1) {
      url = URL.createObjectURL(files[0]);
      setLocalPreviewUrl(url);
    } else {
      setLocalPreviewUrl("");
    }

    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [files]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setSubmitMsg(null);
    setSubmitErr(null);
    setReviewMsg(null);
    setReviewErr(null);

    try {
      const data = await getDocumentRequest(requestId);
      setReq(data.request);
      setRecipient((data as any).recipient ?? null);

      const latest = (data as any).latest_submission ?? null;
      const hist = Array.isArray((data as any).submissions)
        ? (data as any).submissions
        : [];

      setLatestSubmission(latest);
      setSubmissions(hist);

      setSelectedSubmissionId((prev) => {
        if (forceSelectLatestOnce) {
          return latest?.id ? Number(latest.id) : null;
        }
        if (prev) return prev;
        return latest?.id ? Number(latest.id) : null;
      });

      if (forceSelectLatestOnce) {
        setForceSelectLatestOnce(false);
      }
    } catch (e: any) {
      setReq(null);
      setRecipient(null);
      setError(
        e?.response?.data?.message ?? e?.message ?? "Failed to load request.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const canSubmit = !isQa && req?.status === "open" && !!recipient?.id;

  const latestStatus = String(latestSubmission?.status ?? "");
  const latestIsRejected = latestStatus === "rejected";
  const latestIsSubmittedOrAccepted =
    latestStatus === "submitted" || latestStatus === "accepted";

  const hasLocalPickedFile = files.length === 1 && !!localPreviewUrl;

  const showOfficeUploadArea =
    !isQa &&
    canSubmit &&
    (latestIsRejected || !latestSubmission) &&
    !hasLocalPickedFile;
  const showOfficeLockNotice =
    !isQa && canSubmit && latestIsSubmittedOrAccepted && !hasLocalPickedFile;

  const loadSubmissionPreview = React.useCallback(async () => {
    setSubmissionPreviewError(null);

    if (!selectedFileId) {
      setSubmissionPreviewUrl("");
      return;
    }

    setSubmissionPreviewLoading(true);
    try {
      const res =
        await getDocumentRequestSubmissionFilePreviewLink(selectedFileId);
      setSubmissionPreviewUrl(res.url);
    } catch (e: any) {
      setSubmissionPreviewUrl("");
      setSubmissionPreviewError(
        e?.response?.data?.message ??
          e?.message ??
          "Failed to load submission preview.",
      );
    } finally {
      setSubmissionPreviewLoading(false);
    }
  }, [selectedFileId]);

  React.useEffect(() => {
    loadSubmissionPreview().catch(() => {});
  }, [loadSubmissionPreview]);

  const loadLatestSubmissionPreview = React.useCallback(async () => {
    setLatestSubmissionPreviewError(null);

    if (!latestFileId) {
      setLatestSubmissionPreviewUrl("");
      return;
    }

    setLatestSubmissionPreviewLoading(true);
    try {
      const res =
        await getDocumentRequestSubmissionFilePreviewLink(latestFileId);
      setLatestSubmissionPreviewUrl(res.url);
    } catch (e: any) {
      setLatestSubmissionPreviewUrl("");
      setLatestSubmissionPreviewError(
        e?.response?.data?.message ??
          e?.message ??
          "Failed to load latest submission preview.",
      );
    } finally {
      setLatestSubmissionPreviewLoading(false);
    }
  }, [latestFileId]);

  React.useEffect(() => {
    loadLatestSubmissionPreview().catch(() => {});
  }, [loadLatestSubmissionPreview]);

  const loadExamplePreview = React.useCallback(async () => {
    if (!req?.example_preview_path) {
      setExamplePreviewUrl("");
      return;
    }

    setExamplePreviewLoading(true);
    setExamplePreviewError(null);

    try {
      const res = await getDocumentRequestExamplePreviewLink(requestId);
      setExamplePreviewUrl(res.url);
    } catch (e: any) {
      setExamplePreviewUrl("");
      setExamplePreviewError(
        e?.response?.data?.message ??
          e?.message ??
          "Failed to load example preview.",
      );
    } finally {
      setExamplePreviewLoading(false);
    }
  }, [req?.example_preview_path, requestId]);

  React.useEffect(() => {
    loadExamplePreview().catch(() => {});
  }, [loadExamplePreview]);

  const handleSelectFiles = (picked: FileList | null) => {
    setSubmitMsg(null);
    setSubmitErr(null);

    const arr = picked ? Array.from(picked) : [];
    if (arr.length === 0) {
      setFiles([]);
      return;
    }

    if (arr.length > 1) {
      setFiles([]);
      setSubmitErr("Please upload only 1 file for now.");
      return;
    }

    const tooBig = arr.find((f) => f.size > 10 * 1024 * 1024);
    if (tooBig) {
      setFiles([]);
      setSubmitErr(`File too large: ${tooBig.name} (max 10MB).`);
      return;
    }

    setFiles(arr);
  };

  const canQaReview =
    isQa &&
    !!selectedSubmission?.id &&
    String(selectedSubmission?.status) === "submitted";

  const qaReview = async (decision: "accepted" | "rejected") => {
    setReviewing(true);
    setReviewErr(null);
    setReviewMsg(null);

    try {
      if (!selectedSubmission?.id) {
        setReviewErr("No submission selected.");
        return;
      }

      await reviewDocumentRequestSubmission({
        submission_id: Number(selectedSubmission.id),
        decision,
        note: qaNote.trim() ? qaNote.trim() : null,
      });

      setReviewMsg(
        decision === "accepted"
          ? "Submission accepted."
          : "Submission rejected.",
      );
      setQaNote("");
      await load();
    } catch (e: any) {
      setReviewErr(
        e?.response?.data?.message ?? e?.message ?? "Review failed.",
      );
    } finally {
      setReviewing(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);

    try {
      if (!recipient?.id) {
        setSubmitErr("Recipient record is missing for this request.");
        return;
      }

      if (!canSubmit) {
        setSubmitErr("This request is not open for submission.");
        return;
      }
      if (files.length < 1) {
        setSubmitErr("Please attach at least 1 file.");
        return;
      }
      if (files.length > 5) {
        setSubmitErr("Max 5 files per submission.");
        return;
      }

      await submitDocumentRequestEvidence({
        request_id: requestId,
        recipient_id: Number(recipient.id),
        note: note.trim() ? note.trim() : null,
        files,
      });

      setSubmitMsg("Submission uploaded successfully.");
      setNote("");
      setFiles([]);
      setForceSelectLatestOnce(true);

      await load();
    } catch (e: any) {
      setSubmitErr(
        e?.response?.data?.message ?? e?.message ?? "Submit failed.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageFrame
      title={`Document Request #${requestId}`}
      onBack={() => navigate("/document-requests")}
    >
      {loading ? (
        <div className="flex h-40 items-center justify-center text-sm text-slate-500 dark:text-slate-400">
          Loading request details...
        </div>
      ) : error ? (
        <div className="p-4 text-sm font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded-xl dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      ) : !req ? (
        <div className="p-4 text-sm text-slate-500 dark:text-slate-400">
          Request not found.
        </div>
      ) : (
        <div className="grid h-full min-h-0 grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT PANE */}
          <section className="lg:col-span-7 min-w-0 min-h-0 flex flex-col overflow-hidden gap-6">
            {/* 1. Header Card */}
            <div className="shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm px-6 py-6 dark:border-surface-400 dark:bg-surface-500">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                  Request ID: #{requestId}
                </span>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500 bg-slate-50 px-2 py-1 rounded-md border border-slate-100 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-400">
                  <span className="font-medium">Example:</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate max-w-37.5">
                    {req.example_original_filename ??
                      (req.example_file_path ? "Attached" : "None")}
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                  {req.title}
                </h1>
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold border ${
                    req.status === "open"
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800"
                      : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-300"
                  }`}
                >
                  {String(req.status).toUpperCase()}
                </span>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-slate-100 dark:border-surface-400 pt-5">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Due Date
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    {req.due_at
                      ? new Date(req.due_at).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })
                      : "-"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Sender
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    User #{req.created_by_user_id}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Recipient
                  </dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-700 dark:text-slate-300 truncate">
                    {req.office_name || "—"}
                  </dd>
                </div>
              </div>

              {req.description && (
                <div className="mt-5 rounded-xl border border-blue-100 bg-blue-50/30 p-4 dark:border-blue-900 dark:bg-blue-950/20">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-1">
                    Instructions
                  </h4>
                  <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400 max-h-25 overflow-y-auto">
                    {req.description}
                  </p>
                </div>
              )}
            </div>

            {/* 2. Comments/Activity Card */}
            <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-surface-400 dark:bg-surface-500">
              {/* Tab Header */}
              <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-surface-400 dark:bg-surface-600">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setLeftTab("comments")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      leftTab === "comments"
                        ? "bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-surface-500 dark:text-slate-100 dark:border-surface-300"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Comments
                  </button>
                  <button
                    onClick={() => setLeftTab("activity")}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                      leftTab === "activity"
                        ? "bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-surface-500 dark:text-slate-100 dark:border-surface-300"
                        : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    }`}
                  >
                    Activity
                  </button>
                </div>
              </div>

              {/* Scrollable Message Area */}
              <div className="flex-1 overflow-y-auto p-5 bg-slate-50/30 dark:bg-surface-600/30">
                {leftTab === "comments" ? (
                  <div className="space-y-4">
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 py-10">
                      <span className="text-sm italic">
                        No comments yet. Start the conversation below.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 dark:text-slate-400 italic">
                    No activity logs recorded.
                  </div>
                )}
              </div>

              {/* Fixed Input Area */}
              {leftTab === "comments" && (
                <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-4 dark:border-surface-400 dark:bg-surface-500">
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Write a comment..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-200 dark:placeholder-slate-500"
                      disabled
                    />
                    <button
                      disabled
                      className="absolute right-2 text-sky-600 font-semibold text-xs px-3 py-1.5 hover:bg-sky-50 rounded-lg transition disabled:opacity-30 dark:hover:bg-sky-950/30"
                    >
                      Post
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT PANE */}
          <aside className="lg:col-span-5 min-w-0 min-h-0 flex flex-col overflow-hidden">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden flex min-h-0 flex-1 flex-col dark:border-surface-400 dark:bg-surface-500">
              {/* Tabs header */}
              <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-3 dark:border-surface-400 dark:bg-surface-600">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setRightTab("example")}
                      className={
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
                        (rightTab === "example"
                          ? "bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-surface-500 dark:text-slate-100 dark:border-surface-300"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200")
                      }
                    >
                      Example
                    </button>

                    <button
                      type="button"
                      onClick={() => setRightTab("submission")}
                      className={
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition " +
                        (rightTab === "submission"
                          ? "bg-white text-slate-900 border border-slate-200 shadow-sm dark:bg-surface-500 dark:text-slate-100 dark:border-surface-300"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-400 dark:hover:text-slate-200")
                      }
                    >
                      Submission
                    </button>
                  </div>

                  {rightTab === "example" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => loadExamplePreview()}
                      disabled={examplePreviewLoading}
                    >
                      Refresh
                    </Button>
                  ) : null}
                </div>

                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                  {rightTab === "example"
                    ? "Reference file attached by QA (if provided)."
                    : isQa
                      ? "QA view: review evidence, then accept/reject."
                      : "Upload your evidence file here (1 file for now)."}
                </div>
              </div>

              {/* Body */}
              <div className="min-h-0 flex-1">
                <div className="p-5 space-y-4 h-full min-h-0 flex flex-col">
                  {rightTab === "example" ? (
                    <>
                      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-600">
                        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Example file
                        </div>
                        <div className="mt-1 text-sm text-slate-900 dark:text-slate-100 truncate">
                          {req.example_original_filename ??
                            (req.example_file_path ? "Attached" : "None")}
                        </div>
                      </div>

                      <div className="flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600">
                        {!req.example_preview_path ? (
                          <div className="h-full w-full flex items-center justify-center text-sm text-slate-500 bg-slate-50/40 dark:bg-surface-600 dark:text-slate-400">
                            No example preview attached.
                          </div>
                        ) : examplePreviewLoading ? (
                          <div className="h-full w-full flex items-center justify-center text-sm text-slate-600 dark:text-slate-400">
                            Loading preview…
                          </div>
                        ) : examplePreviewError ? (
                          <div className="h-full w-full flex items-center justify-center text-sm text-rose-800 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400">
                            {examplePreviewError}
                          </div>
                        ) : examplePreviewUrl ? (
                          <iframe
                            title="Document request example preview"
                            src={examplePreviewUrl}
                            className="h-full w-full"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-sm text-slate-600 dark:text-slate-400">
                            Preview link not loaded.
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex flex-col min-h-0 flex-1 space-y-4">
                        {/* History selector */}
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-600">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                Submission history
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                Showing last {submissions.length} attempt(s).
                              </div>
                            </div>

                            <select
                              value={selectedSubmission?.id ?? ""}
                              onChange={(e) =>
                                setSelectedSubmissionId(
                                  e.target.value
                                    ? Number(e.target.value)
                                    : null,
                                )
                              }
                              className="shrink-0 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200"
                            >
                              <option value="">No submission</option>
                              {submissions.map((s) => (
                                <option key={s.id} value={s.id}>
                                  Attempt #{s.attempt_no} —{" "}
                                  {String(s.status).toUpperCase()}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Submission file info + actions */}
                        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-600">
                          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            Submission file
                          </div>
                          <div className="mt-1 text-sm text-slate-900 dark:text-slate-100 truncate">
                            {selectedSubmission?.files?.[0]
                              ?.original_filename ?? "None"}
                          </div>

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {selectedSubmission?.id
                                ? `Attempt #${selectedSubmission.attempt_no} • ${String(selectedSubmission.status).toUpperCase()}`
                                : "No submission selected."}
                            </div>

                            {selectedFileId ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={async () => {
                                  const win = window.open(
                                    "about:blank",
                                    "_blank",
                                  );
                                  const res =
                                    await getDocumentRequestSubmissionFileDownloadLink(
                                      selectedFileId,
                                    );
                                  if (win) win.location.href = res.url;
                                }}
                              >
                                Download
                              </Button>
                            ) : null}
                          </div>
                        </div>

                        {/* QA review controls */}
                        {isQa ? (
                          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 space-y-3 dark:border-surface-400 dark:bg-surface-600">
                            <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              QA review
                            </div>

                            <textarea
                              rows={2}
                              value={qaNote}
                              onChange={(e) => setQaNote(e.target.value)}
                              className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500"
                              placeholder="Optional note (accept/reject)…"
                              disabled={reviewing}
                            />

                            {reviewMsg ? (
                              <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
                                {reviewMsg}
                              </div>
                            ) : null}

                            {reviewErr ? (
                              <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                                {reviewErr}
                              </div>
                            ) : null}

                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                disabled={!canQaReview || reviewing}
                                onClick={() => qaReview("rejected")}
                                className="inline-flex items-center rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/40"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                disabled={!canQaReview || reviewing}
                                onClick={() => qaReview("accepted")}
                                className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
                              >
                                Accept
                              </button>
                            </div>

                            {!canQaReview && selectedSubmission?.id ? (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                Review buttons enable only when status is
                                SUBMITTED.
                              </div>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Office upload controls */}
                        {!isQa ? (
                          <div className="space-y-4">
                            {!canSubmit ? (
                              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-400">
                                Submissions are allowed only when the request is
                                open.
                              </div>
                            ) : null}

                            {showOfficeLockNotice ? (
                              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-300">
                                Latest submission is waiting for QA review.
                              </div>
                            ) : null}

                            {hasLocalPickedFile ? (
                              <>
                                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden dark:border-surface-400 dark:bg-surface-600">
                                  <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-2 flex items-center justify-between gap-3 dark:border-surface-400 dark:bg-surface-700/50">
                                    <div className="min-w-0">
                                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                        Preview (local)
                                      </div>
                                      <div className="text-[11px] text-slate-600 dark:text-slate-400 truncate">
                                        {files[0].name}
                                      </div>
                                    </div>

                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setFiles([])}
                                      disabled={!canSubmit || submitting}
                                    >
                                      Change
                                    </Button>
                                  </div>

                                  <div className="h-[45vh] min-h-80 bg-white dark:bg-surface-600">
                                    <iframe
                                      title="Local submission preview"
                                      src={localPreviewUrl}
                                      className="h-full w-full"
                                    />
                                  </div>

                                  <div className="px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    Local preview works best for PDF.
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                                    Note (optional)
                                  </label>
                                  <textarea
                                    rows={3}
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    className="block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-xs outline-none ring-0 transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500"
                                    placeholder="Optional message to QA…"
                                    disabled={!canSubmit || submitting}
                                  />
                                </div>

                                {submitMsg ? (
                                  <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2 dark:border-green-800 dark:bg-green-950/40 dark:text-green-400">
                                    {submitMsg}
                                  </div>
                                ) : null}

                                {submitErr ? (
                                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                                    {submitErr}
                                  </div>
                                ) : null}

                                <div className="flex items-center justify-end">
                                  <button
                                    type="button"
                                    disabled={
                                      !canSubmit ||
                                      submitting ||
                                      files.length !== 1
                                    }
                                    onClick={() => submit()}
                                    className="inline-flex items-center gap-1 rounded-md bg-sky-600 px-4 py-2 text-xs font-medium text-white shadow-sm shadow-sky-200 transition hover:bg-sky-700 disabled:opacity-60"
                                  >
                                    {submitting ? "Submitting…" : "Submit"}
                                  </button>
                                </div>
                              </>
                            ) : showOfficeUploadArea ? (
                              <>
                                <div
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSelectFiles(e.dataTransfer.files);
                                  }}
                                  className={
                                    "rounded-xl border border-dashed px-4 py-10 text-center transition " +
                                    (canSubmit
                                      ? "border-slate-300 bg-white hover:bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600 dark:hover:bg-surface-500/60"
                                      : "border-slate-200 bg-slate-50 opacity-70 dark:border-surface-400 dark:bg-surface-600")
                                  }
                                >
                                  <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    Click to upload or drag & drop
                                  </div>
                                  <div className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                                    PDF, Word, Excel, PowerPoint (max 10MB)
                                  </div>

                                  <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-md bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700">
                                    Choose file
                                    <input
                                      type="file"
                                      className="hidden"
                                      disabled={!canSubmit || submitting}
                                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                                      onChange={(e) =>
                                        handleSelectFiles(e.target.files)
                                      }
                                    />
                                  </label>
                                </div>

                                {submitErr ? (
                                  <div className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
                                    {submitErr}
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        ) : null}

                        {/* Main preview */}
                        <div className="flex-1 min-h-0 w-full overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-600">
                          {hasLocalPickedFile ? (
                            <iframe
                              title="Local submission preview (main)"
                              src={localPreviewUrl}
                              className="h-full w-full"
                            />
                          ) : !latestFileId ? (
                            <div className="h-full w-full flex items-center justify-center text-sm text-slate-500 bg-slate-50/40 dark:bg-surface-600 dark:text-slate-400">
                              No submission yet. Upload a file to preview it
                              here.
                            </div>
                          ) : latestSubmissionPreviewLoading ? (
                            <div className="h-full w-full flex items-center justify-center text-sm text-slate-600 dark:text-slate-400">
                              Loading preview…
                            </div>
                          ) : latestSubmissionPreviewError ? (
                            <div className="h-full w-full flex items-center justify-center text-sm text-rose-800 bg-rose-50 dark:bg-rose-950/40 dark:text-rose-400">
                              {latestSubmissionPreviewError}
                            </div>
                          ) : latestSubmissionPreviewUrl ? (
                            <iframe
                              title="Latest submission preview"
                              src={latestSubmissionPreviewUrl}
                              className="h-full w-full"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-sm text-slate-600 dark:text-slate-400">
                              Preview link not loaded.
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </PageFrame>
  );
}
