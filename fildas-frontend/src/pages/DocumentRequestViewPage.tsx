import React from "react";
import {
  Navigate,
  useNavigate,
  useParams,
} from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { getAuthUser } from "../lib/auth";
import {
  getDocumentRequestRecipient,
  getDocumentRequestItem,
  getDocumentRequestMessages,
  getDocumentRequestSubmissionFilePreviewLink,
  postDocumentRequestMessage,
  type DocumentRequestMessageRow,
} from "../services/documentRequests";
import { listActivityLogs } from "../services/activityApi";
import type { ActivityLogItem } from "../services/types";
import Button from "../components/ui/Button";
import {
  Download,
  ExternalLink,
  RefreshCw,
  FileText,
  ChevronDown,
  Maximize2,
  X,
} from "lucide-react";
import RequestCommentsPanel from "../components/documentRequests/RequestCommentsPanel";
import RequestActivityPanel from "../components/documentRequests/RequestActivityPanel";
import { formatDate } from "../utils/formatters";

// ── Compact field ─────────────────────────────────────────────────────────────
function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="text-xs font-medium text-slate-800 dark:text-slate-200 leading-snug">
        {value ?? "—"}
      </span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DocumentRequestViewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const requestId = Number(params.id);
  const recipientId = params.recipientId ? Number(params.recipientId) : null;
  const itemId = params.itemId ? Number(params.itemId) : null;

  if (!Number.isFinite(requestId) || requestId <= 0)
    return <Navigate to="/document-requests" replace />;

  const isItemView = !!itemId;
  const myId = Number(me?.id ?? 0);

  // ── State ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [req, setReq] = React.useState<any | null>(null);
  const [recipient, setRecipient] = React.useState<any | null>(null);
  const [acceptedSubmission, setAcceptedSubmission] = React.useState<any | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const [messages, setMessages] = React.useState<DocumentRequestMessageRow[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [postErr, setPostErr] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [infoCollapsed, setInfoCollapsed] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [timeline, setTimeline] = React.useState<ActivityLogItem[]>([]);
  const [timelineLoading, setTimelineLoading] = React.useState(false);

  const [sideTab, setSideTab] = React.useState<"comments" | "activity">("comments");

  // ── Load ────────────────────────────────────────────────────────────────────
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
      setRecipient(data.recipient);
      
      // Fallback: if backend didn't explicitly find the accepted submission, scan the list
      const accepted = data.accepted_submission ?? 
                       (Array.isArray(data.submissions) ? data.submissions.find((s: any) => s.status === "accepted") : null);
      setAcceptedSubmission(accepted);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load request view.");
    } finally {
      setLoading(false);
    }
  }, [requestId, itemId, recipientId, isItemView]);

  React.useEffect(() => { load(); }, [load]);

  // ── Preview link ────────────────────────────────────────────────────────────
  const loadPreview = React.useCallback(async () => {
    if (!acceptedSubmission?.id) return;
    setPreviewLoading(true);
    setPreviewError(null);
    try {
      const { url } = await getDocumentRequestSubmissionFilePreviewLink(acceptedSubmission.id);
      setPreviewUrl(url);
    } catch (e: any) {
      setPreviewError(e?.message ?? "Failed to load preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, [requestId, acceptedSubmission?.id]);

  React.useEffect(() => { loadPreview(); }, [loadPreview]);

  // ── Messages ────────────────────────────────────────────────────────────────
  const loadMessages = React.useCallback(async () => {
    setMessagesLoading(true);
    try {
      const msgs = await getDocumentRequestMessages(requestId, isItemView ? { item_id: itemId! } : { recipient_id: recipientId! });
      setMessages(msgs);
    } catch { /* silent */ }
    finally { setMessagesLoading(false); }
  }, [requestId, recipientId, itemId, isItemView]);

  React.useEffect(() => {
    if (sideTab === "comments") loadMessages();
  }, [loadMessages, sideTab]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Activity ────────────────────────────────────────────────────────────────
  const loadActivity = React.useCallback(async () => {
    setTimelineLoading(true);
    try {
      const p = await listActivityLogs({
        scope: "request",
        request_id: requestId,
        per_page: 50,
      });
      setTimeline(p.data);
    } catch { /* silent */ }
    finally { setTimelineLoading(false); }
  }, [requestId]);

  React.useEffect(() => {
    if (sideTab === "activity") loadActivity();
  }, [loadActivity, sideTab]);

  // ── Post comment ─────────────────────────────────────────────────────────────
  const postComment = async () => {
    const text = commentText.trim();
    if (!text || posting) return;
    setPosting(true);
    setPostErr(null);
    try {
      const msg = await postDocumentRequestMessage(requestId, text, {
        recipient_id: isItemView ? undefined : recipientId!,
        item_id: isItemView ? itemId! : undefined,
      });
      setMessages((prev) => [...prev, msg]);
      setCommentText("");
    } catch (e: any) {
      setPostErr(e?.response?.data?.message ?? e?.message ?? "Failed to post.");
    } finally { setPosting(false); }
  };

  const handleDownload = () => {
    if (!acceptedSubmission?.id) return;
    window.open(`${import.meta.env.VITE_API_BASE_URL}/document-requests/${requestId}/submissions/${acceptedSubmission.id}/download`, "_blank");
  };

  if (loading) {
    return (
      <PageFrame title="View Request" onBack={() => navigate(-1)}>
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
        </div>
      </PageFrame>
    );
  }

  if (error || !req) {
    return (
      <PageFrame title="View Request" onBack={() => navigate(-1)}>
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl">
          {error ?? "Request not found."}
        </div>
      </PageFrame>
    );
  }

  const title = isItemView ? req.items?.find((x: any) => x.id === itemId)?.title : (recipient?.office_name ?? "Request View");
  const status = isItemView ? (req.items?.find((x: any) => x.id === itemId)?.status ?? "Finalized") : (recipient?.status ?? "Finalized");
  const statusCls = status?.toLowerCase() === "accepted" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-slate-50 text-slate-700 dark:bg-surface-400 dark:text-slate-300";

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <PageFrame
      title={title}
      onBack={() => navigate(-1)}
      breadcrumbs={[
        { label: "Library", to: "/documents" },
        { label: "Requested", to: "/documents?tab=requested" },
      ]}
      right={
        <div className="flex items-center gap-2">
          {previewUrl && (
            <Button type="button" variant="outline" size="sm" responsive onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </Button>
          )}
          <Button
            type="button"
            variant="primary"
            size="sm"
            responsive
            onClick={() => navigate(`/document-requests/${requestId}${isItemView ? `/items/${itemId}` : `/recipients/${recipientId}`}`)}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open Tasks</span>
          </Button>
        </div>
      }
      contentClassName="!p-0 lg:overflow-hidden lg:h-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:h-full min-h-0 p-4 sm:p-5">

        {/* ── LEFT — preview ── */}
        <aside className="lg:col-span-8 flex flex-col lg:min-h-0">
          <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 flex flex-col h-[600px] lg:h-full overflow-hidden shadow-sm">

            {/* Preview toolbar */}
            <div className="shrink-0 px-4 py-2.5 border-b border-slate-100 dark:border-surface-400 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-surface-600/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Submission Preview</span>
                {acceptedSubmission?.original_filename && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-48" title={acceptedSubmission.original_filename}>
                    — {acceptedSubmission.original_filename}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={loadPreview}
                  tooltip="Reload preview"
                >
                  <RefreshCw className="h-3 w-3" />
                </Button>
                {previewUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => setFullscreen(true)}
                    tooltip="Fullscreen"
                  >
                    <Maximize2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Preview body */}
            <div className="flex-1 min-h-0">
              {previewLoading ? (
                <div className="flex h-full flex-col items-center justify-center gap-3">
                  <div className="h-6 w-6 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
                  <span className="text-xs text-slate-400 dark:text-slate-500">Loading preview…</span>
                </div>
              ) : previewError ? (
                <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/30">
                    <X className="h-5 w-5 text-rose-400" />
                  </div>
                  <p className="text-xs text-rose-500 dark:text-rose-400">{previewError}</p>
                  <Button type="button" variant="ghost" size="xs" onClick={loadPreview} className="font-bold text-sky-600 dark:text-sky-400">
                    Try again
                  </Button>
                </div>
              ) : previewUrl ? (
                <iframe title="Request submission preview" src={previewUrl} className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400">
                    <FileText className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">No preview available</p>
                  <p className="text-[10px] text-slate-300 dark:text-slate-600 uppercase tracking-widest font-bold">Waiting for submission</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── RIGHT — info + comments ── */}
        <section className="lg:col-span-4 flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden">

          {/* Request info card */}
          <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden shrink-0 shadow-sm">
            <button
              type="button"
              onClick={() => setInfoCollapsed((c) => !c)}
              className="w-full px-4 py-3 border-b border-slate-100 dark:border-surface-400 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-surface-400/40 transition-colors text-left"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-surface-400 font-bold text-[10px] text-slate-500">
                REQ
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
                  {title}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate uppercase tracking-wider">
                  {isItemView ? "Individual Item" : "Office Submission"}
                </p>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${infoCollapsed ? "-rotate-90" : ""}`} />
            </button>

            {!infoCollapsed && (
              <>
                <div className={`px-4 py-1.5 border-b border-slate-100 dark:border-surface-400 flex items-center gap-2 ${statusCls}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    {status}
                  </span>
                </div>

                <div className="px-4 py-3 grid grid-cols-1 gap-y-3">
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Requester" value={req.created_by_name ?? "System"} />
                    <Field label="Request ID" value={`#${requestId}`} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label="Due Date" value={formatDate(isItemView ? (req.item_due_at ?? req.due_at) : (recipient?.due_at ?? req.due_at))} />
                    <Field label="Approved" value={formatDate(acceptedSubmission?.accepted_at) || "—"} />
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden lg:flex-1 lg:min-h-0 shadow-sm">
            <div className="shrink-0 flex border-b border-slate-100 dark:border-surface-400">
              <button
                onClick={() => setSideTab("comments")}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sideTab === "comments" ? "text-brand-600 bg-brand-50/50 dark:text-brand-400 dark:bg-brand-950/10 border-b-2 border-brand-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
              >
                Comments
              </button>
              <button
                onClick={() => setSideTab("activity")}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sideTab === "activity" ? "text-brand-600 bg-brand-50/50 dark:text-brand-400 dark:bg-brand-950/10 border-b-2 border-brand-500" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}
              >
                Activity
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {sideTab === "comments" ? (
                <RequestCommentsPanel
                  messages={messages}
                  loading={messagesLoading}
                  myUserId={myId}
                  commentText={commentText}
                  posting={posting}
                  postErr={postErr}
                  messagesEndRef={messagesEndRef}
                  onCommentChange={setCommentText}
                  onPost={postComment}
                  newMessageCount={0}
                  onClearNewMessages={() => {}}
                />
              ) : (
                <RequestActivityPanel logs={timeline} loading={timelineLoading} />
              )}
            </div>
          </div>
        </section>
      </div>

      {fullscreen && previewUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="text-xs text-white/60">{acceptedSubmission?.original_filename ?? "Preview"}</span>
            <button onClick={() => setFullscreen(false)} className="text-white/60 hover:text-white"><X size={20} /></button>
          </div>
          <iframe title="Fullscreen preview" src={previewUrl} className="flex-1 w-full border-0" />
        </div>
      )}
    </PageFrame>
  );
}
