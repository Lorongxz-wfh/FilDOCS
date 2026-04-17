import React from "react";
import { ChevronDown } from "lucide-react";
import SkeletonList from "../../ui/loader/SkeletonList";
import type { DocumentMessage } from "../../../services/documents";
import WorkflowCommentBubble from "../ui/WorkflowCommentBubble";
import CommentComposer from "../../ui/CommentComposer";
import { getAuthUser } from "../../../lib/auth";
import { getAvatarUrl } from "../../../utils/formatters";

type Props = {
  isLoading: boolean;
  messages: DocumentMessage[];
  onSend: (text: string) => Promise<void>;
  formatWhen: (iso: string) => string;
  newMessageCount?: number;
  clearNewMessageCount?: () => void;
  skeletonCount?: number;
};

const WorkflowCommentsPanel: React.FC<Props> = ({
  isLoading,
  messages,
  onSend,
  formatWhen,
  newMessageCount = 0,
  clearNewMessageCount,
  skeletonCount = 3,
}) => {
  const me = getAuthUser();
  const myUserId = me?.id ?? null;

  // Internal draft + sending state — NOT shared with parent
  const [draft, setDraft] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [sendError, setSendError] = React.useState(false);
  const [optimisticText, setOptimisticText] = React.useState("");

  // Scroll
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

  // Track new message IDs for highlight (from others only)
  const [newMessageIds, setNewMessageIds] = React.useState<Set<number>>(new Set());
  const prevIdsRef = React.useRef<Set<number>>(new Set());
  const isFirstRef = React.useRef(true);

  // Detect messages that arrived while panel is open
  React.useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false;
      prevIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }

    const incoming = messages.filter(
      (m) => !prevIdsRef.current.has(m.id) && Number(m.sender_user_id) !== Number(myUserId),
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

    prevIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages, myUserId]);

  // Auto-scroll to bottom when MY new message appears
  const prevMyCountRef = React.useRef(0);
  React.useEffect(() => {
    const myCount = messages.filter((m) => Number(m.sender_user_id) === Number(myUserId)).length;
    if (myCount > prevMyCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollTop + 500; // Small nudge
    }
    prevMyCountRef.current = myCount;
  }, [messages, myUserId]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setShowScrollToBottom(scrollTop + clientHeight < scrollHeight - 150);
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  };

  const handleSend = React.useCallback(async () => {
    const text = draft.trim();
    if (!text || isSending) return;

    setOptimisticText(text);
    setIsSending(true);
    setSendError(false);
    setDraft("");

    // Scroll to bottom immediately
    window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });

    try {
      await onSend(text);
      setOptimisticText("");
    } catch {
      setDraft(text);
      setOptimisticText("");
      setSendError(true);
    } finally {
      setIsSending(false);
    }
  }, [draft, isSending, onSend]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* New message pill */}
      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={() => { scrollToBottom(); clearNewMessageCount?.(); }}
          className="shrink-0 w-full flex items-center justify-center gap-1.5 rounded-md bg-sky-500 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 transition animate-pulse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} · Click to scroll
        </button>
      )}

      {/* Scrollable message area */}
      <div className="flex-1 min-h-0 relative group">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600/60 scroll-smooth"
        >
          {isLoading && messages.length === 0 ? (
            <div className="p-3">
              <SkeletonList variant="comments" rows={skeletonCount} />
            </div>
          ) : messages.length === 0 && !optimisticText ? (
            <div className="flex flex-col items-center justify-center h-full py-12 gap-1.5 text-center">
              <p className="text-xs font-medium text-slate-400 dark:text-slate-500">No comments yet.</p>
              <p className="text-[11px] text-slate-300 dark:text-slate-600">Be the first to leave a note.</p>
            </div>
          ) : (
            <div className="p-2 space-y-3">
              {messages.map((m) => {
                const isMe = Number(m.sender_user_id) === Number(myUserId);
                return (
                  <WorkflowCommentBubble
                    key={m.id}
                    senderName={isMe ? (me?.full_name ?? "Me") : (m.sender?.full_name ?? "Unknown")}
                    roleName={m.sender?.role?.name}
                    message={m.message}
                    when={formatWhen(m.created_at)}
                    isMine={isMe}
                    isNew={newMessageIds.has(m.id)}
                    type={m.type}
                    avatarUrl={getAvatarUrl(isMe ? (me?.profile_photo_url || me?.profile_photo_path) : (m.sender?.profile_photo_url || m.sender?.profile_photo_path))}
                    avatarLetter={isMe ? me?.full_name?.charAt(0).toUpperCase() : m.sender?.full_name?.charAt(0).toUpperCase()}
                  />
                );
              })}

              {/* Optimistic Message */}
              {optimisticText && (
                <div key="optimistic-comment-bubble" className="opacity-60 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <WorkflowCommentBubble
                    senderName={me?.full_name ?? "Me"}
                    message={optimisticText}
                    when="Sending..."
                    isMine={true}
                    isNew={false}
                    type="comment"
                    avatarUrl={getAvatarUrl(me?.profile_photo_url || me?.profile_photo_path)}
                    avatarLetter={me?.full_name?.charAt(0).toUpperCase()}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Jump to bottom */}
        {showScrollToBottom && (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 shadow-xl border border-slate-200 transition-all duration-200 hover:bg-white hover:text-sky-600 hover:scale-110 active:scale-95 dark:bg-surface-400 dark:border-surface-300 dark:text-sky-400 dark:hover:bg-surface-300 animate-in fade-in slide-in-from-bottom-4"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Error banner */}
      {sendError && (
        <p className="text-[11px] text-red-500 dark:text-red-400 text-center shrink-0">
          Failed to send. Please try again.
        </p>
      )}

      {/* Composer */}
      <CommentComposer
        value={draft}
        onChange={setDraft}
        onSend={handleSend}
        isSending={isSending}
        placeholder="Ctrl + Enter to send"
      />
    </div>
  );
};

export default WorkflowCommentsPanel;
