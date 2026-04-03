import React, { useEffect, useState } from "react";
import { Pencil, Loader2, Tag, Calendar, FileText, CheckCircle2 } from "lucide-react";
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
import { StatusBadge } from "../../ui/Badge";

type Props = {
  document: Document;
  version: DocumentVersion;
  offices: Office[];
  routeSteps?: DocumentRouteStep[];
  tasks?: WorkflowTask[];
  isEditable?: boolean;
  onTitleSaved?: (newTitle: string) => void;
  onChanged?: () => void;
  activeTab: "details" | "participants";
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
  activeTab,
}) => {
  const isDraftStatus = ["Draft", "Office Draft"].includes(
    version?.status ?? "",
  );

  const [isEditing, setIsEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(document?.title ?? "");
  const [tagsDraft, setTagsDraft] = useState<string[]>(
    Array.isArray((document as any)?.tags) ? (document as any).tags : [],
  );
  const [tagInput, setTagInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  
  // UX: Highlight code when it's first assigned during registration
  const [justRegistered, setJustRegistered] = useState(false);

  // Sync if document changes externally
  useEffect(() => {
    if (!isEditing) {
      setTitleDraft(document?.title ?? "");
      setTagsDraft(
        Array.isArray((document as any)?.tags) ? (document as any).tags : [],
      );
    }
  }, [document?.title, (document as any)?.tags, isEditing]);

  // Handle registration highlight
  useEffect(() => {
    if (document.code && !(document as any)._prev_code_snapshot) {
      // First time we see a code
      setJustRegistered(true);
      const timer = setTimeout(() => setJustRegistered(false), 3000);
      (document as any)._prev_code_snapshot = document.code;
      return () => clearTimeout(timer);
    }
  }, [document.code]);

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
    <div className="flex flex-col h-full overflow-y-auto pr-0.5 space-y-4">
        {activeTab === "details" && (
          <div className="space-y-3">
            {/* Header Actions for Editing */}
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <FileText className="h-3 w-3" />
                Document Metadata
              </h3>
              {isEditable && !isEditing && (
                <button
                  type="button"
                  onClick={handleEditOpen}
                  className="flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-300 hover:bg-brand-50/50 dark:hover:bg-brand-500/10 border border-transparent transition-all"
                >
                  <Pencil className="h-2.5 w-2.5" />
                  Edit
                </button>
              )}
              {isEditing && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold uppercase tracking-tight text-white bg-brand-500 hover:bg-brand-600 dark:bg-brand-400 dark:hover:bg-brand-500 disabled:opacity-50 transition shadow-sm flex items-center gap-1.5"
                  >
                    {isSaving ? <Loader2 className="animate-spin h-2.5 w-2.5" /> : <CheckCircle2 className="h-2.5 w-2.5" />}
                    Save
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              {isEditing ? (
                <div className="rounded-xl bg-white dark:bg-surface-500 border border-brand-200/50 dark:border-brand-500/20 px-3 py-2.5 shadow-sm">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">
                    Document Title
                    {!isDraftStatus && (
                      <span className="ml-1 text-slate-400 font-normal lowercase tracking-normal">
                        (read-only)
                      </span>
                    )}
                  </p>
                  <textarea
                    value={titleDraft}
                    onChange={(e) => isDraftStatus && setTitleDraft(e.target.value)}
                    disabled={isSaving || !isDraftStatus}
                    rows={2}
                    className="w-full rounded-lg border-0 bg-slate-50/50 dark:bg-surface-600/30 px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/20 transition-all resize-none"
                  />
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100/80 dark:border-surface-300/10 px-3 py-3 bg-slate-50/30 dark:bg-surface-600/20">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
                    Title
                  </span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100 leading-relaxed block pr-2">
                    {document.title ?? "—"}
                  </span>
                </div>
              )}

              <InfoRow
                label="Document Code"
                highlight={justRegistered}
                value={
                  document.code ? (
                    <span className="font-mono text-slate-800 dark:text-slate-100">{document.code}</span>
                  ) : (document as any).reserved_code ? (
                    <span className="flex items-center justify-end gap-1.5">
                      <span className="font-mono text-slate-400 dark:text-slate-500">
                        {(document as any).reserved_code}
                      </span>
                      <StatusBadge status="pending" className="!text-[8px] !px-1 font-black uppercase tracking-tighter" />
                    </span>
                  ) : (
                    "—"
                  )
                }
              />

              {((document as any).school_year || (document as any).semester) && (
                <InfoRow
                  label="Academic Period"
                  value={[(document as any).school_year, (document as any).semester]
                    .filter(Boolean)
                    .join(" · ")}
                />
              )}

              {null}
            {/* Metadata Rows */}
            <div className="grid grid-cols-1 gap-y-1.5 pt-1">
              <InfoRow
                icon={<Calendar className="h-3 w-3" />}
                label="Created At"
                value={fmt(document.created_at)}
              />
              <InfoRow
                icon={<FileText className="h-3 w-3" />}
                label="Type"
                value={document.doctype}
                valueClassName="capitalize"
              />
              <InfoRow
                icon={<Tag className="h-3 w-3" />}
                label="Visibility"
                value={(document as any).visibility_scope ?? "office"}
                valueClassName="capitalize"
              />
              <InfoRow
                icon={<CheckCircle2 className="h-3 w-3" />}
                label="Version"
                value={`v${version.version_number}`}
              />
              {version.effective_date && (
                <InfoRow
                  icon={<Calendar className="h-3 w-3" />}
                  label="Effective"
                  value={fmt(version.effective_date)}
                />
              )}
            </div>
              
              {version.distributed_at && (
                <InfoRow
                  label="Distributed On"
                  value={fmt(version.distributed_at as any)}
                />
              )}
            </div>

            {/* Description Card */}
            {version.description && (
              <div className="rounded-xl bg-slate-50/50 dark:bg-surface-600/30 border border-slate-100/80 dark:border-surface-300/10 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="h-3 w-3 text-slate-400" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Description
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {version.description}
                </p>
              </div>
            )}

            {/* Revision Reason Card */}
            {revisionReason && (
              <div className="rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2 text-amber-600 dark:text-amber-400">
                  <Calendar className="h-3 w-3" />
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Revision reason
                  </span>
                </div>
                <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300 leading-relaxed whitespace-pre-wrap">
                  {revisionReason}
                </p>
              </div>
            )}

            {/* Tags Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-1">
                <Tag className="h-3 w-3 text-slate-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Tags
                </span>
              </div>
              
              {isEditing ? (
                <div className="rounded-xl bg-white dark:bg-surface-500 border border-slate-200/60 dark:border-surface-300/20 p-2.5 shadow-sm">
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {tagsDraft.map((tag) => (
                      <span
                        key={tag}
                        className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold bg-slate-100 dark:bg-surface-400 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/5"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => removeTag(tag)}
                          className="hover:text-rose-500 transition leading-none ml-1"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                    {tagsDraft.length === 0 && (
                      <span className="text-[10px] text-slate-400 p-1">No tags added</span>
                    )}
                  </div>
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagInputKeyDown}
                    disabled={isSaving}
                    placeholder="Add tag (Enter or comma)..."
                    className="w-full rounded-lg bg-slate-50 dark:bg-surface-600/50 px-2.5 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 border-0 focus:ring-2 focus:ring-brand-500/20 outline-none transition-all placeholder:text-slate-400 placeholder:font-normal"
                  />
                </div>
              ) : tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 px-1">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-lg bg-slate-100 dark:bg-surface-400 px-2.5 py-1 text-[10px] font-bold text-slate-600 dark:text-slate-300 border border-slate-200/50 dark:border-white/5"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="px-1 py-1">
                  <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500 italic">
                    No tags associated with this document.
                  </p>
                </div>
              )}
            </div>
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
