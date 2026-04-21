import React from "react";
import { ChevronDown } from "lucide-react";
import WorkflowCommentBubble from "../documents/ui/WorkflowCommentBubble";
import CommentComposer from "../ui/CommentComposer";
import type { DocumentRequestMessageRow } from "../../services/documentRequests";
import { formatDateTime } from "./shared";
import { getAvatarUrl } from "../../utils/formatters";
import SkeletonList from "../ui/loader/SkeletonList";

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
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

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

  const handleScroll = () => {
    if (!scrollAreaRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollAreaRef.current;
    const isScrolledUp = scrollTop + clientHeight < scrollHeight - 150;
    setShowScrollToBottom(isScrolledUp);
  };

  const handleScrollToBottom = () => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleScrollToNew = () => {
    handleScrollToBottom();
    onClearNewMessages?.();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={handleScrollToNew}
          className="shrink-0 w-full flex items-center justify-center gap-1.5 rounded-md bg-sky-500 py-1.5 text-xs font-semibold text-white  hover:bg-sky-600 transition animate-pulse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} · Click
          to scroll
        </button>
      )}

      <div className="flex-1 relative min-h-0">
        <div
          ref={scrollAreaRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600/60 px-4 py-3 space-y-4 scroll-smooth"
        >
          {loading ? (
            <SkeletonList variant="comments" rows={4} className="py-2" />
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-center h-full">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {readOnly 
                  ? "No announcements have been posted to this thread yet." 
                  : "No comments yet. Start the conversation."
                }
              </p>
            </div>
          ) : (
            messages
              .filter((m, i, self) => self.findIndex(t => t.id === m.id) === i)
              .map((m) => (
                <WorkflowCommentBubble
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
                  avatarUrl={getAvatarUrl(
                    (m.sender as any)?.profile_photo_url || m.sender?.profile_photo_path,
                  )}
                />
              ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Jump to bottom button */}
        {showScrollToBottom && (
          <button
            type="button"
            onClick={handleScrollToBottom}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-xl border border-slate-200 transition-all duration-200 hover:bg-white hover:text-sky-600 hover:scale-110 active:scale-95 dark:bg-surface-400 dark:border-surface-300 dark:text-sky-400 dark:hover:bg-surface-300 animate-in fade-in slide-in-from-bottom-4"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </div>

      {readOnly ? (
        <div className="shrink-0 border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 dark:border-surface-400 dark:bg-surface-600/50">
          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500 font-display font-semibold uppercase tracking-widest leading-none">
            {readOnlyLabel}
          </p>
        </div>
      ) : (
        <div className="shrink-0 space-y-2">
          {postErr && (
            <p className="px-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
              {postErr}
            </p>
          )}
          <CommentComposer
            value={commentText}
            onChange={onCommentChange}
            onSend={onPost}
            isSending={posting}
            placeholder="Ctrl + Enter to send message"
          />
        </div>
      )}
    </div>
  );
}
