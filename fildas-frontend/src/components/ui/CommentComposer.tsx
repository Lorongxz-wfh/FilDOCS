import React, { useRef, useEffect } from "react";
import { Loader2, Send } from "lucide-react";

interface CommentComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

const CommentComposer: React.FC<CommentComposerProps> = ({
  value,
  onChange,
  onSend,
  isSending,
  placeholder = "Ctrl + Enter to send message",
  disabled = false,
  autoFocus = false,
  className = "",
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-expand logic
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (!isSending && value.trim() && !disabled) {
        onSend();
      }
    }
  };

  const isDisabled = disabled || isSending;

  return (
    <div className={`flex flex-col gap-1.5 shrink-0 ${className}`}>
      <div className="flex items-stretch gap-2 h-[44px]">
        {/* ── Textarea Input ── */}
        <div className="flex-1 bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400 rounded-md transition-all focus-within:border-brand-600 dark:focus-within:border-brand-500 focus-within:bg-white dark:focus-within:bg-surface-500 focus-within:ring-1 focus-within:ring-brand-500/20 overflow-hidden ">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            disabled={isDisabled}
            className="w-full h-full bg-transparent px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 outline-none resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500 leading-relaxed font-medium"
          />
        </div>

        {/* ── Action Button ── */}
        <button
          type="button"
          disabled={isDisabled || !value.trim()}
          onClick={onSend}
          className="group h-full px-4 flex flex-col items-center justify-center rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all  shadow-sky-600/20 active:scale-95 shrink-0 border border-sky-600/50"
          title="Send (Ctrl+Enter)"
        >
          {isSending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          <span className="text-[9px] font-semibold uppercase tracking-wider mt-0.5 leading-none">{isSending ? "..." : "Send"}</span>
        </button>
      </div>
    </div>
  );
};

export default CommentComposer;
