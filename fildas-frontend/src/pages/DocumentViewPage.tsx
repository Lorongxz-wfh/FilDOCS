import React from "react";
import {
  Navigate,
  useNavigate,
  useParams,
  //   useLocation,
} from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { getAuthUser } from "../lib/auth";
import {
  getDocument,
  getDocumentVersions,
  getDocumentPreviewLink,
  listDocumentMessages,
  postDocumentMessage,
  type Document,
  type DocumentVersion,
  type DocumentMessage,
} from "../services/documents";
import { getUserRole, isQA, isSysAdmin } from "../lib/roleFilters";
import ShareDocumentModal from "../components/documents/ShareDocumentModal";
import {
  Download,
  ExternalLink,
  FileText,
  Share2,
  Tag,
  Calendar,
  Building2,
  Hash,
  Send,
  Maximize2,
  X,
} from "lucide-react";
import CommentBubble from "../components/documents/documentFlow/CommentBubble";

import { formatDate, formatDateTime } from "../utils/formatters";

const TYPE_STYLES: Record<string, string> = {
  internal: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400",
  external:
    "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  forms:
    "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
};

function TypeBadge({ type }: { type: string }) {
  const cls =
    TYPE_STYLES[type?.toLowerCase()] ??
    "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${cls}`}
    >
      {type || "—"}
    </span>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-surface-400 last:border-0">
      <div className="shrink-0 mt-0.5 text-slate-400 dark:text-slate-500">
        {icon}
      </div>
      <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
        <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0 pt-0.5">
          {label}
        </span>
        <span className="text-xs font-medium text-slate-800 dark:text-slate-200 text-right">
          {value}
        </span>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function DocumentViewPage() {
  const navigate = useNavigate();
  const params = useParams();
  const me = getAuthUser();
  if (!me) return <Navigate to="/login" replace />;

  const docId = Number(params.id);
  if (!Number.isFinite(docId) || docId <= 0)
    return <Navigate to="/documents" replace />;

  const role = getUserRole();
  const myId = Number(me?.id ?? 0);
  const backTo = "/documents";
  // ── State ──────────────────────────────────────────────────────────────────
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<Document | null>(null);
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
  const prevMsgCountRef = React.useRef(0);
  const isFirstMsgRef = React.useRef(true);
  const [newMsgCount, setNewMsgCount] = React.useState(0);

  const [shareOpen, setShareOpen] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [infoCollapsed, setInfoCollapsed] = React.useState(false);

  // ── Load doc + latest distributed version ──────────────────────────────────
  React.useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [docData, versions] = await Promise.all([
          getDocument(docId),
          getDocumentVersions(docId),
        ]);
        if (!alive) return;
        setDoc(docData);
        // Pick the latest distributed version
        const distributed = versions.filter(
          (v) => v.status.toLowerCase() === "distributed",
        );
        const latest = distributed[0] ?? versions[0] ?? null;
        setVersion(latest);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load document.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, [docId]);

  // ── Preview link ───────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!version?.preview_path) {
      setPreviewUrl(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    getDocumentPreviewLink(version.id)
      .then((r) => setPreviewUrl(r.url))
      .catch((e: any) =>
        setPreviewError(e?.message ?? "Failed to load preview."),
      )
      .finally(() => setPreviewLoading(false));
  }, [version?.id]);

  // ── Messages ───────────────────────────────────────────────────────────────
  const loadMessages = React.useCallback(async () => {
    if (!version?.id) return;
    setMessagesLoading(true);
    try {
      const msgs = await listDocumentMessages(version.id);
      setMessages(msgs);
    } catch {
      /* silent */
    } finally {
      setMessagesLoading(false);
    }
  }, [version?.id]);

  React.useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      if (!version?.id) return;
      loadMessages().then(() => {
        if (isFirstMsgRef.current) {
          isFirstMsgRef.current = false;
          prevMsgCountRef.current = messages.length;
          return;
        }
        const n = messages.length - prevMsgCountRef.current;
        if (n > 0) setNewMsgCount((p) => p + n);
        prevMsgCountRef.current = messages.length;
      });
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [version?.id, loadMessages, messages.length]);

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Derived permissions ────────────────────────────────────────────────────
  const myOfficeId = Number(me?.office?.id ?? 0);
  const canOpenFlow = React.useMemo(() => {
    if (!doc) return false;
    if (isQA(role) || isSysAdmin(role)) return true;
    if (doc.owner_office_id && myOfficeId === Number(doc.owner_office_id))
      return true;
    if (doc.created_by && doc.created_by === myId) return true;
    if ((doc as any).was_participant === true) return true;
    return false;
  }, [doc, role, myOfficeId, myId]);

  const canShare =
    (isQA(role) || isSysAdmin(role)) && version?.status === "Distributed";

  // ── Post comment ───────────────────────────────────────────────────────────
  const postComment = async () => {
    const text = commentText.trim();
    if (!text || posting || !version?.id) return;
    setPosting(true);
    setPostErr(null);
    try {
      const msg = await postDocumentMessage(version.id, {
        message: text,
        type: "comment",
      });
      setMessages((prev) => [...prev, msg]);
      setCommentText("");
    } catch (e: any) {
      setPostErr(e?.response?.data?.message ?? e?.message ?? "Failed to post.");
    } finally {
      setPosting(false);
    }
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (!version?.id) return;
    const win = window.open("about:blank", "_blank");
    try {
      const { url } = await getDocumentPreviewLink(version.id);
      if (win) win.location.href = url;
    } catch {
      win?.close();
    }
  };

  // ── Loading / error states ─────────────────────────────────────────────────
  if (loading) {
    return (
      <PageFrame title="Document" onBack={() => navigate(backTo)}>
        <div className="flex h-60 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-7 w-7 rounded-full border-2 border-sky-500 border-t-transparent animate-spin" />
            <span className="text-sm text-slate-500 dark:text-slate-400">
              Loading document…
            </span>
          </div>
        </div>
      </PageFrame>
    );
  }

  if (error || !doc) {
    return (
      <PageFrame title="Document" onBack={() => navigate(backTo)}>
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
          {error ?? "Document not found."}
        </div>
      </PageFrame>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <PageFrame
      title={doc.title}
      onBack={() => navigate(backTo)}
      right={
        <div className="flex items-center gap-2">
          {canShare && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>
          )}
          {version && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          )}
          {canOpenFlow && (
            <button
              type="button"
              onClick={() =>
                navigate(`/documents/${docId}`, {
                  state: { from: `/documents/${docId}/view` },
                })
              }
              className="flex items-center gap-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open flow
            </button>
          )}
        </div>
      }
    >
      <div
        className="grid grid-cols-1 gap-5 lg:grid-cols-12 min-h-0"
        style={{ height: "calc(100vh - 120px)" }}
      >
        {/* ── LEFT — metadata + comments ── */}
        <section className="lg:col-span-5 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* Document info card — collapsible */}
          <div className="rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden shrink-0">
            {/* Header — always visible, click to collapse */}
            <button
              type="button"
              onClick={() => setInfoCollapsed((v) => !v)}
              className="w-full px-5 py-4 border-b border-slate-100 dark:border-surface-400 flex items-start gap-3 text-left hover:bg-slate-50 dark:hover:bg-surface-600 transition"
            >
              <FileText className="h-5 w-5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h1 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">
                  {doc.title}
                </h1>
                {doc.code && (
                  <p className="mt-0.5 font-mono text-xs text-slate-400 dark:text-slate-500">
                    {doc.code}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex flex-col items-end gap-1.5">
                <TypeBadge type={doc.doctype} />
                {version && (
                  <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                    v{version.version_number}
                  </span>
                )}
                <span className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                  {infoCollapsed ? "▼ Show details" : "▲ Hide details"}
                </span>
              </div>
            </button>

            {/* Collapsible body */}
            {!infoCollapsed && (
              <>
                {/* Meta rows */}
                <div className="px-5 py-1">
                  <MetaRow
                    icon={<Building2 className="h-3.5 w-3.5" />}
                    label="Office"
                    value={(() => {
                      const o =
                        doc?.ownerOffice ?? (doc as any)?.office ?? null;
                      return o ? `${o.name} (${o.code})` : "—";
                    })()}
                  />
                  <MetaRow
                    icon={<Hash className="h-3.5 w-3.5" />}
                    label="Code"
                    value={<span className="font-mono">{doc.code || "—"}</span>}
                  />
                  <MetaRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Effective date"
                    value={formatDate(version?.effective_date)}
                  />
                  <MetaRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Distributed"
                    value={formatDateTime(version?.distributed_at)}
                  />
                  <MetaRow
                    icon={<Calendar className="h-3.5 w-3.5" />}
                    label="Created"
                    value={formatDate(doc.created_at)}
                  />
                  {Array.isArray(doc.tags) && doc.tags.length > 0 && (
                    <MetaRow
                      icon={<Tag className="h-3.5 w-3.5" />}
                      label="Tags"
                      value={
                        <div className="flex flex-wrap gap-1 justify-end">
                          {doc.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-full border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-2 py-0.5 text-[10px] text-slate-500 dark:text-slate-400"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      }
                    />
                  )}
                </div>

                {/* Status bar */}
                <div className="px-5 py-3 border-t border-slate-100 dark:border-surface-400 bg-emerald-50/50 dark:bg-emerald-950/10 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    {version?.status ?? "Distributed"}
                  </span>
                  {version?.original_filename && (
                    <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 truncate max-w-48">
                      {version.original_filename}
                    </span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Comments */}
          <div className="flex flex-col rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex-1 min-h-0">
            <div className="shrink-0 px-5 py-3 border-b border-slate-200 dark:border-surface-400 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Comments
              </p>
              {newMsgCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    messagesEndRef.current?.scrollIntoView({
                      behavior: "smooth",
                    });
                    setNewMsgCount(0);
                  }}
                  className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 animate-pulse"
                >
                  {newMsgCount} new
                </button>
              )}
            </div>

            {/* Message list */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/30 dark:bg-surface-600/30 min-h-0">
              {messagesLoading && messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center py-8">
                  <p className="text-sm text-slate-400 dark:text-slate-500">
                    No comments yet.
                  </p>
                </div>
              ) : (
                messages.map((m) => (
                  <CommentBubble
                    key={m.id}
                    senderName={m.sender?.full_name ?? "Unknown"}
                    roleName={m.sender?.role?.name ?? null}
                    when={formatDateTime(m.created_at)}
                    message={m.message}
                    type={m.type}
                    isMine={m.sender_user_id === myId}
                    avatarLetter={(m.sender?.full_name ?? "?")
                      .charAt(0)
                      .toUpperCase()}
                  />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Composer */}
            <div className="shrink-0 border-t border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 px-4 py-3">
              {postErr && (
                <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">
                  {postErr}
                </p>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      postComment();
                    }
                  }}
                  placeholder="Write a comment…"
                  disabled={posting}
                  className="flex-1 rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-2.5 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 disabled:opacity-50 dark:text-slate-200 dark:placeholder-slate-500"
                />
                <button
                  type="button"
                  onClick={postComment}
                  disabled={!commentText.trim() || posting}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white transition hover:bg-sky-700 disabled:opacity-40"
                >
                  {posting ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── RIGHT — preview ── */}
        <aside className="lg:col-span-7 flex flex-col min-h-0">
          <div
            className="rounded-2xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden flex flex-col h-full"
            style={{ minHeight: "500px" }}
          >
            <div className="shrink-0 px-5 py-3 border-b border-slate-200 dark:border-surface-400 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Preview
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {version?.original_filename ?? "No file"}
                </span>
                {version?.preview_path && (
                  <>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setPreviewLoading(true);
                      setPreviewError(null);
                      getDocumentPreviewLink(version.id)
                        .then((r) => setPreviewUrl(r.url))
                        .catch((e: any) =>
                          setPreviewError(
                            e?.message ?? "Failed to load preview.",
                          ),
                        )
                        .finally(() => setPreviewLoading(false));
                    }}
                    className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                  >
                    ↺ Reload
                  </button>
                  {previewUrl && (
                    <button
                      type="button"
                      onClick={() => setFullscreen(true)}
                      title="Fullscreen preview"
                      className="flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 px-2 py-1 text-[11px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                    >
                      <Maximize2 className="h-3 w-3" />
                    </button>
                  )}
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 min-h-0">
              {previewLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-slate-500">
                  <div className="h-5 w-5 rounded-full border-2 border-sky-400 border-t-transparent animate-spin" />
                  Loading preview…
                </div>
              ) : previewError ? (
                <div className="flex h-full items-center justify-center text-sm text-rose-500 dark:text-rose-400 px-4 text-center">
                  {previewError}
                </div>
              ) : previewUrl ? (
                <iframe
                  title="Document preview"
                  src={previewUrl}
                  className="h-full w-full"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                  No preview available.
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Fullscreen preview modal */}
      {fullscreen && previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-2 shrink-0">
            <span className="text-sm text-white/70 truncate">{version?.original_filename ?? "Preview"}</span>
            <button
              type="button"
              onClick={() => setFullscreen(false)}
              className="flex items-center justify-center h-8 w-8 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <iframe
            title="Document preview fullscreen"
            src={previewUrl}
            className="flex-1 w-full border-0"
          />
        </div>
      )}

      <ShareDocumentModal
        open={shareOpen}
        documentId={doc.id}
        onClose={() => setShareOpen(false)}
        onSaved={() => {}}
      />
    </PageFrame>
  );
}
