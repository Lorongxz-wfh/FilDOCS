import React from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import Button from "../../components/ui/Button";
import { motion } from "framer-motion";
import { getAuthUser } from "../../lib/auth";
import { isAdmin } from "../../lib/roleFilters";
import { useAdminDebugMode } from "../../hooks/useAdminDebugMode";
import {
  getDocumentRequest,
  updateDocumentRequest,
  updateDocumentRequestStatus,
  type DocumentRequestItemRow,
} from "../../services/documentRequests";
import {
  Users,
  FileStack,
  Ban,
  Check,
  Pencil,
  AlertTriangle,
  MessageSquare,
  Clock,
  Loader2,
  Activity,
} from "lucide-react";
import { PageActions } from "../../components/ui/PageActions";
import { useRefresh } from "../../lib/RefreshContext";
import { useRealtimeUpdates } from "../../hooks/useRealtimeUpdates";
import {
  roleLower,
  StatusBadge,
  TabBar,
} from "../../components/documentRequests/shared";
import RequestActivityPanel from "../../components/documentRequests/RequestActivityPanel";
import RequestCommentsPanel from "../../components/documentRequests/RequestCommentsPanel";
import RequestPreviewModal from "../../components/documentRequests/RequestPreviewModal";
import InlineEditField from "../../components/documentRequests/InlineEditField";
import RequestProgressBar from "../../components/documentRequests/RequestProgressBar";
import { inputCls } from "../../utils/formStyles";
import {
  getDocumentRequestMessages,
  postDocumentRequestMessage,
  type DocumentRequestMessageRow,
} from "../../services/documentRequests";
import Skeleton from "../../components/ui/loader/Skeleton";

const RequestBatchSkeleton: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <PageFrame title="Document Request" onBack={onBack}>
    <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 lg:h-full min-h-0 p-4 sm:p-5 bg-slate-50 dark:bg-surface-600">
      <section className="lg:col-span-7 flex flex-col gap-4">
        {/* Header Skeleton */}
        <div className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <div className="flex items-center gap-4 pt-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Progress Skeleton */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 p-5 space-y-4">
          <Skeleton className="h-3 w-32" />
          <div className="space-y-3">
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="flex justify-between">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>

        {/* List Skeleton */}
        <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
          <div className="h-10 bg-slate-50/80 dark:bg-surface-600/80 border-b border-slate-200 dark:border-surface-400 px-4 flex items-center">
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y divide-slate-100 dark:divide-surface-400">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="lg:col-span-5 flex flex-col gap-4">
        <div className="flex-1 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col">
          <div className="flex border-b border-slate-100 dark:border-surface-400">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-10 w-1/2" />
          </div>
          <div className="p-5 flex-1 space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="flex justify-between">
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="h-2.5 w-12" />
                  </div>
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  </PageFrame>
);

