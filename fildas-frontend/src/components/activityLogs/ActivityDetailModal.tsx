import React from "react";
import Modal from "../ui/Modal";
import { friendlyEvent } from "../../utils/activityFormatters";
import { formatDateTime } from "../../utils/formatters";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  if (!value || value === "—") return null;
  return (
    <div className="flex gap-3 py-2 border-b border-slate-200 dark:border-surface-400 last:border-0">
      <span className="w-32 shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500 pt-0.5">
        {label}
      </span>
      <span className="text-sm text-slate-800 dark:text-slate-200 break-all">
        {value}
      </span>
    </div>
  );
}

interface ActivityDetailModalProps {
  row: any;
  onClose: () => void;
  onNavigate: (row: any) => void;
}

const ActivityDetailModal: React.FC<ActivityDetailModalProps> = ({
  row,
  onClose,
  onNavigate,
}) => {
  const fromStatus = row.meta?.from_status;
  const toStatus = row.meta?.to_status;
  const note = row.meta?.note;
  const canNav = !!(
    row.document_version_id ||
    row.document_id ||
    row.meta?.document_request_id
  );

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
            className="rounded bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
          >
            Open →
          </button>
        ) : undefined
      }
    >
      <div className="space-y-0">
        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
          {formatDateTime(row.created_at)}
        </p>
        <DetailRow label="Label" value={row.label ?? "—"} />
        {fromStatus && toStatus && (
          <DetailRow
            label="Transition"
            value={
              <span className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-surface-600 text-slate-600 dark:text-slate-400">
                  {fromStatus}
                </span>
                <span className="text-slate-400">→</span>
                <span className="px-2 py-0.5 rounded text-xs bg-slate-100 dark:bg-surface-600 text-slate-700 dark:text-slate-300 font-medium">
                  {toStatus}
                </span>
              </span>
            }
          />
        )}
        {note && (
          <DetailRow
            label="Note"
            value={
              <span className="italic text-slate-600 dark:text-slate-400">
                "{note}"
              </span>
            }
          />
        )}
        <DetailRow
          label="Document"
          value={
            row.document?.title ??
            (row.document_id ? `#${row.document_id}` : "—")
          }
        />
        <DetailRow
          label="Version"
          value={row.document_version_id ? `v${row.document_version_id}` : "—"}
        />
        <DetailRow
          label="Actor"
          value={
            row.actor_user?.full_name ??
            row.actor_user?.name ??
            (row.actor_user_id ? `User #${row.actor_user_id}` : "—")
          }
        />
        <DetailRow
          label="Actor office"
          value={
            row.actor_office
              ? `${row.actor_office.name} (${row.actor_office.code})`
              : row.actor_office_id
                ? `Office #${row.actor_office_id}`
                : "—"
          }
        />
        <DetailRow
          label="Target office"
          value={
            row.target_office
              ? `${row.target_office.name} (${row.target_office.code})`
              : row.target_office_id
                ? `Office #${row.target_office_id}`
                : "—"
          }
        />
        {row.meta && (
          <DetailRow
            label="Meta"
            value={
              <pre className="text-xs bg-slate-50 dark:bg-surface-600 rounded-md p-3 overflow-x-auto">
                {typeof row.meta === "string"
                  ? row.meta
                  : JSON.stringify(row.meta, null, 2)}
              </pre>
            }
          />
        )}
      </div>
    </Modal>
  );
};

export default ActivityDetailModal;
