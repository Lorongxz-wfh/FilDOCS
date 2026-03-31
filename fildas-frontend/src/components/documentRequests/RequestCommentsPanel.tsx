import React from "react";
import { Send } from "lucide-react";
import CommentBubble from "../documents/documentFlow/CommentBubble";
import type { DocumentRequestMessageRow } from "../../services/documentRequests";
import { formatDateTime } from "./shared";

type Props = {
  messages: DocumentRequestMessageRow[];
  loading: boolean;
  myUserId: number;
  commentText: string;
  posting: boolean;
  postErr: string | null;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onCommentChange: (v: string) => void;
  onPost: () => void;
  newMessageCount?: number;
  onClearNewMessages?: () => void;
  readOnly?: boolean;
  readOnlyLabel?: string;
};

export default function RequestCommentsPanel({
  messages,
  loading,
  myUserId,
  commentText,
  posting,
  postErr,
  messagesEndRef,
  onCommentChange,
  onPost,
  newMessageCount = 0,
  onClearNewMessages,
  readOnly = false,
  readOnlyLabel = "This thread is read-only.",
}: Props) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  // Track new message IDs from polling
  const [newMessageIds, setNewMessageIds] = React.useState<Set<number>>(
    new Set(),
  );
  const prevMessageIdsRef = React.useRef<Set<number>>(new Set());
  const isFirstRenderRef = React.useRef(true);

  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevMessageIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }
    const incoming = messages.filter(
      (m) =>
        !prevMessageIdsRef.current.has(m.id) && m.sender_user_id !== myUserId,
    );
    if (incoming.length > 0) {
      setNewMessageIds((prev) => {
        const next = new Set(prev);
        incoming.forEach((m) => next.add(m.id));
        return next;
      });
      window.setTimeout(() => {
        setNewMessageIds((prev) => {
          const next = new Set(prev);
          incoming.forEach((m) => next.delete(m.id));
          return next;
        });
      }, 4000);
    }
    prevMessageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages, myUserId]);

  const handleScrollToNew = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
    onClearNewMessages?.();
  };

  return (
    <>
      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={handleScrollToNew}
          className="mx-4 mt-2 flex w-[calc(100%-2rem)] items-center justify-center gap-1.5 rounded-md bg-sky-500 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 transition animate-pulse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} · Click
          to scroll
        </button>
      )}

      <div
        ref={scrollAreaRef}
        className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50/30 dark:bg-surface-600/30 space-y-4"
      >
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {readOnly 
                ? "No announcements have been posted to this thread yet." 
                : "No comments yet. Start the conversation."
              }
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <CommentBubble
              key={m.id}
              senderName={m.sender?.name ?? "Unknown"}
              roleName={
                typeof m.sender?.role === "string" ? m.sender.role : null
              }
              when={formatDateTime(m.created_at ?? "")}
              message={m.message}
              type={m.type ?? "comment"}
              isNew={newMessageIds.has(m.id)}
              isMine={m.sender_user_id === myUserId}
              avatarLetter={(m.sender?.name ?? "?").charAt(0).toUpperCase()}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {readOnly ? (
        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-3 dark:border-surface-400 dark:bg-surface-600/50">
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {readOnlyLabel}
          </p>
        </div>
      ) : (
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 dark:border-surface-400 dark:bg-surface-500">
          {postErr && (
            <p className="mb-2 text-xs text-rose-600 dark:text-rose-400">
              {postErr}
            </p>
          )}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => onCommentChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onPost();
                }
              }}
              placeholder="Write a comment…"
              disabled={posting}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-sky-500 disabled:opacity-50 dark:border-surface-400 dark:bg-surface-600 dark:text-slate-200 dark:placeholder-slate-500"
            />
            <button
              onClick={onPost}
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
      )}
    </>
  );
}
