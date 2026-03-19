import React from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { getAuthUser } from "../lib/auth";
import {
  getDocumentRequestRecipient,
  getDocumentRequestItem,
  getDocumentRequestExamplePreviewLink,
  getDocumentRequestItemExamplePreviewLink,
  getDocumentRequestExampleDownloadLink,
  getDocumentRequestItemExampleDownloadLink,
  getDocumentRequestMessages,
  getDocumentRequestSubmissionFilePreviewLink,
  postDocumentRequestMessage,
  reviewDocumentRequestSubmission,
  submitDocumentRequestEvidence,
  updateDocumentRequestItem,
  updateDocumentRequestRecipient,
  type DocumentRequestMessageRow,
} from "../services/documentRequests";
import { MessageSquare, Activity, Pencil} from "lucide-react";
import { roleLower, TabBar } from "../components/documentRequests/shared";
import RequestHeaderCard from "../components/documentRequests/RequestHeaderCard";
import RequestCommentsPanel from "../components/documentRequests/RequestCommentsPanel";
import RequestActivityPanel from "../components/documentRequests/RequestActivityPanel";
import RequestExampleTab from "../components/documentRequests/RequestExampleTab";
import RequestSubmissionTab from "../components/documentRequests/RequestSubmissionTab";
import RequestPreviewModal from "../components/documentRequests/RequestPreviewModal";

import { inputCls } from "../utils/formStyles";

