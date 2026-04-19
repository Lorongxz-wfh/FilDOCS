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
  avatarUrl?: string | null;
};

const formatRole = (role: string | null | undefined) => {
  if (!role) return null;
  return role.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};

const WorkflowCommentBubble: React.FC<Props> = ({
  senderName,
  roleName,
  message,
  type,
  when,
  isNew = false,
  isMine = false,
  avatarLetter,
  avatarUrl,
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [imgError, setImgError] = React.useState(false);

  React.useEffect(() => {
    if (isNew && ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isNew]);

  const initial = avatarLetter ?? senderName.charAt(0).toUpperCase();
  const formattedRole = formatRole(roleName);

  return (
    <div
      ref={ref}
      className={`flex gap-3 ${isMine ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Avatar */}
      <div className="shrink-0 mt-0.5">
        <div
          className={`h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-semibold ring-1 ring-slate-200 dark:ring-surface-400/50 overflow-hidden ${
            Number(isMine)
              ? "bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900"
              : "bg-slate-100 dark:bg-surface-400 text-slate-500 dark:text-slate-400"
          }`}
        >
          {avatarUrl && !imgError ? (
            <img 
              src={avatarUrl} 
              alt={senderName} 
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            initial
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className={`flex flex-col gap-1 max-w-[85%] mb-1 ${isMine ? "items-end" : "items-start"}`}
      >
        {/* Name + role + type */}
        <div
          className={`flex items-center gap-2 flex-wrap font-display ${isMine ? "flex-row-reverse" : "flex-row"}`}
        >
          <span className="text-[12px] font-semibold text-slate-900 dark:text-slate-100 tracking-tight">
            {senderName}
          </span>
          {formattedRole && (
            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {formattedRole}
            </span>
          )}
          {type && type !== "comment" && (
            <span className="rounded-sm bg-slate-100 dark:bg-surface-300 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500 dark:text-slate-600 uppercase tracking-widest">
              {type}
            </span>
          )}
        </div>

        {/* Bubble */}
        <div
          className={[
            "px-3 py-2 text-[13.5px] leading-[1.5] border",
            isMine
              ? "bg-sky-100 border-sky-200 text-sky-900 dark:bg-sky-900 dark:border-sky-800 dark:text-sky-100 rounded-lg rounded-tr-none font-medium"
              : isNew
                ? "bg-amber-100 border-amber-200 text-amber-900 rounded-lg rounded-tl-none dark:bg-amber-900 dark:border-amber-800 dark:text-amber-100"
                : "bg-slate-100 border-slate-200 text-slate-900 rounded-lg rounded-tl-none dark:bg-surface-400 dark:border-surface-300 dark:text-slate-100",
          ].join(" ")}
        >
          {message}
        </div>

        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-widest px-0.5 font-display">
          {when}
        </span>
      </div>
    </div>
  );
};

export default WorkflowCommentBubble;
