import React from "react";

type Props = {
  senderName: string;
  roleName?: string | null;
  when: string;
  message: string;
  type?: string;
  isNew?: boolean;
  isMine?: boolean;
  avatarLetter?: string;
};

const CommentBubble: React.FC<Props> = ({
  senderName,
  roleName,
  message,
  type,
  when,
  isNew = false,
  isMine = false,
  avatarLetter,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isNew && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isNew]);

  const initial = avatarLetter ?? senderName.charAt(0).toUpperCase();

  return (
    <div
      ref={ref}
      className={`flex gap-2 transition-all duration-700 ${isMine ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-1">
        <div
          className={`h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
            isMine
              ? "bg-sky-600 text-white"
              : "bg-slate-200 dark:bg-surface-400 text-slate-600 dark:text-slate-300"
          }`}
        >
          {initial}
        </div>
      </div>

      {/* Content */}
      <div
        className={`flex flex-col gap-1 max-w-[78%] ${isMine ? "items-end" : "items-start"}`}
      >
        {/* Name + role + type */}
        <div
          className={`flex items-center gap-1.5 flex-wrap ${isMine ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
            {senderName}
          </span>
          {roleName && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500">
              {roleName}
            </span>
          )}
          {type && type !== "comment" && (
            <span className="rounded-full bg-slate-100 dark:bg-surface-400 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-300 capitalize">
              {type}
            </span>
          )}
        </div>

        {/* Bubble */}
        <div
          className={[
            "px-3.5 py-2 text-sm leading-relaxed transition-all duration-500 rounded-2xl",
            isMine
              ? "bg-sky-600 text-white"
              : isNew
                ? "bg-sky-50 border border-sky-200 text-slate-800 dark:bg-sky-950/40 dark:border-sky-700 dark:text-slate-200 ring-1 ring-sky-200 dark:ring-sky-700"
                : "bg-white border border-slate-200 text-slate-800 dark:bg-surface-400 dark:border-surface-300 dark:text-slate-200",
          ].join(" ")}
        >
          {message}
        </div>

        <span className="text-[10px] text-slate-400 dark:text-slate-500">
          {when}
        </span>
      </div>
    </div>
  );
};

export default CommentBubble;
