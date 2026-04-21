import { Clock, Building2, Pencil } from "lucide-react";
import { StatusBadge, formatDate } from "./shared";
import Button from "../ui/Button";
import LiveValuePulse from "../ui/LiveValuePulse";

type Props = {
  req: any;
  recipient: any;
  isItemView?: boolean;
  effectiveDueAt?: string | null;
  editOpen?: boolean;
  editTitle?: string;
  editDesc?: string;
  editDueAt?: string;
  editSaving?: boolean;
  editErr?: string | null;
  inputCls?: string;
  onEditToggle?: () => void;
  onEditTitleChange?: (v: string) => void;
  onEditDescChange?: (v: string) => void;
  onEditDueAtChange?: (v: string) => void;
  onEditSave?: () => void;
  onEditCancel?: () => void;
  canManage?: boolean;
  pulseKey?: number;
};

export default function RequestHeaderCard({
  req,
  recipient,
  isItemView = false,
  effectiveDueAt,
  editOpen = false,
  editTitle = "",
  editDesc = "",
  editDueAt = "",
  editSaving = false,
  editErr,
  inputCls = "",
  onEditToggle,
  onEditTitleChange,
  onEditDescChange,
  onEditDueAtChange,
  onEditSave,
  onEditCancel,
  canManage = false,
  pulseKey = 0,
}: Props) {
  const batchDue = req.due_at ?? null;
  const itemDue = effectiveDueAt ?? batchDue;
  const hasOverride = effectiveDueAt && effectiveDueAt !== batchDue;

  return (
    <>
      {/* Title row */}
      <div className="flex items-center gap-3 px-5 py-4">
        {editOpen && canManage && isItemView ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => onEditTitleChange?.(e.target.value)}
            className={`flex-1 ${inputCls}`}
            autoFocus
          />
        ) : (
          <h1 className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
            {req.item_title ?? req.title}
          </h1>
        )}
        <LiveValuePulse value={pulseKey}>
          <StatusBadge status={req.status} />
        </LiveValuePulse>
      </div>

      {/* Item description — only visible when editing */}
      {editOpen && canManage && isItemView && (
        <div className="px-5 pb-3">
          <textarea
            rows={2}
            value={editDesc}
            onChange={(e) => onEditDescChange?.(e.target.value)}
            placeholder="Instructions for this document…"
            className={`w-full resize-none ${inputCls}`}
          />
        </div>
      )}

      {/* Meta strip */}
      <div className="flex items-center gap-4 px-5 py-2.5 border-t border-slate-100 dark:border-surface-400 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Clock size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400 dark:text-slate-500">Batch due</span>
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {formatDate(batchDue)}
          </span>
        </div>
        <span className="text-slate-200 dark:text-surface-400">·</span>
        <div className="flex items-center gap-1.5">
          <Building2 size={11} className="text-slate-400 dark:text-slate-500 shrink-0" />
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            {recipient?.office_name ?? req.office_name ?? "—"}
            {(recipient?.office_code ?? req.office_code) && (
              <span className="ml-1 text-slate-400 dark:text-slate-500 font-normal">
                ({recipient?.office_code ?? req.office_code})
              </span>
            )}
          </span>
        </div>
        {recipient?.status && (
          <>
            <span className="text-slate-200 dark:text-surface-400">·</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 dark:text-slate-500">Submission</span>
              <LiveValuePulse value={pulseKey}>
                <StatusBadge status={recipient.status} />
              </LiveValuePulse>
            </div>
          </>
        )}
      </div>

      {/* Override bar — Manager/Reviewer only */}
      {canManage && (
        <div className="flex items-center gap-3 px-5 py-2.5 border-t border-slate-100 dark:border-surface-400">
          <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
            {isItemView ? "Item due" : "Office due"}
          </span>

          {editOpen && canManage ? (
            <>
              <div className="flex flex-col gap-1 flex-1 min-w-0">
                {batchDue && (
                  <span className="text-[10px] text-slate-400 dark:text-slate-500">
                    Batch default: {new Date(batchDue).toLocaleDateString(undefined, { dateStyle: "medium" })}
                  </span>
                )}
                <input
                  type="datetime-local"
                  value={editDueAt}
                  onChange={(e) => onEditDueAtChange?.(e.target.value)}
                  className={`w-full ${inputCls}`}
                />
              </div>
              {editErr && (
                <span className="text-xs text-red-500 dark:text-red-400 shrink-0">{editErr}</span>
              )}
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <Button variant="outline" size="xs" onClick={onEditCancel}>Cancel</Button>
                <Button variant="primary" size="xs" onClick={onEditSave} loading={editSaving}>Save</Button>
              </div>
            </>
          ) : (
            <>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {itemDue
                  ? new Date(itemDue).toLocaleDateString(undefined, { dateStyle: "medium" })
                  : "—"}
              </span>
              {hasOverride
                ? <span className="text-xs text-amber-500 dark:text-amber-400">overridden</span>
                : <span className="text-xs text-slate-400 dark:text-slate-500 italic">inherited from batch</span>
              }
              {canManage && (
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onEditToggle}
                  className="ml-auto gap-1"
                >
                  <Pencil className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
