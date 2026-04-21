import React from "react";
import Modal from "../ui/Modal";
import { friendlyEvent } from "../../utils/activityFormatters";
import { formatDateTime } from "../../utils/formatters";
import ActivityDiff from "../ui/ActivityDiff";
import { StatusBadge } from "../ui/Badge";

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        {label}
      </span>
      <div className="text-sm text-slate-800 dark:text-slate-200 break-words">
        {children}
      </div>
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
  const changes    = Array.isArray(row.meta?.changes) ? row.meta.changes : null;
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

        {/* Changes Diff */}
        {changes && (
          <Field label="Field Changes">
            <ActivityDiff changes={changes} />
          </Field>
        )}

        {/* Status transition */}
        {fromStatus && toStatus && (
          <Field label="Transition">
            <div className="flex items-center gap-2 flex-wrap mt-0.5">
              <StatusBadge status={fromStatus} className="opacity-70" />
              <span className="text-slate-400 text-xs text-center font-semibold">→</span>
              <StatusBadge status={toStatus} />
            </div>
          </Field>
        )}

        {/* Note */}
        {note && (
          <Field label="Note">
            <div className="text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-surface-600/50 p-2 rounded-md border-l-2 border-slate-200 dark:border-surface-400 italic">
              "{note}"
            </div>
          </Field>
        )}

        {/* 2-col grid for metadata */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-slate-200 dark:border-surface-400 pt-4">
          {docTitle && <Field label="Document" className="col-span-2 sm:col-span-1">{docTitle}</Field>}
          {actorName && <Field label="Actor" className="col-span-2 sm:col-span-1">{actorName}</Field>}
          {actorOffice && <Field label="Actor Office" className="col-span-2 sm:col-span-1">{actorOffice}</Field>}
          {targetOffice && <Field label="Target Office" className="col-span-2 sm:col-span-1">{targetOffice}</Field>}

          {/* Render OTHER rich meta fields that aren't changes, status, etc. */}
          {row.meta &&
            Object.entries(row.meta)
              .filter(
                ([key]) =>
                  ![
                    "from_status",
                    "to_status",
                    "note",
                    "no_link",
                    "document_id",
                    "document_request_id",
                    "announcement_id",
                    "changes",
                  ].includes(key),
              )
              .map(([key, value]) => (
                <Field key={key} label={key.replace(/_/g, " ")} className="col-span-2">
                  {String(value ?? "—")}
                </Field>
              ))}
        </div>
      </div>
    </Modal>
  );
};

export default ActivityDetailModal;