export default function DocumentRequestPage() {
  const navigate = useNavigate();
  const params = useParams();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const requestId = Number(params.id);
  const recipientId = params.recipientId ? Number(params.recipientId) : null;
  const itemId = params.itemId ? Number(params.itemId) : null;

  if (!Number.isFinite(requestId) || requestId <= 0)
    return <Navigate to="/dashboard" replace />;
  if (!recipientId && !itemId)
    return <Navigate to={`/document-requests/${requestId}`} replace />;

  const isItemView = !!itemId;
  const role = roleLower(me);
  const isQa = role === "qa" || role === "sysadmin" || role === "admin";
  const myUserId = Number(me?.id ?? 0);

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [req, setReq] = React.useState<any | null>(null);
  const [recipient, setRecipient] = React.useState<any | null>(null);
  const [submissions, setSubmissions] = React.useState<any[]>([]);
  const [latestSubmission, setLatestSubmission] = React.useState<any | null>(
    null,
  );
  const [forceSelectLatestOnce, setForceSelectLatestOnce] =
    React.useState(false);
  const [selectedSubmissionId, setSelectedSubmissionId] = React.useState<
    number | null
  >(null);

  const [leftTab, setLeftTab] = React.useState<"comments" | "activity">(
    "comments",
  );
  const [rightTab, setRightTab] = React.useState<"example" | "submission">(
    "example",
  );

  const [messages, setMessages] = React.useState<DocumentRequestMessageRow[]>(
    [],
  );
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [postErr, setPostErr] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const [newMsgCount, setNewMsgCount] = React.useState(0);
  const prevMsgCountRef = React.useRef(0);
  const isFirstMsgLoadRef = React.useRef(true);

  const [activityLogs, setActivityLogs] = React.useState<any[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);

  const [examplePreviewUrl, setExamplePreviewUrl] = React.useState("");
  const [examplePreviewLoading, setExamplePreviewLoading] =
    React.useState(false);
  const [examplePreviewError, setExamplePreviewError] = React.useState<
    string | null
  >(null);

  const [submissionPreviewUrl, setSubmissionPreviewUrl] = React.useState("");
  const [submissionPreviewLoading, setSubmissionPreviewLoading] =
    React.useState(false);
  const [submissionPreviewError, setSubmissionPreviewError] = React.useState<
    string | null
  >(null);

  const [files, setFiles] = React.useState<File[]>([]);
  const [localPreviewUrl, setLocalPreviewUrl] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitMsg, setSubmitMsg] = React.useState<string | null>(null);
  const [submitErr, setSubmitErr] = React.useState<string | null>(null);

  const [previewModal, setPreviewModal] = React.useState<{
    url: string;
    filename?: string;
  } | null>(null);

  const [qaNote, setQaNote] = React.useState("");
  const [reviewing, setReviewing] = React.useState(false);
  const [reviewErr, setReviewErr] = React.useState<string | null>(null);
  const [reviewMsg, setReviewMsg] = React.useState<string | null>(null);

  // ── Edit panel (QA only) ───────────────────────────────────────────────────
  const [editOpen, setEditOpen] = React.useState(false);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");
  const [editDueAt, setEditDueAt] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editErr, setEditErr] = React.useState<string | null>(null);

  // ── Derived ────────────────────────────────────────────────────────────────
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

  const canSubmit = !isQa && req?.status === "open" && !!recipient?.id;
  const latestStatus = String(latestSubmission?.status ?? "");
  const hasLocalFile = files.length === 1 && !!localPreviewUrl;
  const showUploadArea =
    canSubmit &&
    (latestStatus === "rejected" || !latestSubmission) &&
    !hasLocalFile;
  const showLockNotice =
    canSubmit &&
    (latestStatus === "submitted" || latestStatus === "accepted") &&
    !hasLocalFile;
  const canQaReview =
    isQa &&
    !!selectedSubmission?.id &&
    String(selectedSubmission?.status) === "submitted";
  // QA/item-view: go back to batch; office recipient (multi-office): go back to list
  const backUrl =
    isQa || isItemView
      ? `/document-requests/${requestId}`
      : `/document-requests`;

  // Page title — item title for item view
  const pageTitle =
    isItemView && req?.item_title
      ? req.item_title
      : (req?.title ?? `Request #${requestId}`);

  // Effective due date — individual override > batch due
  const effectiveDueAt = isItemView
    ? (req?.item_due_at ?? req?.due_at ?? null)
    : (recipient?.due_at ?? req?.due_at ?? null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: any;
      if (isItemView) {
        data = await getDocumentRequestItem(requestId, itemId!);
      } else {
        data = await getDocumentRequestRecipient(requestId, recipientId!);
      }
      setReq(data.request);
      setRecipient(data.recipient ?? null);
      const latest = data.latest_submission ?? null;
      const hist = Array.isArray(data.submissions) ? data.submissions : [];
      setLatestSubmission(latest);
      setSubmissions(hist);
      setSelectedSubmissionId((prev) => {
        if (forceSelectLatestOnce) return latest?.id ? Number(latest.id) : null;
        if (prev) return prev;
        return latest?.id ? Number(latest.id) : null;
      });
      if (forceSelectLatestOnce) setForceSelectLatestOnce(false);
    } catch (e: any) {
      setError(
        e?.response?.data?.message ?? e?.message ?? "Failed to load request.",
      );
    } finally {
      setLoading(false);
    }
  }, [requestId, recipientId, itemId, isItemView, forceSelectLatestOnce]);

  React.useEffect(() => {
    load().catch(() => {});
  }, [load]);

  // Sync edit fields when data loads
  React.useEffect(() => {
    if (!req) return;
    if (isItemView) {
      setEditTitle(req.item_title ?? "");
      setEditDesc(req.item_description ?? "");
      setEditDueAt(req.item_due_at ? req.item_due_at.slice(0, 16) : "");
    } else {
      setEditDueAt(recipient?.due_at ? recipient.due_at.slice(0, 16) : "");
    }
  }, [req?.id, recipient?.id]);

  // ── Messages ───────────────────────────────────────────────────────────────
  const loadMessages = React.useCallback(async () => {
    setMessagesLoading(true);
    try {
      setMessages(await getDocumentRequestMessages(requestId));
    } catch {
      /* silent */
    } finally {
      setMessagesLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    loadMessages().catch(() => {});
  }, [loadMessages]);

  React.useEffect(() => {
    const interval = window.setInterval(async () => {
      await loadMessages().catch(() => {});
      if (isFirstMsgLoadRef.current) {
        isFirstMsgLoadRef.current = false;
        prevMsgCountRef.current = messages.length;
        return;
      }
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [loadMessages, messages.length]);

  React.useEffect(() => {
    if (isFirstMsgLoadRef.current) return;
    const n = messages.length - prevMsgCountRef.current;
    if (n > 0) setNewMsgCount((p) => p + n);
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Activity ───────────────────────────────────────────────────────────────
  const loadActivity = React.useCallback(async () => {
    if (leftTab !== "activity") return;
    setActivityLoading(true);
    try {
      const { default: api } = await import("../services/api");
      const res = await api.get("/activity", {
        params: { scope: "request", document_id: requestId, per_page: 50 },
      });
      setActivityLogs(res.data?.data ?? []);
    } catch {
      setActivityLogs([]);
    } finally {
      setActivityLoading(false);
    }
  }, [requestId, leftTab]);

  React.useEffect(() => {
    loadActivity().catch(() => {});
  }, [loadActivity]);

  // ── Example preview ────────────────────────────────────────────────────────
  const loadExamplePreview = React.useCallback(async () => {
    if (!req?.example_preview_path) {
      setExamplePreviewUrl("");
      return;
    }
    setExamplePreviewLoading(true);
    setExamplePreviewError(null);
    try {
      const url =
        isItemView && itemId
          ? (await getDocumentRequestItemExamplePreviewLink(itemId)).url
          : (await getDocumentRequestExamplePreviewLink(requestId)).url;
      setExamplePreviewUrl(url);
    } catch (e: any) {
      setExamplePreviewError(
        e?.response?.data?.message ?? "Failed to load preview.",
      );
    } finally {
      setExamplePreviewLoading(false);
    }
  }, [req?.example_preview_path, requestId, itemId, isItemView]);

  React.useEffect(() => {
    loadExamplePreview().catch(() => {});
  }, [loadExamplePreview]);

  // ── Submission preview ─────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!selectedFileId) {
      setSubmissionPreviewUrl("");
      return;
    }
    setSubmissionPreviewLoading(true);
    setSubmissionPreviewError(null);
    getDocumentRequestSubmissionFilePreviewLink(selectedFileId)
      .then((r) => setSubmissionPreviewUrl(r.url))
      .catch((e: any) =>
        setSubmissionPreviewError(
          e?.response?.data?.message ?? "Failed to load preview.",
        ),
      )
      .finally(() => setSubmissionPreviewLoading(false));
  }, [selectedFileId]);

  React.useEffect(() => {
    let url: string | null = null;
    if (files.length === 1) {
      url = URL.createObjectURL(files[0]);
      setLocalPreviewUrl(url);
    } else setLocalPreviewUrl("");
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [files]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSelectFiles = (picked: FileList | null) => {
    setSubmitMsg(null);
    setSubmitErr(null);
    const arr = picked ? Array.from(picked) : [];
    if (!arr.length) {
      setFiles([]);
      return;
    }
    if (arr.length > 1) {
      setFiles([]);
      setSubmitErr("Please upload only 1 file.");
      return;
    }
    if (arr[0].size > 10 * 1024 * 1024) {
      setFiles([]);
      setSubmitErr("File too large (max 10MB).");
      return;
    }
    setFiles(arr);
  };

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    setPostErr(null);
    try {
      const msg = await postDocumentRequestMessage(requestId, text);
      setMessages((prev) => [...prev, msg]);
      setCommentText("");
    } catch (e: any) {
      setPostErr(e?.response?.data?.message ?? "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  const submit = async () => {
    setSubmitting(true);
    setSubmitMsg(null);
    setSubmitErr(null);
    try {
      if (!recipient?.id) {
        setSubmitErr("Recipient record missing.");
        return;
      }
      if (!canSubmit) {
        setSubmitErr("Request is not open.");
        return;
      }
      if (!files.length) {
        setSubmitErr("Please attach a file.");
        return;
      }
      await submitDocumentRequestEvidence({
        request_id: requestId,
        recipient_id: Number(recipient.id),
        item_id: isItemView ? itemId : null,
        note: note.trim() || null,
        files,
      });
      setSubmitMsg("Submitted successfully.");
      setNote("");
      setFiles([]);
      setForceSelectLatestOnce(true);
      await load();
    } catch (e: any) {
      setSubmitErr(e?.response?.data?.message ?? "Submit failed.");
    } finally {
      setSubmitting(false);
    }
  };

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
        note: qaNote.trim() || null,
      });
      setReviewMsg(
        decision === "accepted"
          ? "Submission accepted."
          : "Submission rejected.",
      );
      setQaNote("");
      await load();
    } catch (e: any) {
      setReviewErr(e?.response?.data?.message ?? "Review failed.");
    } finally {
      setReviewing(false);
    }
  };

  const saveEdit = async () => {
    setEditSaving(true);
    setEditErr(null);
    try {
      if (isItemView) {
        await updateDocumentRequestItem(itemId!, {
          title: editTitle.trim() || undefined,
          description: editDesc.trim() || null,
          due_at: editDueAt || null,
        });
        setReq((prev: any) => ({
          ...prev,
          item_title: editTitle.trim() || prev.item_title,
          item_description: editDesc.trim() || null,
          item_due_at: editDueAt || null,
        }));
      } else {
        await updateDocumentRequestRecipient(requestId, recipientId!, {
          due_at: editDueAt || null,
        });
        setRecipient((prev: any) => ({ ...prev, due_at: editDueAt || null }));
      }
      setEditOpen(false);
    } catch (e: any) {
      setEditErr(e?.response?.data?.message ?? "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading && !req) {
    return (
      <PageFrame title="Document Request" onBack={() => navigate(backUrl)}>
        <div className="flex h-60 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Loading request…
            </span>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (error) {
    return (
      <PageFrame title="Document Request" onBack={() => navigate(backUrl)}>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          {error}
        </div>
      </PageFrame>
    );
  }

  if (!req) return null;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageFrame title={pageTitle} onBack={() => navigate(backUrl)}>
      <div className="grid h-full min-h-0 overflow-hidden grid-cols-1 gap-5 lg:grid-cols-12">
        {/* ── LEFT ── */}
        <section className="lg:col-span-7 min-w-0 flex flex-col gap-5">
          {/* Header + edit panel */}
          <div className="flex flex-col gap-0 rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
            <RequestHeaderCard
              requestId={requestId}
              req={{ ...req, due_at: effectiveDueAt }}
              recipient={recipient}
            />

            {/* Individual override bar */}
            {isQa && (
              <div className="flex items-center gap-3 px-5 py-2 border-t border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/40 text-[11px]">
                <span className="text-slate-400 dark:text-slate-500">
                  {isItemView ? "Item due:" : "Office due:"}
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {effectiveDueAt
                    ? new Date(effectiveDueAt).toLocaleDateString(undefined, {
                        dateStyle: "medium",
                      })
                    : "—"}
                </span>
                {effectiveDueAt !== req.due_at && (
                  <span className="text-amber-500 dark:text-amber-400 text-[10px]">
                    (override)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setEditOpen((o) => !o)}
                  className="ml-auto flex items-center gap-1 text-slate-400 hover:text-brand-500 dark:hover:text-brand-400 transition"
                >
                  <Pencil className="h-3 w-3" />
                  {editOpen ? "Close" : "Edit"}
                </button>
              </div>
            )}

            {/* Edit panel */}
            {isQa && editOpen && (
              <div className="px-5 py-4 border-t border-slate-100 dark:border-surface-400 flex flex-col gap-3 bg-slate-50/30 dark:bg-surface-600/30">
                {isItemView && (
                  <>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Item title
                      </label>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Item description
                      </label>
                      <textarea
                        rows={2}
                        value={editDesc}
                        onChange={(e) => setEditDesc(e.target.value)}
                        placeholder="Instructions for this document…"
                        className={inputCls}
                      />
                    </div>
                  </>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {isItemView
                      ? "Item due date override"
                      : "Office due date override"}
                  </label>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">
                    Batch due:{" "}
                    {req.due_at
                      ? new Date(req.due_at).toLocaleDateString(undefined, {
                          dateStyle: "medium",
                        })
                      : "—"}
                  </p>
                  <input
                    type="datetime-local"
                    value={editDueAt}
                    onChange={(e) => setEditDueAt(e.target.value)}
                    className={inputCls}
                  />
                </div>
                {editErr && (
                  <p className="text-xs text-rose-600 dark:text-rose-400">
                    {editErr}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditOpen(false);
                      setEditErr(null);
                    }}
                    className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={saveEdit}
                    disabled={editSaving}
                    className="rounded-lg bg-brand-500 hover:bg-brand-600 disabled:opacity-50 px-3 py-1.5 text-xs font-semibold text-white transition"
                  >
                    {editSaving ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Comments + Activity */}
          <div
            className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-surface-400 dark:bg-surface-500"
            style={{ height: "390px" }}
          >
            <TabBar
              tabs={[
                {
                  value: "comments" as const,
                  label: "Comments",
                  icon: <MessageSquare size={12} />,
                },
                {
                  value: "activity" as const,
                  label: "Activity",
                  icon: <Activity size={12} />,
                },
              ]}
              active={leftTab}
              onChange={setLeftTab}
              badge={{
                comments: messages.length > 0 ? messages.length : undefined,
              }}
            />
            {leftTab === "comments" ? (
              <RequestCommentsPanel
                messages={messages}
                loading={messagesLoading}
                myUserId={myUserId}
                commentText={commentText}
                posting={posting}
                postErr={postErr}
                messagesEndRef={messagesEndRef}
                onCommentChange={setCommentText}
                onPost={postComment}
                newMessageCount={newMsgCount}
                onClearNewMessages={() => setNewMsgCount(0)}
              />
            ) : (
              <RequestActivityPanel
                logs={activityLogs}
                loading={activityLoading}
              />
            )}
          </div>
        </section>

        {/* ── RIGHT ── */}
        <aside className="lg:col-span-5 flex flex-col min-h-0 overflow-hidden">
          <div className="flex flex-1 flex-col min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-surface-400 dark:bg-surface-500">
            <TabBar
              tabs={[
                { value: "example" as const, label: "Example" },
                { value: "submission" as const, label: "Submission" },
              ]}
              active={rightTab}
              onChange={setRightTab}
            />
            <div className="flex flex-1 flex-col min-h-0 overflow-y-auto p-4 gap-3">
              {rightTab === "example" ? (
                <RequestExampleTab
                  req={req}
                  examplePreviewUrl={examplePreviewUrl}
                  examplePreviewLoading={examplePreviewLoading}
                  examplePreviewError={examplePreviewError}
                  onRefresh={loadExamplePreview}
                  onViewModal={() =>
                    setPreviewModal({
                      url: examplePreviewUrl,
                      filename: req.example_original_filename,
                    })
                  }
                />
              ) : (
                <RequestSubmissionTab
                  isQa={isQa}
                  req={req}
                  submissions={submissions}
                  selectedSubmission={selectedSubmission}
                  selectedSubmissionId={selectedSubmissionId}
                  selectedFileId={selectedFileId}
                  onSelectSubmission={setSelectedSubmissionId}
                  qaNote={qaNote}
                  reviewing={reviewing}
                  reviewErr={reviewErr}
                  reviewMsg={reviewMsg}
                  canQaReview={canQaReview}
                  onQaNoteChange={setQaNote}
                  onQaReview={qaReview}
                  hasExample={!!(isItemView ? req.item_example_preview_path : req.example_preview_path)}
                  onDownloadExample={async () => {
                    const win = window.open("about:blank", "_blank");
                    try {
                      const res = isItemView && itemId
                        ? await getDocumentRequestItemExampleDownloadLink(itemId)
                        : await getDocumentRequestExampleDownloadLink(requestId);
                      if (win) win.location.href = res.url;
                    } catch { if (win) win.close(); }
                  }}
                  files={files}
                  localPreviewUrl={localPreviewUrl}
                  hasLocalFile={hasLocalFile}
                  showUploadArea={showUploadArea}
                  showLockNotice={showLockNotice}
                  canSubmit={canSubmit}
                  note={note}
                  submitting={submitting}
                  submitMsg={submitMsg}
                  submitErr={submitErr}
                  onNoteChange={setNote}
                  onSelectFiles={handleSelectFiles}
                  onRemoveFile={() => setFiles([])}
                  onSubmit={submit}
                  submissionPreviewUrl={submissionPreviewUrl}
                  submissionPreviewLoading={submissionPreviewLoading}
                  submissionPreviewError={submissionPreviewError}
                  onViewModal={(url, filename) =>
                    setPreviewModal({ url, filename })
                  }
                />
              )}
            </div>
          </div>
        </aside>
      </div>

      {previewModal && (
        <RequestPreviewModal
          url={previewModal.url}
          filename={previewModal.filename}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </PageFrame>
  );
}
