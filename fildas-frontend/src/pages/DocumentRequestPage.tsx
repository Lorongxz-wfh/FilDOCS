import React from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  Link,
} from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";

import { getAuthUser } from "../lib/auth";
import { isAdmin } from "../lib/roleFilters";
import { useAdminDebugMode } from "../hooks/useAdminDebugMode";
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
import { MessageSquare, Activity, Megaphone } from "lucide-react";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import { useRealtimeUpdates } from "../hooks/useRealtimeUpdates";
import { roleLower, TabBar } from "../components/documentRequests/shared";
import RequestHeaderCard from "../components/documentRequests/RequestHeaderCard";
import RequestCommentsPanel from "../components/documentRequests/RequestCommentsPanel";
import RequestActivityPanel from "../components/documentRequests/RequestActivityPanel";
import RequestExampleTab from "../components/documentRequests/RequestExampleTab";
import RequestSubmissionTab from "../components/documentRequests/RequestSubmissionTab";
import RequestPreviewModal from "../components/documentRequests/RequestPreviewModal";

import { inputCls } from "../utils/formStyles";
import { useToast } from "../components/ui/toast/ToastContext";

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
  const adminDebugMode = useAdminDebugMode();
  const isAdminUser = isAdmin(me.role as any);
  const isQa = role === "qa" || isAdminUser;
  const myUserId = Number(me?.id ?? 0);
  const toast = useToast();

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
  // For multi-office recipient view: private vs broadcast thread
  const [commentThread, setCommentThread] = React.useState<
    "private" | "broadcast"
  >("private");
  const [broadcastUnread, setBroadcastUnread] = React.useState(0);
  const [privateUnread, setPrivateUnread] = React.useState(0);
  const prevBroadcastCountRef = React.useRef(0);
  const prevPrivateCountRef = React.useRef(0);
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

  const [refreshing, setRefreshing] = React.useState(false);

  const msgCountRef = React.useRef(messages.length);
  React.useEffect(() => {
    msgCountRef.current = messages.length;
  }, [messages.length]);

  const handleRefresh = async (): Promise<string | false> => {
    setRefreshing(true);
    const before = msgCountRef.current;
    try {
      await Promise.all([load(), loadMessages()]);
      const after = msgCountRef.current;
      const diff = after - before;
      if (diff > 0)
        return `${diff} new message${diff === 1 ? "" : "s"} received.`;
      return "Already up to date.";
    } catch {
      throw new Error("Refresh failed.");
    } finally {
      setRefreshing(false);
    }
  };

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

  // ── Logic: Requester (Reviewer) vs. Requestee (Submitter) ──
  // A Requester is the user who created the request.
  const isRequester = me.id === Number(req?.created_by_user_id);

  // A Requestee is the office who received the request.
  const isRequestee =
    (me.office_id && Number(me.office_id) === Number(recipient?.office_id)) ||
    (isQa && String(recipient?.office_code || "").toUpperCase() === "QA");

  // Privileged user (can override in debug mode)
  const isPrivileged = isQa || isAdminUser;
  const canDebug = isPrivileged && adminDebugMode;

  // Final roles
  const isReviewer = isRequester || canDebug;
  const isSubmitter = isRequestee || canDebug;


  // canSubmit: Strictly for the designated submitter (or privileged override)
  const canSubmit =
    (isSubmitter || canDebug) && req?.status === "open" && !!recipient?.id;

  const latestStatus = String(latestSubmission?.status ?? "");
  const hasLocalFile = files.length === 1 && !!localPreviewUrl;
  const showUploadArea =
    canSubmit &&
    (latestStatus === "rejected" || !latestSubmission) &&
    !hasLocalFile;


  // canReview: Strictly for the requester (or privileged override)
  const canReview =
    (isReviewer || canDebug) &&
    !!selectedSubmission?.id &&
    String(selectedSubmission?.status) === "submitted";

  // canManage: Ability to edit titles/due dates/cancel
  const canManage = isReviewer || canDebug;

  // Unused warning cleanup
  if (isSubmitter && !isSubmitter) console.log(isSubmitter);

  // QA/item-view: go back to batch; office recipient (multi-office): go back to list
  const backUrl =
    isQa || isItemView
      ? `/document-requests/${requestId}`
      : `/document-requests`;

  // Effective due date — individual override > batch due
  const effectiveDueAt = isItemView
    ? (req?.item_due_at ?? req?.due_at ?? null)
    : (recipient?.due_at ?? req?.due_at ?? null);

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
    }
  }, [requestId, recipientId, itemId, isItemView, forceSelectLatestOnce]);

  React.useEffect(() => {
    load().catch(() => { });
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
  // Scope: item view → item thread, recipient view → private or broadcast
  const messageScope = React.useMemo(() => {
    if (isItemView) return { item_id: itemId! };
    if (recipientId) {
      return commentThread === "broadcast"
        ? { thread: "batch" as const }
        : { recipient_id: recipientId };
    }
    return { thread: "batch" as const };
  }, [isItemView, itemId, recipientId, commentThread]);

  const loadMessages = React.useCallback(async () => {
    setMessagesLoading(true);
    try {
      setMessages(await getDocumentRequestMessages(requestId, messageScope));
    } catch {
      /* silent */
    } finally {
      setMessagesLoading(false);
    }
  }, [requestId, messageScope]);

  React.useEffect(() => {
    loadMessages().catch(() => { });
  }, [loadMessages]);

  React.useEffect(() => {
    let tick = 0;
    const interval = window.setInterval(async () => {
      tick++;
      // Poll messages every 10s
      await loadMessages().catch(() => { });
      
      // Poll full request state every 3 cycles (30s)
      if (tick % 3 === 0) {
        await load(true).catch(() => { });
        await loadActivity(true).catch(() => { });
      }

      if (isFirstMsgLoadRef.current) {
        isFirstMsgLoadRef.current = false;
        prevMsgCountRef.current = messages.length;
        return;
      }
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [load, loadMessages, loadActivity]);

  // Poll inactive thread for unread indicator — recipient multi-office only
  React.useEffect(() => {
    if (isItemView || !recipientId || isQa) return;
    const pollInactive = async () => {
      try {
        const inactiveScope =
          commentThread === "private"
            ? { thread: "batch" as const }
            : { recipient_id: recipientId };
        const msgs = await getDocumentRequestMessages(requestId, inactiveScope);
        const count = msgs.length;
        if (commentThread === "private") {
          const prev = prevBroadcastCountRef.current;
          if (prev > 0 && count > prev)
            setBroadcastUnread((u) => u + (count - prev));
          prevBroadcastCountRef.current = count;
        } else {
          const prev = prevPrivateCountRef.current;
          if (prev > 0 && count > prev)
            setPrivateUnread((u) => u + (count - prev));
          prevPrivateCountRef.current = count;
        }
      } catch {
        /* silent */
      }
    };
    pollInactive();
    const id = window.setInterval(pollInactive, 15_000);
    return () => window.clearInterval(id);
  }, [requestId, recipientId, isQa, isItemView, commentThread]);

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
  const loadActivity = React.useCallback(async (silent = false) => {
    if (leftTab !== "activity") return;
    if (!silent) setActivityLoading(true);
    try {
      const { default: api } = await import("../services/api");
      const res = await api.get("/activity", {
        params: { scope: "request", request_id: requestId, per_page: 50 },
      });
      setActivityLogs(res.data?.data ?? []);
    } catch {
      setActivityLogs([]);
    } finally {
      if (!silent) setActivityLoading(false);
    }
  }, [requestId, leftTab]);

  React.useEffect(() => {
    loadActivity().catch(() => { });
  }, [loadActivity]);

  // ── Realtime: instant updates via Pusher ───────────────────────────────
  useRealtimeUpdates({
    requestId,
    onRequestMessage: React.useCallback(
      (msg: any) => {
        const msgRecipientId = msg.recipient_id ? Number(msg.recipient_id) : null;
        const msgItemId = msg.item_id ? Number(msg.item_id) : null;

        let isForCurrentThread = false;

        if (isItemView) {
          isForCurrentThread = msgItemId === itemId;
        } else {
          if (commentThread === "broadcast") {
            isForCurrentThread = msgRecipientId === null;
          } else {
            isForCurrentThread = msgRecipientId === recipientId;
          }
        }

        if (isForCurrentThread) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        } else if (!isQa) {
          // Update unread counts for inactive thread (Office only)
          if (msgRecipientId === null) {
            setBroadcastUnread((u) => u + 1);
          } else if (msgRecipientId === recipientId) {
            setPrivateUnread((u) => u + 1);
          }
        }
      },
      [isItemView, itemId, recipientId, commentThread, isQa],
    ),
    onWorkspaceChange: React.useCallback(() => {
      load(true).catch(() => { });
      loadActivity(true).catch(() => { });
    }, [load, loadActivity]),
    onWorkflowUpdate: React.useCallback(() => {
      load(true).catch(() => { });
      loadActivity(true).catch(() => { });
    }, [load, loadActivity]),
  });

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
    loadExamplePreview().catch(() => { });
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
      const msg = await postDocumentRequestMessage(
        requestId,
        text,
        messageScope,
      );
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
    try {
      if (!selectedSubmission?.id) {
        toast.push({ type: "error", message: "No submission selected." });
        return;
      }
      await reviewDocumentRequestSubmission({
        submission_id: Number(selectedSubmission.id),
        decision,
        note: qaNote.trim() || null,
      });
      toast.push({
        type: "success",
        message: decision === "accepted" ? "Submission accepted." : "Submission rejected.",
      });
      setQaNote("");
      await load();
    } catch (e: any) {
      toast.push({ type: "error", message: e?.response?.data?.message ?? "Review failed." });
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
    <PageFrame
      title={
        <>
          <Link
            to={`/document-requests/${requestId}`}
            className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 font-semibold transition-colors"
          >
            {req.title ?? `Request #${requestId}`}
          </Link>
          <span className="mx-1.5 text-slate-300 dark:text-slate-600 font-normal select-none">›</span>
          {req.item_title ?? recipient?.office_name ?? "—"}
        </>
      }
      onBack={() => navigate(backUrl)}
      breadcrumbs={[{ label: "Batch", to: "/document-requests" }]}
      fullHeight
      right={
        <PageActions>
          <RefreshAction
            onRefresh={handleRefresh}
            loading={refreshing || loading}
          />
        </PageActions>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:h-full min-h-0 p-4 sm:p-5">
        {/* ── LEFT ── */}
        <section className="lg:col-span-7 min-w-0 flex flex-col gap-5 lg:h-full lg:overflow-hidden">
          {/* Header + edit panel */}
          <div className="flex flex-col rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
            <RequestHeaderCard
              req={req}
              recipient={recipient}
              canManage={canManage}
              isItemView={isItemView}
              effectiveDueAt={effectiveDueAt}
              editOpen={editOpen}
              editTitle={editTitle}
              editDesc={editDesc}
              editDueAt={editDueAt}
              editSaving={editSaving}
              editErr={editErr}
              inputCls={inputCls}
              onEditToggle={() => setEditOpen((o) => !o)}
              onEditTitleChange={setEditTitle}
              onEditDescChange={setEditDesc}
              onEditDueAtChange={setEditDueAt}
              onEditSave={saveEdit}
              onEditCancel={() => { setEditOpen(false); setEditErr(null); }}
            />
          </div>

          {/* Comments + Activity - Mobile Accordion Style */}
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden dark:border-surface-400 dark:bg-surface-500 flex-1 lg:min-h-0 lg:h-125">
            <div className="shrink-0 flex items-center justify-between bg-slate-50/50 dark:bg-surface-600/50 pr-2">
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
            </div>
            <div className="flex flex-col flex-1 min-h-75 lg:min-h-0 overflow-hidden">
              {leftTab === "comments" ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Private / Broadcast thread switcher — only visible if not an item view */}
                  {!isItemView && recipientId && (
                    <div className="shrink-0 border-b border-slate-100 dark:border-surface-400 px-3 py-2 flex flex-col gap-2">
                      {/* Tab row */}
                      <div className="flex items-center gap-1 justify-between">
                        <div className="flex items-center gap-1">
                          {(["private", "broadcast"] as const).map((t) => {
                            const isActive = commentThread === t;
                            const hasNew =
                              t === commentThread
                                ? newMsgCount > 0
                                : t === "broadcast"
                                  ? broadcastUnread > 0
                                  : privateUnread > 0;
                            const badgeCount =
                              t === commentThread
                                ? newMsgCount
                                : t === "broadcast"
                                  ? broadcastUnread
                                  : privateUnread;
                            return (
                              <button
                                key={t}
                                type="button"
                                onClick={() => {
                                  setCommentThread(t);
                                  setMessages([]);
                                  setNewMsgCount(0);
                                  if (t === "broadcast") setBroadcastUnread(0);
                                  if (t === "private") setPrivateUnread(0);
                                }}
                                className={`relative flex items-center gap-1.5 rounded px-2.5 py-1.5 text-[11px] font-medium transition-colors ${isActive
                                    ? "bg-brand-500 text-white"
                                    : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400"
                                  }`}
                              >
                                {t === "broadcast" ? (
                                  <Megaphone className="h-3 w-3 shrink-0" />
                                ) : (
                                  <MessageSquare className="h-3 w-3 shrink-0" />
                                )}
                                {t === "private" ? "Private" : "Broadcast"}
                                {hasNew && (
                                  <span className="inline-flex items-center justify-center h-3.5 min-w-3.5 px-1 rounded-full bg-rose-500 text-[9px] font-bold text-white leading-none">
                                    {badgeCount > 9 ? "9+" : badgeCount}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Broadcast info banner */}
                      {commentThread === "broadcast" && (
                        <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 dark:border-amber-800/50 dark:bg-amber-950/20">
                          <Megaphone className="h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-tight">
                            Announcements from the requester to all offices — read only
                          </p>
                        </div>
                      )}
                    </div>
                  )}

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
                    readOnly={
                      !isReviewer && commentThread === "broadcast"
                    }
                    readOnlyLabel="This broadcast thread is for announcements from the requester only."
                  />
                </div>
              ) : (
                <RequestActivityPanel
                  logs={activityLogs}
                  loading={activityLoading}
                />
              )}
            </div>
          </div>
        </section>

        {/* ── RIGHT ── */}
        <aside className="lg:col-span-5 flex flex-col lg:min-h-0 lg:overflow-hidden">
          <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-surface-400 dark:bg-surface-500">
            <TabBar
              tabs={[
                { value: "example" as const, label: "Example" },
                { value: "submission" as const, label: "Submission" },
              ]}
              active={rightTab}
              onChange={setRightTab}
            />
            <div className="flex flex-1 flex-col min-h-0 overflow-hidden p-4 gap-3">
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
                isReviewer={isReviewer}
                isSubmitter={isSubmitter}
                req={req}
                submissions={submissions}
                  selectedSubmission={selectedSubmission}
                  selectedSubmissionId={selectedSubmissionId}
                  selectedFileId={selectedFileId}
                  onSelectSubmission={setSelectedSubmissionId}
                  qaNote={qaNote}
                  reviewing={reviewing}
                  canReview={canReview}
                  onQaNoteChange={setQaNote}
                  onQaReview={qaReview}
                  hasExample={!!(isItemView ? req.item_example_file_path : req.example_file_path)}
                  onDownloadExample={async () => {
                    const win = window.open("about:blank", "_blank");
                    try {
                      const res =
                        isItemView && itemId
                          ? await getDocumentRequestItemExampleDownloadLink(
                            itemId,
                          )
                          : await getDocumentRequestExampleDownloadLink(
                            requestId,
                          );
                      if (win) win.location.href = res.url;
                    } catch {
                      if (win) win.close();
                    }
                  }}
                  files={files}
                  localPreviewUrl={localPreviewUrl}
                  hasLocalFile={hasLocalFile}
                  showUploadArea={showUploadArea}

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
