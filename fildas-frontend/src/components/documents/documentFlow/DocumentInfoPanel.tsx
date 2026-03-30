import React from "react";
import { Pencil, Loader2 } from "lucide-react";
import type {
  Document,
  DocumentVersion,
  Office,
  DocumentRouteStep,
  WorkflowTask,
} from "../../../services/documents";
import {
  updateDocumentTitle,
  setDocumentTags,
} from "../../../services/documents";

import { InfoRow, fmt } from "./documentInfoHelpers";
import DocumentInfoParticipantsTab from "./DocumentInfoParticipantsTab";

type Props = {
  document: Document;
  version: DocumentVersion;
  offices: Office[];
  routeSteps?: DocumentRouteStep[];
  tasks?: WorkflowTask[];
  isEditable?: boolean;
  onTitleSaved?: (newTitle: string) => void;
  onChanged?: () => void;
};

const DocumentInfoPanel: React.FC<Props> = ({
  document,
  version,
  offices,
  routeSteps = [],
  tasks = [],
  isEditable = false,
  onTitleSaved,
  onChanged,
}) => {
  const isDraftStatus = ["Draft", "Office Draft"].includes(
    version?.status ?? "",
  );

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
      if (isDraftStatus && trimmed && trimmed !== document.title) {
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
      onChanged?.();
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

  const tags: string[] = Array.isArray((document as any).tags)
    ? (document as any).tags
    : [];
  const revisionReason = (version as any).revision_reason ?? null;

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
              "px-2.5 py-1 rounded-md text-xs font-medium transition",
              activeTab === tab
                ? "bg-slate-100 dark:bg-surface-400 text-slate-900 dark:text-slate-100 font-semibold"
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
            className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-400 border border-slate-200 dark:border-surface-300 transition"
          >
            <Pencil className="h-2.5 w-2.5" />
            Edit
          </button>
        )}
        {activeTab === "details" && isEditing && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSaving}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-surface-400 border border-slate-200 dark:border-surface-300 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-md px-2 py-0.5 text-xs font-medium text-white bg-brand-400 hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400 disabled:opacity-50 transition flex items-center gap-1"
            >
              {isSaving && <Loader2 className="animate-spin h-2.5 w-2.5" />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* ── Details tab ── */}
      {activeTab === "details" && (
        <div className="space-y-1.5">
          {isEditing ? (
            <div className="rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-300 px-3 py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Title
                {!isDraftStatus && (
                  <span className="ml-1 text-slate-400 font-normal">
                    (read-only outside draft)
                  </span>
                )}
              </p>
              <input
                value={titleDraft}
                onChange={(e) => isDraftStatus && setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSave();
                  if (e.key === "Escape") handleCancel();
                }}
                disabled={isSaving || !isDraftStatus}
                className={`w-full rounded-md border px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none ${
                  isDraftStatus
                    ? "border-slate-300 dark:border-surface-300 bg-white dark:bg-surface-500"
                    : "border-slate-200 dark:border-surface-400 bg-slate-100 dark:bg-surface-600 opacity-60 cursor-not-allowed"
                }`}
              />
            </div>
          ) : (
            <InfoRow label="Title" value={document.title ?? "—"} />
          )}

          <InfoRow
            label="Code"
            value={
              document.code ? (
                <span className="font-mono">{document.code}</span>
              ) : (document as any).reserved_code ? (
                <span className="flex items-center justify-end gap-1.5">
                  <span className="font-mono">
                    {(document as any).reserved_code}
                  </span>
                  <span className="rounded border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-300">
                    pending
                  </span>
                </span>
              ) : (
                "—"
              )
            }
          />

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
            <div className="rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                Description
              </p>
              <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                {version.description}
              </p>
            </div>
          )}

          {revisionReason && (
            <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 px-3 py-2">
              <p className="text-xs text-amber-600 dark:text-amber-400 mb-1 font-semibold uppercase tracking-wide">
                Revision reason
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">
                {revisionReason}
              </p>
            </div>
          )}

          {isEditing ? (
            <div className="rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-200 dark:border-surface-300 px-3 py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                Tags{" "}
                <span className="text-slate-400 font-normal">
                  (Enter or comma to add)
                </span>
              </p>
              <div className="flex flex-wrap gap-1 mb-1.5">
                {tagsDraft.map((tag) => (
                  <span
                    key={tag}
                    className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium bg-slate-100 dark:bg-surface-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-surface-300"
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
                className="w-full rounded-md border border-slate-300 dark:border-surface-300 bg-white dark:bg-surface-500 px-2 py-1 text-xs text-slate-800 dark:text-slate-100 outline-none"
              />
            </div>
          ) : tags.length > 0 ? (
            <div className="rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                Tags
              </p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-200 dark:bg-surface-400 px-2 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ) : isEditable ? (
            <div className="rounded-md bg-slate-50 dark:bg-surface-600/50 border border-slate-100 dark:border-surface-400 px-3 py-2">
              <p className="text-xs text-slate-400 dark:text-slate-500">
                No tags — click Edit to add
              </p>
            </div>
          ) : null}
        </div>
      )}

      {/* ── Participants tab ── */}
      {activeTab === "participants" && (
        <DocumentInfoParticipantsTab
          document={document}
          version={version}
          offices={offices}
          routeSteps={routeSteps}
          tasks={tasks}
        />
      )}
    </div>
  );
};

export default DocumentInfoPanel;
