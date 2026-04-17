import React from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  useLocation,
} from "react-router-dom";
import PageFrame from "../../components/layout/PageFrame";
import { getAuthUser } from "../../lib/auth";
import {
  getDocument,
  getDocumentVersions,
  getDocumentPreviewLink,
  listDocumentMessages,
  postDocumentMessage,
  type Document,
  type DocumentVersion,
  type DocumentMessage,
} from "../../services/documents";
import {
  getDocumentRequestRecipient,
  getDocumentRequestItem,
  getDocumentRequestMessages,
  getDocumentRequestSubmissionFilePreviewLink,
  postDocumentRequestMessage,
} from "../../services/documentRequests";
import { listActivityLogs } from "../../services/activityApi";
import type { ActivityLogItem } from "../../services/types";
import { getUserRole, isQA, isSysAdmin, isAdmin, isAuditor } from "../../lib/roleFilters";
import { useAdminDebugMode } from "../../hooks/useAdminDebugMode";
import WorkflowShareModal from "../../components/documents/modals/WorkflowShareModal";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  Download,
  ExternalLink,
  Share2,
  Maximize2,
  X,
  RefreshCw,
  FileText,
  ChevronDown,
  History,
  Send,
  MessageSquare,
  Activity,
} from "lucide-react";
import WorkflowCommentBubble from "../../components/documents/ui/WorkflowCommentBubble";
import WorkflowFlowTimeline from "../../components/documents/workflow/WorkflowFlowTimeline";
import WorkflowActivityPanel from "../../components/documents/panels/WorkflowActivityPanel";
import { formatDate, formatDateTime } from "../../utils/formatters";

