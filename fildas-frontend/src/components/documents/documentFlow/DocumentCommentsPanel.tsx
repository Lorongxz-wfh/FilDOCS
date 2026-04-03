import React from "react";
import { ChevronDown } from "lucide-react";
import SkeletonList from "../../ui/loader/SkeletonList";
import type { DocumentMessage } from "../../../services/documents";
import CommentBubble from "./CommentBubble";
import CommentComposer from "../../ui/CommentComposer";
import { getAuthUser } from "../../../lib/auth";
import { getAvatarUrl } from "../../../utils/formatters";

type Props = {
  isLoading: boolean;
  messages: DocumentMessage[];
  draftMessage: string;
  setDraftMessage: (v: string) => void;
  isSending: boolean;
  onSend: () => Promise<void>;
  formatWhen: (iso: string) => string;
  panelHeight?: number;
  newMessageCount?: number;
  clearNewMessageCount?: () => void;
  skeletonCount?: number;
  optimisticMessages: {
    tempId: string;
    text: string;
    sending: boolean;
    failed: boolean;
  }[];
  setOptimisticMessages: React.Dispatch<
    React.SetStateAction<
      { tempId: string; text: string; sending: boolean; failed: boolean }[]
    >
  >;
};

const DocumentCommentsPanel: React.FC<Props> = ({
  isLoading,
  messages,
  draftMessage,
  setDraftMessage,
  isSending,
  onSend,
  formatWhen,
  // panelHeight,
  newMessageCount = 0,
  clearNewMessageCount,
  skeletonCount = 3,
  optimisticMessages,
  setOptimisticMessages,
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const me = getAuthUser();
  const myUserId = me?.id ?? null;

  // Track scroll position to show/hide "Jump to Latest" button
  const [showScrollToBottom, setShowScrollToBottom] = React.useState(false);

  // Track which message IDs are "new" (arrived via polling)
  const [newMessageIds, setNewMessageIds] = React.useState<Set<number>>(
    new Set(),
  );
  const prevMessageIdsRef = React.useRef<Set<number>>(new Set());
  const isFirstRenderRef = React.useRef(true);

  // Detect new messages from polling
  React.useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevMessageIdsRef.current = new Set(messages.map((m) => m.id));
      return;
    }

    const incoming = messages.filter(
      (m) =>
        !prevMessageIdsRef.current.has(m.id) &&
        Number(m.sender_user_id) !== Number(myUserId),
    );

    if (incoming.length > 0) {
      setNewMessageIds((prev) => {
        const next = new Set(prev);
        incoming.forEach((m) => next.add(m.id));
        return next;
      });
      // Clear highlight after 4s
      window.setTimeout(() => {
        setNewMessageIds((prev) => {
          const next = new Set(prev);
          incoming.forEach((m) => next.delete(m.id));
          return next;
        });
      }, 4000);
    }

    prevMessageIdsRef.current = new Set(messages.map((m) => m.id));
  }, [messages]);

  // Auto-scroll only when user's own message sent (not on poll)
  const prevCountRef = React.useRef(0);
  React.useEffect(() => {
    const myMessages = messages.filter(
      (m) => Number(m.sender_user_id) === Number(myUserId),
    );
    if (myMessages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = myMessages.length;
  }, [messages]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Show button if we are more than 150px away from bottom
    const isScrolledUp = scrollTop + clientHeight < scrollHeight - 150;
    setShowScrollToBottom(isScrolledUp);
  };

  const handleScrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  const handleScrollToNew = () => {
    handleScrollToBottom();
    clearNewMessageCount?.();
  };

  const handleSend = React.useCallback(async () => {
    const text = draftMessage.trim();
    if (!text) return;
    const tempId = `opt-${Date.now()}`;
    setOptimisticMessages((prev) => [
      ...prev,
      { tempId, text, sending: true, failed: false },
    ]);
    setDraftMessage("");
    // Scroll to bottom
    window.requestAnimationFrame(() => {
      if (scrollRef.current)
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
    try {
      await onSend();
      // Real message will arrive via poll — remove optimistic
      setOptimisticMessages((prev) => prev.filter((m) => m.tempId !== tempId));
    } catch {
      setOptimisticMessages((prev) =>
        prev.map((m) =>
          m.tempId === tempId ? { ...m, sending: false, failed: true } : m,
        ),
      );
    }
  }, [draftMessage, onSend, setDraftMessage, setOptimisticMessages]);

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* New message pill */}
      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={handleScrollToNew}
          className="shrink-0 w-full flex items-center justify-center gap-1.5 rounded-md bg-sky-500 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-sky-600 transition animate-pulse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} · Click
          to scroll
        </button>
      )}

      {/* Scrollable message area — fills available space */}
      <div className="flex-1 min-h-0 relative group">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600/60 scroll-smooth"
        >
          {isLoading ? (
            <div className="p-3">
              <SkeletonList variant="comments" rows={skeletonCount} className="space-y-4" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No comments yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2 p-2">
              {messages.map((m) => (
                <CommentBubble
                  key={m.id}
                  senderName={m.sender?.full_name ?? "Unknown"}
                  roleName={m.sender?.role?.name}
                  when={formatWhen(m.created_at)}
                  message={m.message}
                  type={m.type}
                  isNew={newMessageIds.has(m.id)}
                  isMine={Number(m.sender_user_id) === Number(myUserId)}
                  avatarLetter={(m.sender?.full_name ?? "?")
                    .charAt(0)
                    .toUpperCase()}
                  avatarUrl={getAvatarUrl(
                    m.sender?.profile_photo_url || m.sender?.profile_photo_path,
                  )}
                />
              ))}

              {/* Optimistic Messages — Filter out ghosts that have already arrived in the real 'messages' array */}
              {optimisticMessages
                .filter(
                  (opt) =>
                    !messages.some(
                      (real) =>
                        Number(real.sender_user_id) === Number(myUserId) &&
                        real.message === opt.text &&
                        new Date(real.created_at).getTime() >
                          Date.now() - 10000, // Matching message must be from last 10s
                    ),
                )
                .map((m) => (
                  <CommentBubble
                    key={m.tempId}
                    senderName={me?.full_name ?? "Me"}
                    roleName={me?.role}
                    message={m.text}
                    when="Sending…"
                    isMine={true}
                    avatarLetter={me?.full_name?.charAt(0).toUpperCase()}
                    avatarUrl={getAvatarUrl(
                      me?.profile_photo_url || me?.profile_photo_path,
                    )}
                  />
                ))}
            </div>
          )}
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

      {/* Composer */}
      <CommentComposer
        value={draftMessage}
        onChange={setDraftMessage}
        onSend={handleSend}
        isSending={isSending}
        placeholder="Ctrl + Enter to send message"
      />
    </div>
  );
};

export default DocumentCommentsPanel;
