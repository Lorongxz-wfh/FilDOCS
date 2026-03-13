import React from "react";
import type {
  Document,
  DocumentVersion,
  Office,
} from "../../../services/documents";
import {
  updateDocumentTitle,
  setDocumentTags,
} from "../../../services/documents";

import type {
  DocumentRouteStep,
  WorkflowTask,
  OfficeUser,
} from "../../../services/documents";
import { getOfficeUsers } from "../../../services/documents";

type Props = {
  document: Document;
  version: DocumentVersion;
  offices: Office[];
  routeSteps?: DocumentRouteStep[];
  tasks?: WorkflowTask[];
  isEditable?: boolean;
  onTitleSaved?: (newTitle: string) => void;
};

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({
  label,
  value,
}) => (
  <div className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
    <span className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0 pt-px">
      {label}
    </span>
    <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 text-right wrap-break-word max-w-[60%]">
      {value ?? (
        <span className="text-slate-400 dark:text-slate-500 font-normal">
          —
        </span>
      )}
    </span>
  </div>
);

// const doctypeBadge: Record<string, string> = {
//   internal: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
//   external:
//     "bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
//   forms: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
// };

// const visibilityBadge: Record<string, string> = {
//   global:
//     "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
//   office: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
// };

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const DocumentInfoPanel: React.FC<Props> = ({
  document,
  version,
  offices,
  // routeSteps = [],
  tasks = [],
  isEditable = false,
  onTitleSaved,
}) => {
  const [activeTab, setActiveTab] = React.useState<"details" | "participants">(
    "details",
  );
  const [isEditing, setIsEditing] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(document?.title ?? "");
  const [tagsDraft, setTagsDraft] = React.useState<string[]>(
    Array.isArray((document as any)?.tags) ? (document as any).tags : [],
  );
  const [tagInput, setTagInput] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);

  // Office users — fetched once when Participants tab is first opened
  const [officeUsers, setOfficeUsers] = React.useState<
    Record<number, OfficeUser[]>
  >({});
  const [loadingOffices, setLoadingOffices] = React.useState<Set<number>>(
    new Set(),
  );
  const [expandedOffices, setExpandedOffices] = React.useState<Set<number>>(
    new Set(),
  );
  const fetchedOfficeIds = React.useRef<Set<number>>(new Set());

  const fetchOfficeUsers = React.useCallback(async (officeId: number) => {
    if (fetchedOfficeIds.current.has(officeId)) return;
    fetchedOfficeIds.current.add(officeId);
    setLoadingOffices((prev) => new Set(prev).add(officeId));
    try {
      const users = await getOfficeUsers(officeId);
      setOfficeUsers((prev) => ({ ...prev, [officeId]: users }));
    } catch {
      setOfficeUsers((prev) => ({ ...prev, [officeId]: [] }));
    } finally {
      setLoadingOffices((prev) => {
        const next = new Set(prev);
        next.delete(officeId);
        return next;
      });
    }
  }, []);

  // When switching to participants tab, pre-fetch all office ids
  React.useEffect(() => {
    if (activeTab !== "participants") return;
    const officeIds = participantRows
      .map((p) => p.officeId)
      .filter((id): id is number => id != null);
    officeIds.forEach(fetchOfficeUsers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const toggleOffice = (officeId: number) => {
    setExpandedOffices((prev) => {
      const next = new Set(prev);
      if (next.has(officeId)) next.delete(officeId);
      else next.add(officeId);
      return next;
    });
    fetchOfficeUsers(officeId);
  };

  // Sync if document changes externally
  React.useEffect(() => {
    if (!isEditing) {
      setTitleDraft(document?.title ?? "");
      setTagsDraft(
        Array.isArray((document as any)?.tags) ? (document as any).tags : [],
      );
    }
  }, [document?.title, (document as any)?.tags, isEditing]);

  const handleEditOpen = () => {
    setTitleDraft(document.title ?? "");
    setTagsDraft(
      Array.isArray((document as any).tags) ? (document as any).tags : [],
    );
    setTagInput("");
    setIsEditing(true);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const val = tagInput.trim().toLowerCase();
      if (val && !tagsDraft.includes(val)) {
        setTagsDraft((prev) => [...prev, val]);
      }
      setTagInput("");
    }
    if (e.key === "Backspace" && tagInput === "" && tagsDraft.length > 0) {
      setTagsDraft((prev) => prev.slice(0, -1));
    }
  };

  const removeTag = (tag: string) =>
    setTagsDraft((prev) => prev.filter((t) => t !== tag));

  const handleSave = async () => {
    const trimmed = titleDraft.trim();
    setIsSaving(true);
    try {
      const saves: Promise<any>[] = [];
      if (trimmed && trimmed !== document.title) {
        saves.push(
          updateDocumentTitle(document.id, trimmed).then(() =>
            onTitleSaved?.(trimmed),
          ),
        );
      }
      const currentTags: string[] = Array.isArray((document as any).tags)
        ? (document as any).tags
        : [];
      const tagsChanged =
        JSON.stringify([...tagsDraft].sort()) !==
        JSON.stringify([...currentTags].sort());
      if (tagsChanged) {
        saves.push(setDocumentTags(document.id, tagsDraft));
      }
      await Promise.all(saves);
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setIsSaving(false);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setTitleDraft(document.title ?? "");
    setTagsDraft(
      Array.isArray((document as any).tags) ? (document as any).tags : [],
    );
    setTagInput("");
    setIsEditing(false);
  };

  if (!document || !version) return null;

  const ownerOffice = document.ownerOffice ?? (document as any).office ?? null;
  // const reviewOffice =
    document.reviewOffice ?? (document as any).review_office ?? null;
  // const doctype = (document.doctype ?? "").toLowerCase();
  // const visibility = (document as any).visibility_scope ?? null;
  const tags: string[] = Array.isArray((document as any).tags)
    ? (document as any).tags
    : [];
  const revisionReason = (version as any).revision_reason ?? null;

  // Build participants from workflow tasks (all steps, deduped by office)
  type ParticipantRow = {
    role: string;
    label: string;
    sublabel?: string;
    status: WorkflowTask["status"] | "owner";
    officeId: number | null;
  };

  const participantRows: ParticipantRow[] = [];
  const seenOfficeIds = new Set<number>();

  // Always put owner office first
  if (ownerOffice) {
    seenOfficeIds.add(ownerOffice.id);
    participantRows.push({
      role: "Creator",
      label: ownerOffice.name,
      sublabel: ownerOffice.code,
      status: "owner",
      officeId: ownerOffice.id,
    });
  }

  // Walk tasks in order — each unique assigned office = one participant row
  tasks.forEach((task) => {
    const offId = task.assigned_office_id ?? null;
    if (offId && !seenOfficeIds.has(offId)) {
      seenOfficeIds.add(offId);
      const off = offices.find((o) => o.id === offId);
      const roleLabel =
        task.phase === "review"
          ? "Review"
          : task.phase === "approval"
            ? "Approval"
            : task.phase === "registration"
              ? "Registration"
              : (task.step ?? task.phase);
      participantRows.push({
        role: roleLabel,
        label: off ? off.name : `Office #${offId}`,
        sublabel: off?.code,
        status: task.status,
        officeId: offId,
      });
    }
  });

  const statusDot: Record<string, string> = {
    owner: "bg-sky-400",
    open: "bg-amber-400 animate-pulse",
    completed: "bg-emerald-500",
    returned: "bg-rose-400",
    rejected: "bg-rose-600",
    cancelled: "bg-slate-400",
  };

  return (
    <div>
      {/* Tab switcher */}
      <div className="flex items-center gap-1 mb-2.5">
        {(["details", "participants"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition",
              activeTab === tab
                ? "bg-sky-100 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400"
                : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400",
            ].join(" ")}
          >
            {tab === "details" ? "Details" : "Participants"}
          </button>
        ))}
        {activeTab === "details" && isEditable && !isEditing && (
          <button
            type="button"
            onClick={handleEditOpen}
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 border border-sky-200 dark:border-sky-800 transition"
          >
            <svg
              className="h-2.5 w-2.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z"
              />
            </svg>
            Edit
          </button>
        )}
        {activeTab === "details" && isEditing && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-md px-2 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-400 border border-slate-200 dark:border-surface-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md px-2 py-0.5 text-[10px] font-medium text-white bg-sky-500 hover:bg-sky-600 disabled:opacity-50 transition flex items-center gap-1"
            >
              {isSaving && (
                <svg
                  className="animate-spin h-2.5 w-2.5"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z"
                  />
                </svg>
              )}
              Save
            </button>
          </div>
        )}
      </div>

      {/* ── Details tab ── */}
      {activeTab === "details" && (
        <div className="space-y-1.5">
          {isEditing ? (
            <div className="rounded-lg bg-slate-50 dark:bg-surface-600/50 border border-sky-200 dark:border-sky-800 px-3 py-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                Title
              </p>
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                disabled={isSaving}
                className="w-full rounded-md border border-sky-300 dark:border-sky-700 bg-white dark:bg-surface-500 px-2 py-1 text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-sky-400"
                autoFocus
              />
            </div>
          ) : (
            <InfoRow label="Title" value={document.title ?? "—"} />
          )}

          <InfoRow label="Code" value={document.code ?? "—"} />

          {((document as any).school_year || (document as any).semester) && (
            <InfoRow
              label="Period"
              value={[(document as any).school_year, (document as any).semester]
                .filter(Boolean)
                .join(" · ")}
            />
          )}

          <InfoRow
            label="Effective date"
            value={fmt((version as any).effective_date)}
          />
          <InfoRow label="Version created" value={fmt(version.created_at)} />
          {version.distributed_at && (
            <InfoRow
              label="Distributed"
              value={fmt(version.distributed_at as any)}
            />
          )}

          {version.description && (
            <div className="rounded-lg bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1">
                Description
              </p>
              <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {version.description}
              </p>
            </div>
          )}

          {revisionReason && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-1 font-semibold uppercase tracking-wide">
                Revision reason
              </p>
              <p className="text-[11px] text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">
                {revisionReason}
              </p>
            </div>
          )}

          {isEditing ? (
            <div className="rounded-lg bg-slate-50 dark:bg-surface-600/50 border border-sky-200 dark:border-sky-800 px-3 py-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">
                Tags{" "}
                <span className="text-slate-400 font-normal">
                  (Enter or comma to add)
                </span>
              </p>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {tagsDraft.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded-full bg-sky-100 dark:bg-sky-950/40 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-rose-500 transition leading-none"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                disabled={isSaving}
                placeholder="Add tag…"
                className="w-full rounded-md border border-sky-300 dark:border-sky-700 bg-white dark:bg-surface-500 px-2 py-1 text-[11px] text-slate-800 dark:text-slate-100 outline-none focus:ring-1 focus:ring-sky-400"
              />
            </div>
          ) : tags.length > 0 ? (
            <div className="rounded-lg bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-200 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : isEditable ? (
            <div className="rounded-lg bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
              <p className="text-[10px] text-slate-400 dark:text-slate-500">
                No tags — click Edit to add
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Participants tab ── */}
      {activeTab === "participants" && (
        <div className="space-y-1.5">
          {participantRows.length === 0 ? (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
              No participants yet.
            </p>
          ) : (
            participantRows.map((p, i) => {
              const offId = p.officeId;
              const isExpanded = offId != null && expandedOffices.has(offId);
              const isLoading = offId != null && loadingOffices.has(offId);
              const users: OfficeUser[] =
                offId != null ? (officeUsers[offId] ?? []) : [];

              return (
                <div
                  key={i}
                  className="rounded-lg border border-slate-100 dark:border-surface-400 bg-slate-50 dark:bg-surface-600/50 overflow-hidden"
                >
                  {/* Header row — always visible */}
                  <button
                    type="button"
                    onClick={() => offId != null && toggleOffice(offId)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-surface-500/50 transition"
                  >
                    {/* Status dot */}
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${statusDot[p.status] ?? "bg-slate-300"}`}
                    />
                    {/* Office name + code */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {p.label}
                        {p.sublabel && (
                          <span className="ml-1 text-[10px] font-normal text-slate-400 dark:text-slate-500">
                            ({p.sublabel})
                          </span>
                        )}
                      </p>
                    </div>
                    {/* Role badge */}
                    <span className="shrink-0 rounded-full bg-slate-200 dark:bg-surface-400 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:text-slate-300">
                      {p.role}
                    </span>
                    {/* Chevron */}
                    <svg
                      className={`h-3 w-3 shrink-0 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Expanded — users list */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 dark:border-surface-400 px-3 py-2 space-y-1.5">
                      {isLoading ? (
                        <>
                          {[1, 2].map((n) => (
                            <div
                              key={n}
                              className="flex items-center gap-2 animate-pulse"
                            >
                              <div className="h-5 w-5 rounded-full bg-slate-200 dark:bg-surface-400 shrink-0" />
                              <div className="h-3 rounded bg-slate-200 dark:bg-surface-400 w-28" />
                              <div className="ml-auto h-3 rounded bg-slate-200 dark:bg-surface-400 w-12" />
                            </div>
                          ))}
                        </>
                      ) : users.length === 0 ? (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">
                          No active users in this office.
                        </p>
                      ) : (
                        users.map((u) => (
                          <div key={u.id} className="flex items-center gap-2">
                            {/* Avatar initials */}
                            <div className="h-5 w-5 rounded-full bg-sky-100 dark:bg-sky-950/40 flex items-center justify-center shrink-0">
                              <span className="text-[8px] font-bold text-sky-600 dark:text-sky-400 uppercase">
                                {u.first_name?.[0]}
                                {u.last_name?.[0]}
                              </span>
                            </div>
                            <p className="flex-1 text-[11px] text-slate-700 dark:text-slate-300 truncate">
                              {u.full_name}
                            </p>
                            {u.role?.label && (
                              <span className="shrink-0 text-[9px] text-slate-400 dark:text-slate-500">
                                {u.role.label}
                              </span>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default DocumentInfoPanel;
