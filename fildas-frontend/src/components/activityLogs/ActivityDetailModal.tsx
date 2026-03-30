import React from "react";
import Modal from "../ui/Modal";
import { friendlyEvent } from "../../utils/activityFormatters";
import { formatDateTime } from "../../utils/formatters";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-200 wrap-break-word">
        {children}
      </span>
    </div>
  );
}

interface ActivityDetailModalProps {
  row: any;
  onClose: () => void;
  onNavigate: (row: any) => void;
}

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({ row, onClose, onNavigate }) => {
  const fromStatus = row.meta?.from_status;
  const toStatus   = row.meta?.to_status;
  const note       = row.meta?.note;
  const canNav     = !!(row.document_version_id || row.document_id || row.meta?.document_request_id);

  const actorName  = row.actor_user?.full_name ?? row.actor_user?.name ?? null;
  const actorOffice = row.actor_office
    ? `${row.actor_office.name} (${row.actor_office.code})`
    : null;
  const targetOffice = row.target_office
    ? `${row.target_office.name} (${row.target_office.code})`
    : null;
  const docTitle = row.document?.title ?? (row.document_id ? `Document #${row.document_id}` : null);

  return (
    <Modal
      open={true}
      title={friendlyEvent(row.event)}
      onClose={onClose}
      headerActions={
        canNav ? (
          <button
            type="button"
            onClick={() => {
              onClose();
              onNavigate(row);
            }}
            className="rounded-md bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            Open →
          </button>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-4">
        {/* Timestamp + event code */}
        <div className="rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 py-2.5 flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {row.event}
          </span>
          <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap">
            {formatDateTime(row.created_at)}
          </span>
        </div>

        {/* Label / description */}
        {row.label && <Field label="Description">{row.label}</Field>}

        {/* Status transition */}
        {fromStatus && toStatus && (
          <Field label="Transition">
            <span className="flex items-center gap-2 flex-wrap mt-0.5">
              <span className="px-2 py-0.5 rounded-md text-xs bg-slate-100 dark:bg-surface-600 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-surface-400">
                {fromStatus}
              </span>
              <span className="text-slate-400 text-xs">→</span>
              <span className="px-2 py-0.5 rounded-md text-xs bg-brand-100 dark:bg-brand-500/20 text-brand-500 dark:text-brand-300 border border-brand-200 dark:border-brand-500/40 font-medium">
                {toStatus}
              </span>
            </span>
          </Field>
        )}

        {/* Note */}
        {note && (
          <Field label="Note">
            <span className="italic text-slate-600 dark:text-slate-400">
              "{note}"
            </span>
          </Field>
        )}

        {/* 2-col grid for metadata */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-t border-slate-200 dark:border-surface-400 pt-3">
          {docTitle && <Field label="Document">{docTitle}</Field>}
          {actorName && <Field label="Actor">{actorName}</Field>}
          {actorOffice && <Field label="Actor Office">{actorOffice}</Field>}
          {targetOffice && <Field label="Target Office">{targetOffice}</Field>}

          {/* Render all rich meta fields from announcement logs (and future structured logs) */}
          {row.meta &&
            Object.entries(row.meta)
              .filter(
                ([key]) =>
                  ![
                    // exclude internal/navigation keys already shown above or used elsewhere
                    "from_status",
                    "to_status",
                    "note",
                    "no_link",
                    "document_id",
                    "document_request_id",
                    "announcement_id",
                  ].includes(key),
              )
              .map(([key, value]) => (
                <Field key={key} label={key}>
                  {String(value ?? "—")}
                </Field>
              ))}
        </div>
      </div>
    </Modal>
  );
};

export default ActivityDetailModal;
