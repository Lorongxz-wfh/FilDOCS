import React from "react";
import Skeleton from "../../ui/loader/Skeleton";
import type { DocumentMessage } from "../../../services/documents";
import CommentBubble from "./CommentBubble";
import { getAuthUser } from "../../../lib/auth";

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
}) => {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const myUserId = getAuthUser()?.id ?? null;

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

  const handleScrollToNew = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    clearNewMessageCount?.();
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-2">
      {/* New message pill */}
      {newMessageCount > 0 && (
        <button
          type="button"
          onClick={handleScrollToNew}
          className="shrink-0 w-full flex items-center justify-center gap-1.5 rounded-lg bg-sky-500 py-1.5 text-[11px] font-semibold text-white shadow-sm hover:bg-sky-600 transition animate-pulse"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          {newMessageCount} new message{newMessageCount > 1 ? "s" : ""} · Click
          to scroll
        </button>
      )}

      {/* Scrollable message area — fills available space */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/60 dark:border-surface-400 dark:bg-surface-600/60"
      >
        {isLoading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: skeletonCount }).map((_, i) => {
              // Always alternate: even = other, odd = mine
              const isMine = i % 2 === 1;
              const widths = ["w-1/2", "w-2/5", "w-2/3", "w-1/3", "w-3/5"];
              const bubbleWidth = widths[i % widths.length];
              return isMine ? (
                <div key={i} className="flex items-start justify-end gap-2">
                  <div className="space-y-1.5 items-end flex flex-col flex-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-14" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                    <Skeleton
                      className={`h-9 ${bubbleWidth} rounded-2xl rounded-tr-none`}
                    />
                    <Skeleton className="h-2.5 w-20" />
                  </div>
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <Skeleton className="h-7 w-7 rounded-full shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                    <Skeleton
                      className={`h-9 ${bubbleWidth} rounded-2xl rounded-tl-none`}
                    />
                    <Skeleton className="h-2.5 w-24" />
                  </div>
                </div>
              );
            })}
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
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 flex gap-2">
        <textarea
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm resize-none outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-200 dark:placeholder-slate-500 dark:focus:ring-sky-900/30 transition"
          rows={1}
          value={draftMessage}
          onChange={(e) => setDraftMessage(e.target.value)}
          placeholder="Ctrl+Enter to send"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (!isSending && draftMessage.trim()) onSend();
            }
          }}
        />
        <button
          type="button"
          disabled={isSending || draftMessage.trim().length === 0}
          onClick={onSend}
          className="rounded-lg px-3 py-2 text-xs font-semibold transition bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSending ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
};

export default DocumentCommentsPanel;