// ── Type badge ────────────────────────────────────────────────────────────────
const TYPE_STYLES: Record<string, string> = {
  internal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  external: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  forms: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function TypeBadge({ type }: { type: string }) {
  const cls = TYPE_STYLES[type?.toLowerCase()] ?? "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${cls}`}>
      {type || "—"}
    </span>
  );
}

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
export default function DocumentViewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const location = useLocation();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const docId = Number(params.id);
  const requestId = params.requestId ? Number(params.requestId) : null;
  const recipientId = params.recipientId ? Number(params.recipientId) : null;
  const itemId = params.itemId ? Number(params.itemId) : null;

  const isRequestMode = !!requestId;
  const isItemView = !!itemId;

  const versionIdParam = new URLSearchParams(location.search).get("version");
  const versionId = versionIdParam ? Number(versionIdParam) : null;

  const parentCrumbs: { label: string; to?: string }[] =
    (location.state as any)?.breadcrumbs ?? (isRequestMode
      ? [{ label: "Library", to: "/documents" }, { label: "Requested", to: "/documents?tab=requested" }]
      : [{ label: "Library", to: "/documents" }]);

  if (!isRequestMode && (!Number.isFinite(docId) || docId <= 0)) return <Navigate to="/documents" replace />;
  if (isRequestMode && (!Number.isFinite(requestId) || requestId <= 0)) return <Navigate to="/documents" replace />;

  const role = getUserRole();
  const myId = Number(me?.id ?? 0);
  const myOfficeId = Number(me?.office?.id ?? me?.office_id ?? 0);

  // ── State ───────────────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<Document | null>(null);
  const [recipient, setRecipient] = React.useState<any | null>(null);
  const [version, setVersion] = React.useState<DocumentVersion | null>(null);

  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = React.useState(false);
  const [previewError, setPreviewError] = React.useState<string | null>(null);

  const [messages, setMessages] = React.useState<DocumentMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");
  const [posting, setPosting] = React.useState(false);
  const [postErr, setPostErr] = React.useState<string | null>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  const [infoCollapsed, setInfoCollapsed] = React.useState(false);
  const [shareOpen, setShareOpen] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [flowOpen, setFlowOpen] = React.useState(false);
  const [timeline, setTimeline] = React.useState<ActivityLogItem[]>([]);
  const [timelineLoading, setTimelineLoading] = React.useState(false);

  const [sideTab, setSideTab] = React.useState<"comments" | "activity">("comments");

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (isRequestMode) {
        let data: any;
        if (isItemView) {
          data = await getDocumentRequestItem(requestId!, itemId!);
        } else {
          data = await getDocumentRequestRecipient(requestId!, recipientId!);
        }
        setDoc(data.request); // Map request object to doc state
        setRecipient(data.recipient);

        const accepted = data.accepted_submission ??
          (Array.isArray(data.submissions) ? data.submissions.find((s: any) => s.status === "accepted") : null);
        setVersion(accepted ?? null); // Map accepted submission to version state
      } else {
        const [docData, versions] = await Promise.all([
          getDocument(docId),
          getDocumentVersions(docId),
        ]);
        setDoc(docData);

        if (versionId) {
          const v = versions.find(x => x.id === versionId);
          setVersion(v ?? versions[0] ?? null);
        } else {
          const distributed = versions.filter((v) => v.status.toLowerCase() === "distributed");
          setVersion(distributed[0] ?? versions[0] ?? null);
        }
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load document.");
    } finally {
      setLoading(false);
    }
  }, [docId, requestId, itemId, recipientId, isRequestMode, isItemView, versionId]);

  const reqItem = React.useMemo(() => {
    if (!isRequestMode || !isItemView || !doc) return null;
    return (doc as any).items?.find((x: any) => x.id === itemId) || null;
  }, [isRequestMode, isItemView, doc, itemId]);

  React.useEffect(() => { load(); }, [load]);

  // ── Preview link ────────────────────────────────────────────────────────────
  const reloadPreview = React.useCallback(() => {
    if (!version?.id) return;
    setPreviewUrl(null);
    setPreviewLoading(true);
    setPreviewError(null);

    const promise = isRequestMode
      ? getDocumentRequestSubmissionFilePreviewLink(version.id)
      : getDocumentPreviewLink(version.id);

    promise
      .then((r) => setPreviewUrl(r.url))
      .catch((e: any) => setPreviewError(e?.message ?? "Failed to load preview."))
      .finally(() => setPreviewLoading(false));
  }, [version?.id, isRequestMode]);

  React.useEffect(() => { reloadPreview(); }, [reloadPreview]);

  // ── Messages ────────────────────────────────────────────────────────────────
  const loadMessages = React.useCallback(async () => {
    if (isRequestMode) {
      if (!requestId) return;
      setMessagesLoading(true);
      try {
        const msgs = await getDocumentRequestMessages(requestId, isItemView ? { item_id: itemId! } : { recipient_id: recipientId! });
        setMessages(msgs as any);
      } catch { /* silent */ }
      finally { setMessagesLoading(false); }
    } else {
      if (!version?.id) return;
      setMessagesLoading(true);
      try {
        const msgs = await listDocumentMessages(version.id);
        setMessages(msgs);
      } catch { /* silent */ }
      finally { setMessagesLoading(false); }
    }
  }, [version?.id, requestId, recipientId, itemId, isRequestMode, isItemView]);

  React.useEffect(() => {
    if (sideTab === "comments") loadMessages();
  }, [loadMessages, sideTab]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Activity timeline ────────────────────────────────────────────────────────
  const loadActivity = React.useCallback(async () => {
    if (isRequestMode) {
      if (!requestId) return;
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
    } else {
      if (!docId) return;
      setTimelineLoading(true);
      try {
        const p = await listActivityLogs({
          scope: "document",
          document_id: docId,
          per_page: 50,
          category: "workflow"
        });
        setTimeline(p.data);
      } catch { /* silent */ }
      finally { setTimelineLoading(false); }
    }
  }, [docId, requestId, isRequestMode]);

  React.useEffect(() => {
    if (sideTab === "activity") loadActivity();
  }, [loadActivity, sideTab]);


  // ── Permissions ─────────────────────────────────────────────────────────────
  const isOwner = React.useMemo(
    () => !!myOfficeId && !!doc?.owner_office_id && myOfficeId === Number(doc.owner_office_id),
    [doc, myOfficeId],
  );

  const canOpenFlow = React.useMemo(() => {
    if (!doc) return false;
    if (isQA(role) || isSysAdmin(role) || role === "ADMIN") return true;
    if (isOwner) return true;
    if (doc.created_by && doc.created_by === myId) return true;
    if ((doc as any).was_participant === true) return true;
    return false;
  }, [doc, role, isOwner, myId]);

  const adminDebugMode = useAdminDebugMode();
  const isAdminUser = isAdmin(role as any);
  const canShare = (isOwner || isQA(role) || isSysAdmin(role)) &&
    version?.status === "Distributed" &&
    (!isAdminUser || adminDebugMode);

  // ── Post comment ─────────────────────────────────────────────────────────────
  const postComment = async () => {
    const text = commentText.trim();
    if (!text || posting) return;
    if (isRequestMode) {
      if (!requestId) return;
      setPosting(true);
      setPostErr(null);
      try {
        const msg = await postDocumentRequestMessage(requestId, text, {
          recipient_id: isItemView ? undefined : recipientId!,
          item_id: isItemView ? itemId! : undefined,
        });
        setMessages((prev) => [...prev, msg as any]);
        setCommentText("");
      } catch (e: any) {
        setPostErr(e?.response?.data?.message ?? e?.message ?? "Failed to post.");
      } finally { setPosting(false); }
    } else {
      if (!version?.id) return;
      setPosting(true);
      setPostErr(null);
      try {
        const msg = await postDocumentMessage(version.id, { message: text, type: "comment" });
        setMessages((prev) => [...prev, msg]);
        setCommentText("");
      } catch (e: any) {
        setPostErr(e?.response?.data?.message ?? e?.message ?? "Failed to post.");
      } finally { setPosting(false); }
    }
  };

  // ── Download ─────────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!version?.id) return;
    if (isRequestMode) {
      window.open(`${import.meta.env.VITE_API_BASE_URL}/document-requests/${requestId}/submissions/${version.id}/download`, "_blank");
    } else {
      const win = window.open("about:blank", "_blank");
      try {
        const { url } = await getDocumentPreviewLink(version.id);
        if (win) win.location.href = url;
      } catch { win?.close(); }
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <PageFrame title="Document" onBack={() => navigate("/documents")}>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-6 w-6 rounded-full border-2 border-brand-500 border-t-transparent animate-spin" />
            <span className="text-xs text-slate-400 dark:text-slate-500">Loading document…</span>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (error || !doc) {
    return (
      <PageFrame title="Document" onBack={() => navigate("/documents")}>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          {error ?? "Document not found."}
        </div>
      </PageFrame>
    );
  }

  const ownerOffice = doc?.ownerOffice ?? (doc as any)?.office ?? null;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <PageFrame
      title={doc.title}
      onBack={() => navigate("/documents")}
      breadcrumbs={parentCrumbs}
      right={
        <div className="flex items-center gap-2">
          {!isRequestMode && (
            <Button type="button" variant="outline" size="sm" responsive onClick={() => setFlowOpen(true)}>
              <History className="h-3.5 w-3.5" />
              <span>Flow History</span>
            </Button>
          )}
          {!isRequestMode && canShare && (
            <Button type="button" variant="outline" size="sm" responsive onClick={() => setShareOpen(true)}>
              <Share2 className="h-3.5 w-3.5" />
              <span>Share</span>
            </Button>
          )}
          {version && (
            <Button type="button" variant="outline" size="sm" responsive onClick={handleDownload}>
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </Button>
          )}
          {isRequestMode ? (
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
          ) : (
            canOpenFlow && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                responsive
                onClick={() => navigate(`/documents/${docId}${version?.id ? `?version_id=${version.id}` : ""}`, { state: { from: `/documents/${docId}/view`, breadcrumbs: [...parentCrumbs, { label: doc.title, to: `/documents/${docId}/view` }] } })}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open flow</span>
              </Button>
            )
          )}
        </div>
      }
      contentClassName="!p-0 lg:overflow-hidden lg:h-full"
    >
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 lg:h-full min-h-0 p-4 sm:p-5">

        {/* ── LEFT — Preview ── */}
        <aside className="lg:col-span-8 flex flex-col lg:min-h-0 lg:order-1 order-2">
          <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 flex flex-col h-[600px] lg:h-full overflow-hidden shadow-sm">

            {/* Preview toolbar */}
            <div className="shrink-0 px-4 py-2.5 border-b border-slate-100 dark:border-surface-400 flex items-center justify-between gap-3 bg-slate-50/50 dark:bg-surface-600/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                  Document Preview
                </span>
                {version?.original_filename && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-48" title={version.original_filename}>
                    — {version.original_filename}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={reloadPreview}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={reloadPreview}
                    className="font-bold text-sky-600 dark:text-sky-400"
                  >
                    Try again
                  </Button>
                </div>
              ) : previewUrl ? (
                <iframe title="Document preview" src={previewUrl} className="h-full w-full border-0" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-surface-400">
                    <FileText className="h-5 w-5 text-slate-400 dark:text-slate-500" />
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500">No preview available</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* ── RIGHT — Sidebar ── */}
        <section className="lg:col-span-4 flex flex-col gap-3 lg:min-h-0 lg:overflow-hidden lg:order-2 order-1">

          {/* Metadata Card */}
          <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden shrink-0 shadow-sm">
            <button
              type="button"
              onClick={() => setInfoCollapsed((c) => !c)}
              className="w-full px-4 py-3 border-b border-slate-100 dark:border-surface-400 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-surface-400/40 transition-colors text-left"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-surface-400 font-bold text-[10px] text-slate-500">
                {isRequestMode ? "REQ" : "DOC"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-tight truncate">
                  {isRequestMode ? (isItemView ? reqItem?.title : (recipient?.office_name ?? "Request View")) : doc.title}
                </p>
                <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
                  {isRequestMode ? (
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate uppercase tracking-wider">
                      {isItemView ? "Individual Item" : "Office Submission"}
                    </p>
                  ) : (
                    <>
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 tracking-wide">
                        {doc.code}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">•</span>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        V{version?.version_number ?? 0}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${infoCollapsed ? "-rotate-90" : ""}`} />
            </button>

            {!infoCollapsed && (
              <>
                <div className={`px-4 py-1.5 border-b border-slate-100 dark:border-surface-400 flex items-center gap-2 ${isRequestMode ? (version?.status?.toLowerCase() === "accepted" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400" : "bg-slate-50 text-slate-700 dark:bg-surface-400 dark:text-slate-300") : "bg-emerald-50 dark:bg-emerald-950/20"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full bg-current shrink-0 ${!isRequestMode ? "bg-emerald-500" : ""}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {version?.status ?? (isRequestMode ? "Finalized" : "Distributed")}
                  </span>
                </div>
                <div className="px-4 py-3 grid grid-cols-1 gap-y-3">
                  <div className="grid grid-cols-2 gap-x-4">
                    <Field label={isRequestMode ? "Requester" : "Custodian"} value={isRequestMode ? (doc as any).created_by_name : ownerOffice?.name} />
                    <Field label={isRequestMode ? "Request ID" : "Effective"} value={isRequestMode ? `#${requestId}` : formatDate(version?.effective_date)} />
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    {isRequestMode ? (
                      <Field label="Due Date" value={formatDate(isItemView ? ((doc as any).item_due_at ?? (doc as any).due_at) : (recipient?.due_at ?? (doc as any).due_at))} />
                    ) : (
                      <Field label="Category" value={<TypeBadge type={doc.doctype} />} />
                    )}
                    {(isRequestMode || isAuditor(role)) && (
                      <Field label={isRequestMode ? "Approved" : "Distributed"} value={formatDate(isRequestMode ? (version as any)?.accepted_at : (doc as any).distributed_at) || "—"} />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Interaction Tabs */}
          <div className="flex flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden lg:flex-1 lg:min-h-0 shadow-sm">
            <div className="shrink-0 flex border-b border-slate-100 dark:border-surface-400">
              <button
                onClick={() => setSideTab("comments")}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sideTab === "comments"
                    ? "text-brand-600 bg-brand-50/50 dark:text-brand-400 dark:bg-brand-950/10 border-b-2 border-brand-500"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  <span>Comments</span>
                </div>
              </button>
              <button
                onClick={() => setSideTab("activity")}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sideTab === "activity"
                    ? "text-brand-600 bg-brand-50/50 dark:text-brand-400 dark:bg-brand-950/10 border-b-2 border-brand-500"
                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  }`}
              >
                <div className="flex items-center justify-center gap-1.5">
                  <Activity className="h-3 w-3" />
                  <span>Activity</span>
                </div>
              </button>
            </div>

            <div className="flex-1 min-h-0 flex flex-col">
              {sideTab === "comments" ? (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messagesLoading && messages.length === 0 ? (
                      <div className="flex h-full items-center justify-center">
                        <div className="h-5 w-5 rounded-full border-2 border-brand-400 border-t-transparent animate-spin" />
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 opacity-40">
                        <MessageSquare className="h-6 w-6" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">No comments</span>
                      </div>
                    ) : (
                      messages.map((m) => (
                        <WorkflowCommentBubble
                          key={m.id}
                          senderName={m.sender?.full_name ?? "Unknown"}
                          roleName={m.sender?.role?.name ?? null}
                          when={formatDateTime(m.created_at)}
                          message={m.message}
                          type={m.type}
                          isMine={m.sender_user_id === myId}
                          avatarLetter={(m.sender?.full_name ?? "?").charAt(0).toUpperCase()}
                        />
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>

                  <div className="shrink-0 p-3 border-t border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/30">
                    {postErr && <p className="mb-1 text-[10px] text-rose-500">{postErr}</p>}
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") postComment(); }}
                        placeholder="Add a comment…"
                        className="flex-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs outline-none focus:border-brand-500"
                      />
                      <button
                        onClick={postComment}
                        disabled={!commentText.trim() || posting}
                        className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <WorkflowActivityPanel logs={timeline} loading={timelineLoading} />
              )}
            </div>
          </div>
        </section>
      </div>

      {fullscreen && previewUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/95">
          <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-white/10">
            <span className="text-xs text-white/60 truncate">{version?.original_filename ?? "Preview"}</span>
            <button onClick={() => setFullscreen(false)} className="text-white/60 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>
          <iframe title="Document preview fullscreen" src={previewUrl} className="flex-1 w-full border-0" />
        </div>
      )}

      <Modal open={flowOpen} onClose={() => setFlowOpen(false)} title="Document Flow History">
        <div className="max-h-[70vh] overflow-y-auto px-1 py-1">
          <WorkflowFlowTimeline logs={timeline} versionNumber={version?.version_number} isLoading={timelineLoading} />
        </div>
      </Modal>

      <WorkflowShareModal
        open={shareOpen}
        documentId={doc.id}
        onClose={() => setShareOpen(false)}
        onSaved={() => { }}
      />
    </PageFrame>
  );
}
