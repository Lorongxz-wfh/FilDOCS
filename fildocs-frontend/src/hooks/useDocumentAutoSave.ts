import { useEffect, useRef } from "react";
import {
  updateDocumentTitle,
  updateDocumentVersionDescription,
  updateDocumentVersionEffectiveDate,
  type DocumentVersion,
} from "../services/documents";

type Options = {
  documentId: number;
  version: DocumentVersion | null;
  localTitle: string;
  initialTitle: string;
  setInitialTitle: (v: string) => void;
  localDesc: string;
  initialDesc: string;
  setInitialDesc: (v: string) => void;
  localEffectiveDate: string;
  initialEffectiveDate: string;
  setInitialEffectiveDate: (v: string) => void;
  canEditEffectiveDate: boolean;
  onVersionUpdated: (v: Partial<DocumentVersion>) => void;
  onChanged?: () => Promise<void> | void;
};

export function useDocumentAutoSave({
  documentId,
  version,
  localTitle,
  initialTitle,
  setInitialTitle,
  localDesc,
  initialDesc,
  setInitialDesc,
  localEffectiveDate,
  initialEffectiveDate,
  setInitialEffectiveDate,
  canEditEffectiveDate,
  onVersionUpdated,
  onChanged,
}: Options) {
  const titleTimer = useRef<number | null>(null);
  const descTimer = useRef<number | null>(null);
  const dateTimer = useRef<number | null>(null);

  // Title auto-save
  useEffect(() => {
    if (!version || version.status !== "Draft") return;
    if (localTitle === initialTitle) return;

    if (titleTimer.current) window.clearTimeout(titleTimer.current);
    titleTimer.current = window.setTimeout(async () => {
      try {
        await updateDocumentTitle(documentId, localTitle);
        setInitialTitle(localTitle);
        if (onChanged) await onChanged();
      } catch (e) {
        console.error("Auto-save title failed", e);
      }
    }, 600);

    return () => {
      if (titleTimer.current) window.clearTimeout(titleTimer.current);
    };
  }, [localTitle, initialTitle, version?.status, documentId, onChanged]);

  // Description auto-save
  useEffect(() => {
    if (!version || version.status !== "Draft") return;
    if (localDesc === initialDesc) return;

    if (descTimer.current) window.clearTimeout(descTimer.current);
    descTimer.current = window.setTimeout(async () => {
      try {
        const updated = await updateDocumentVersionDescription(
          version.id,
          localDesc,
        );
        onVersionUpdated(updated);
        setInitialDesc(localDesc);
        if (onChanged) await onChanged();
      } catch (e) {
        console.error("Auto-save description failed", e);
      }
    }, 600);

    return () => {
      if (descTimer.current) window.clearTimeout(descTimer.current);
    };
  }, [localDesc, initialDesc, version?.id, version?.status, onChanged]);

  // Effective date auto-save
  useEffect(() => {
    if (!version || !canEditEffectiveDate) return;
    if (localEffectiveDate === initialEffectiveDate) return;

    if (dateTimer.current) window.clearTimeout(dateTimer.current);
    dateTimer.current = window.setTimeout(async () => {
      try {
        const updated = await updateDocumentVersionEffectiveDate(
          version.id,
          localEffectiveDate.trim() || null,
        );
        onVersionUpdated(updated);
        setInitialEffectiveDate(localEffectiveDate);
        if (onChanged) await onChanged();
      } catch (e) {
        console.error("Auto-save effective date failed", e);
      }
    }, 600);

    return () => {
      if (dateTimer.current) window.clearTimeout(dateTimer.current);
    };
  }, [
    canEditEffectiveDate,
    localEffectiveDate,
    initialEffectiveDate,
    version?.id,
    onChanged,
  ]);
}
