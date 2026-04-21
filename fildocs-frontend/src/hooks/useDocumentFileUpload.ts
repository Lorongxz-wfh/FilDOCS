import React, { useRef, useState, useMemo, useCallback } from "react";
import { replaceDocumentVersionFileWithProgress } from "../services/documents";
import { useToast } from "../components/ui/toast/ToastContext";

type Options = {
  versionId: number;
  onUploadComplete: (version?: any) => void;
};

const ALLOWED_EXTENSIONS = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i;
const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export function useDocumentFileUpload({
  versionId,
  onUploadComplete,
}: Options) {
  const { push } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const isValidFile = (file: File): boolean =>
    (ALLOWED_MIME.has(file.type) || ALLOWED_EXTENSIONS.test(file.name)) &&
    file.size <= MAX_SIZE;

  const uploadFile = useCallback(async (file: File) => {
    if (!isValidFile(file)) {
      push({
        type: "error",
        title: "Invalid file",
        message: "File must be PDF, Word, Excel, or PowerPoint under 10MB.",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const updatedVersion = await replaceDocumentVersionFileWithProgress(versionId, file, (pct) =>
        setUploadProgress(pct),
      );
      push({
        type: "success",
        title: "Upload complete",
        message: "File replaced successfully.",
      });
      onUploadComplete(updatedVersion);
    } catch (e: any) {
      push({
        type: "error",
        title: "Upload failed",
        message: e?.message ?? "Upload failed.",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [versionId, onUploadComplete, push]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = Array.from(e.dataTransfer.files)[0];
    if (file) await uploadFile(file);
  }, [uploadFile]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const triggerFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return useMemo(() => ({
    fileInputRef,
    isUploading,
    uploadProgress,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    triggerFilePicker
  }), [
    fileInputRef,
    isUploading,
    uploadProgress,
    handleFileSelect,
    handleDrop,
    handleDragOver,
    handleDragLeave,
    triggerFilePicker
  ]);
}