export default function RequestBatchPage() {
  const navigate = useNavigate();
  const params = useParams();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const requestId = Number(params.id);
  if (!Number.isFinite(requestId) || requestId <= 0)
    return <Navigate to="/dashboard" replace />;

  const role = roleLower(me);
  const adminDebugMode = useAdminDebugMode();
  const isAdminUser = isAdmin(me.role as any);
  const isQa = role === "qa" || isAdminUser;

  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [req, setReq] = React.useState<any | null>(null);
  const [recipients, setRecipients] = React.useState<any[]>([]);
  const [items, setItems] = React.useState<DocumentRequestItemRow[]>([]);
  const [activityLogs, setActivityLogs] = React.useState<any[]>([]);
  const [activityLoading, setActivityLoading] = React.useState(false);

  // ── Logic: Requester (Reviewer) vs. Requestee (Submitter) ──
  const isRequester = me.id === Number(req?.created_by_user_id);
  const isRequestee =
    recipients.some((r) => Number(r.office_id) === Number(me?.office_id)) ||
    (isQa && recipients.some((r) => r.office_code === "QA"));

  const isPrivileged = isQa || isAdminUser;
  const canDebug = isPrivileged && adminDebugMode;

  const isReviewer = isRequester || (canDebug && !isRequestee);


  const canManage = isReviewer || canDebug;

  // ── Right panel tabs + comments ────────────────────────────────────────────
  const [rightTab, setRightTab] = React.useState<"comments" | "activity">(
    "comments",
  );

  const [activeRecipientId, setActiveRecipientId] = React.useState<
    number | null
  >(null);

  React.useEffect(() => {
    if (!isMultiDoc && recipients.length > 0 && activeRecipientId !== null)
      return;
    setActiveRecipientId(null);
  }, [req?.id]);

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
  const myUserId = Number(getAuthUser()?.id ?? 0);

  const [previewModal, setPreviewModal] = React.useState<{
    url: string;
    filename?: string;
  } | null>(null);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editDesc, setEditDesc] = React.useState("");
  const [editDueAt, setEditDueAt] = React.useState("");
  const [editSaving, setEditSaving] = React.useState(false);
  const [editErr, setEditErr] = React.useState<string | null>(null);

  const isMultiDoc = req?.mode === "multi_doc";

  // ── Load ───────────────────────────────────────────────────────────────────
  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await getDocumentRequest(requestId);
      setReq(data.request);
      setRecipients(data.recipients ?? []);
      setItems(data.items ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? e?.message ?? "Failed to load.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    load().catch(() => { });
  }, [load]);

  React.useEffect(() => {
    const id = window.setInterval(() => {
      load(true).catch(() => { });
    }, 15_000);
    return () => window.clearInterval(id);
  }, [load]);

  const prevProgressRef = React.useRef<string>("");

  const handleRefresh = React.useCallback(async (): Promise<string | false> => {
    const prevProgress = prevProgressRef.current;
    try {
      await load();
      const nextProgress = `${req?.progress?.submitted ?? 0}-${req?.progress?.accepted ?? 0}`;
      prevProgressRef.current = nextProgress;
      if (!prevProgress) return false;
      return nextProgress !== prevProgress
        ? "Request progress updated."
        : "Already up to date.";
    } catch {
      throw new Error("Refresh failed.");
    }
  }, [load, req?.progress]);

  const { refreshKey } = useRefresh();
  const initialMountRef = React.useRef(true);

  React.useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    handleRefresh();
  }, [refreshKey, handleRefresh]);

  const [mobileTab, setMobileTab] = React.useState<"items" | "discussion">("items");

  const [statusUpdating, setStatusUpdating] = React.useState(false);
  const [confirmModal, setConfirmModal] = React.useState<{
    status: "closed" | "cancelled";
    label: string;
  } | null>(null);

  const handleStatusChange = React.useCallback(
    (status: "closed" | "cancelled") => {
      setConfirmModal({
        status,
        label: status === "closed" ? "close" : "cancel",
      });
    },
    [],
  );

  const handleConfirmStatus = React.useCallback(async () => {
    if (!confirmModal) return;
    const { status, label } = confirmModal;
    setConfirmModal(null);
    setStatusUpdating(true);
    try {
      await updateDocumentRequestStatus(requestId!, status);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.message ?? `Failed to ${label} request.`);
    } finally {
      setStatusUpdating(false);
    }
  }, [confirmModal, requestId, load]);

  React.useEffect(() => {
    if (!req) return;
    setEditDesc(req.description ?? "");
    setEditDueAt(req.due_at ? req.due_at.slice(0, 16) : "");
  }, [req?.id]);

  const loadActivity = React.useCallback(async (silent = false) => {
    if (!silent) setActivityLoading(true);
    try {
      const { default: api } = await import("../../services/api");
      const res = await api.get("/activity", {
        params: { scope: "request", request_id: requestId, per_page: 50 },
      });
      setActivityLogs(res.data?.data ?? []);
    } catch {
      setActivityLogs([]);
    } finally {
      if (!silent) setActivityLoading(false);
    }
  }, [requestId]);

  React.useEffect(() => {
    loadActivity().catch(() => { });
  }, [loadActivity]);

  const messageScope = React.useMemo(() => {
    if (isMultiDoc) return { thread: "batch" as const };
    if (activeRecipientId) return { recipient_id: activeRecipientId };
    return { thread: "batch" as const };
  }, [isMultiDoc, activeRecipientId]);

  const loadMessages = React.useCallback(async (silent = false) => {
    if (!silent) setMessagesLoading(true);
    try {
      setMessages(await getDocumentRequestMessages(requestId, messageScope));
    } catch {
      /* silent */
    } finally {
      if (!silent) setMessagesLoading(false);
    }
  }, [requestId, messageScope]);

  React.useEffect(() => {
    loadMessages().catch(() => { });
  }, [loadMessages]);

  React.useEffect(() => {
    if (rightTab !== "comments") return;
    const id = window.setInterval(() => loadMessages(true).catch(() => { }), 10_000);
    return () => window.clearInterval(id);
  }, [loadMessages, rightTab]);

  useRealtimeUpdates({
    requestId,
    onRequestMessage: React.useCallback(
      (msg: any) => {
        const msgRecipientId = msg.recipient_id ? Number(msg.recipient_id) : null;
        const msgItemId = msg.item_id ? Number(msg.item_id) : null;
        const isForActiveThread = activeRecipientId === msgRecipientId && msgItemId === null;
        if (isForActiveThread) {
          setMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      },
      [activeRecipientId],
    ),
    onWorkspaceChange: React.useCallback(() => {
      load(true).catch(() => {});
      loadActivity(true).catch(() => {});
    }, [load, loadActivity]),
    onWorkflowUpdate: React.useCallback(() => {
      load(true).catch(() => {});
      loadActivity(true).catch(() => {});
    }, [load, loadActivity]),
  });

  React.useEffect(() => {
    if (isFirstMsgLoadRef.current) {
      isFirstMsgLoadRef.current = false;
      prevMsgCountRef.current = messages.length;
      return;
    }
    const n = messages.length - prevMsgCountRef.current;
    if (n > 0) setNewMsgCount((p) => p + n);
    prevMsgCountRef.current = messages.length;
  }, [messages.length]);

  React.useEffect(() => {
    setMessages([]);
    isFirstMsgLoadRef.current = true;
    prevMsgCountRef.current = 0;
    setNewMsgCount(0);
  }, [activeRecipientId]);

  const postComment = async () => {
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    setPostErr(null);
    try {
      const msg = await postDocumentRequestMessage(requestId, text, messageScope);
      setMessages((prev) => [...prev, msg]);
      setCommentText("");
    } catch (e: any) {
      setPostErr(e?.response?.data?.message ?? "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  const saveTitle = async (title: string) => {
    await updateDocumentRequest(requestId, { title });
    setReq((prev: any) => ({ ...prev, title }));
  };

  const saveDetails = async () => {
    setEditSaving(true);
    setEditErr(null);
    try {
      await updateDocumentRequest(requestId, {
        description: editDesc.trim() || null,
        due_at: editDueAt || null,
      });
      setReq((prev: any) => ({
        ...prev,
        description: editDesc.trim() || null,
        due_at: editDueAt || null,
      }));
      setEditOpen(false);
    } catch (e: any) {
      setEditErr(e?.response?.data?.message ?? "Failed to save.");
    } finally {
      setEditSaving(false);
    }
  };

  if (loading && !req) {
    return (
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-1 flex-col min-h-0 min-w-0"
      >
        <RequestBatchSkeleton onBack={() => navigate("/document-requests")} />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        className="flex flex-1 flex-col min-h-0 min-w-0"
      >
        <PageFrame title="Document Request" onBack={() => navigate("/document-requests")}>
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-medium text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
            {error}
          </div>
        </PageFrame>
      </motion.div>
    );
  }

  if (!req) return null;

  const statusColor: Record<string, string> = {
    pending: "text-amber-600 dark:text-amber-400",
    submitted: "text-sky-600 dark:text-sky-400",
    accepted: "text-emerald-600 dark:text-emerald-400",
    rejected: "text-rose-600 dark:text-rose-400",
  };

  return (
    <motion.div
      initial={{ x: 40, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
      className="flex flex-1 flex-col min-h-0 min-w-0"
    >
      <PageFrame
        title={req.title ?? `Request #${requestId}`}
        onBack={() => navigate("/document-requests")}
        breadcrumbs={[{ label: "Batch", to: "/document-requests" }]}
        fullHeight
        right={
          <PageActions>
            {canManage && req?.status === "open" && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  responsive
                  onClick={() => handleStatusChange("closed")}
                  disabled={statusUpdating}
                >
                  {statusUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span>Close</span>
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  responsive
                  onClick={() => handleStatusChange("cancelled")}
                  disabled={statusUpdating}
                >
                  {statusUpdating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Ban className="h-3.5 w-3.5" />
                  )}
                  <span>Cancel</span>
                </Button>
              </>
            )}
          </PageActions>
        }
      >
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-5 lg:h-full min-h-0 p-4 sm:p-5">
          <div className="lg:hidden shrink-0">
            <TabBar
              tabs={[
                { value: "items", label: "Request Items", icon: <FileStack size={12} /> },
                { value: "discussion", label: "Comments & Activity", icon: <MessageSquare size={12} /> },
              ]}
              active={mobileTab}
              onChange={(v: any) => setMobileTab(v)}
            />
          </div>

          <section className={`lg:col-span-7 min-w-0 flex flex-col gap-4 ${mobileTab !== "items" ? "hidden lg:flex" : "flex"}`}>
            <div className="rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                {canManage ? (
                  <InlineEditField
                    value={req.title ?? ""}
                    onSave={saveTitle}
                    className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100"
                  />
                ) : (
                  <h1 className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                    {req.title}
                  </h1>
                )}
                <StatusBadge status={req.status} />
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 px-2 py-0.5 text-xs text-slate-500 dark:text-slate-400 shrink-0">
                  {isMultiDoc ? <FileStack className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                  {isMultiDoc ? "Multi-Doc" : "Multi-Office"}
                </span>
              </div>

              {editOpen && canManage && (
                <div className="px-5 pb-3">
                  <textarea
                    rows={2}
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    placeholder="Add instructions for recipients…"
                    className={`w-full resize-none ${inputCls}`}
                  />
                </div>
              )}
              {req.description && !editOpen && (
                <div className="px-5 pb-3">
                  <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">{req.description}</p>
                </div>
              )}

              <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 dark:border-surface-400 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Clock size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">Due</span>
                  {editOpen && canManage ? (
                    <input
                      type="datetime-local"
                      value={editDueAt}
                      onChange={(e) => setEditDueAt(e.target.value)}
                      className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2 py-1 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-slate-400 transition"
                    />
                  ) : (
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                      {req.due_at ? new Date(req.due_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                    </span>
                  )}
                </div>
                <span className="text-slate-200 dark:text-surface-400">·</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400 dark:text-slate-500">Created</span>
                  <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {req.created_at ? new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—"}
                  </span>
                </div>
                {canManage && (
                  <div className="ml-auto flex items-center gap-2">
                    {editOpen ? (
                      <>
                        {editErr && <span className="text-xs text-red-500">{editErr}</span>}
                        <Button variant="outline" size="xs" onClick={() => { setEditOpen(false); setEditErr(null); }}>Cancel</Button>
                        <Button variant="primary" size="xs" onClick={saveDetails} loading={editSaving}>Save</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="xs" onClick={() => setEditOpen(true)} className="gap-1">
                        <Pencil className="h-3 w-3" /> Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {req.progress && (
              <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-5 py-4">
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                  {isMultiDoc ? "Document Progress" : "Office Progress"}
                </p>
                <RequestProgressBar progress={req.progress} />
              </div>
            )}

            <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col lg:flex-1 lg:min-h-0">
              <div className="shrink-0 px-4 py-3 border-b border-slate-200 dark:border-surface-400 bg-slate-50/80 dark:bg-surface-600/80 flex items-center gap-2">
                {isMultiDoc ? <FileStack className="h-4 w-4 text-violet-500" /> : <Users className="h-4 w-4 text-sky-500" />}
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {isMultiDoc ? "Document Items" : "Recipient Offices"}
                </p>
                <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
                  {isMultiDoc ? items.length : recipients.length} total
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-surface-400 lg:overflow-y-auto lg:flex-1">
                {isMultiDoc
                  ? items.map((item, idx) => {
                    const sub = item.latest_submission;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() =>
                          navigate(`/document-requests/${requestId}/items/${item.id}`, {
                               state: {
                                 breadcrumbs: [
                                   { label: "Batch", to: "/document-requests" },
                                   { label: req.title ?? `Request #${requestId}`, to: `/document-requests/${requestId}` },
                                 ],
                               },
                             })
                        }
                        className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                      >
                        <span className="shrink-0 text-xs font-semibold text-slate-400 w-5 text-center">{idx + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">{item.title}</p>
                          {item.description && <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{item.description}</p>}
                        </div>
                        <span className={`shrink-0 text-xs font-semibold uppercase ${statusColor[sub?.status ?? "pending"] ?? "text-slate-400"}`}>{sub?.status ?? "pending"}</span>
                      </button>
                    );
                  })
                  : recipients.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() =>
                        navigate(`/document-requests/${requestId}/recipients/${r.id}`, {
                             state: {
                               breadcrumbs: [
                                 { label: "Batch", to: "/document-requests" },
                                 { label: req.title ?? `Request #${requestId}`, to: `/document-requests/${requestId}` },
                               ],
                             },
                           })
                      }
                      className="group w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate group-hover:text-brand-500 dark:group-hover:text-brand-400 transition-colors">{r.office_name ?? `Office #${r.office_id}`}</p>
                        {r.office_code && <p className="text-[11px] text-slate-400 font-mono">{r.office_code}</p>}
                      </div>
                      <span className={`shrink-0 text-xs font-semibold uppercase ${statusColor[r.status] ?? "text-slate-500"}`}>{r.status}</span>
                    </button>
                  ))}
              </div>
            </div>
          </section>

          <aside className={`lg:col-span-5 flex flex-col gap-4 ${mobileTab !== "discussion" ? "hidden lg:flex" : "flex"}`}>
            <div className="flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex-1 lg:min-h-0">
              <TabBar
                tabs={[
                  { value: "comments", label: "Comments", icon: <MessageSquare size={12} /> },
                  { value: "activity", label: "Activity", icon: <Activity size={12} /> },
                ]}
                active={rightTab}
                onChange={setRightTab}
                badge={{ comments: messages.length > 0 ? messages.length : undefined }}
              />

              {rightTab === "comments" ? (
                <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {!isMultiDoc && isReviewer && recipients.length > 0 && (
                    <div className="shrink-0 border-b border-slate-100 dark:border-surface-400 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
                      <button
                        type="button"
                        onClick={() => setActiveRecipientId(null)}
                        className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${activeRecipientId === null ? "bg-brand-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400"}`}
                      >
                        Shared
                      </button>
                      {recipients.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setActiveRecipientId(Number(r.id))}
                          className={`shrink-0 rounded px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${activeRecipientId === Number(r.id) ? "bg-brand-500 text-white" : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400"}`}
                        >
                          {r.office_code ?? r.office_name ?? `#${r.id}`}
                        </button>
                      ))}
                    </div>
                  )}

                  {!isMultiDoc && isReviewer && (
                    <div className="shrink-0 px-4 py-1.5 bg-slate-50 dark:bg-surface-600/50 border-b border-slate-100 dark:border-surface-400">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                        {activeRecipientId ? `Thread — ${recipients.find((r) => Number(r.id) === activeRecipientId)?.office_name ?? "Office"}` : "Shared batch thread"}
                      </p>
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
                    readOnly={!isReviewer}
                    readOnlyLabel="This broadcast thread is for announcements from the requester only."
                  />
                </div>
              ) : (
                <RequestActivityPanel logs={activityLogs} loading={activityLoading} />
              )}
            </div>
          </aside>
        </div>
      </PageFrame>

      {previewModal && (
        <RequestPreviewModal
          url={previewModal.url}
          filename={previewModal.filename}
          onClose={() => setPreviewModal(null)}
        />
      )}

      {confirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-sm mx-4 rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-xl p-6 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className={`flex items-center justify-center h-9 w-9 rounded-full ${confirmModal.status === "cancelled" ? "bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400" : "bg-slate-100 dark:bg-surface-500 text-slate-600 dark:text-slate-300"}`}>
                <AlertTriangle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 capitalize">{confirmModal.label} this request?</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{confirmModal.status === "cancelled" ? "This will void the request. This action cannot be undone." : "This will mark the request as closed and stop accepting submissions."}</p>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setConfirmModal(null)} disabled={statusUpdating} className="px-4 py-2 rounded-md text-xs font-medium border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition">Go back</button>
              <button type="button" onClick={handleConfirmStatus} disabled={statusUpdating} className={`px-4 py-2 rounded-md text-xs font-semibold disabled:opacity-40 transition ${confirmModal.status === "cancelled" ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-200 dark:hover:bg-white dark:text-slate-900 text-white"}`}>{statusUpdating ? "Processing…" : `Yes, ${confirmModal.label}`}</button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
