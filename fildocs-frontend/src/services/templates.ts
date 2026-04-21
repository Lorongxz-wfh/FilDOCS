import api from "./api";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TemplateOffice = {
  id: number;
  name: string;
  code: string;
};

export type TemplateUploader = {
  id: number;
  name: string;
};

export type DocumentTemplate = {
  id: number;
  name: string;
  description: string | null;
  original_filename: string;
  file_size: number;
  file_size_label: string;
  mime_type: string;
  is_global: boolean;
  office: TemplateOffice | null;
  uploaded_by: TemplateUploader | null;
  can_delete: boolean;
  thumbnail_url: string | null;
  tags: string[];
  created_at: string;
};

export type UploadTemplatePayload = {
  name: string;
  description?: string;
  file: File;
  is_global?: boolean;
  tags?: string[];
};

// ── In-memory cache ───────────────────────────────────────────────────────────
// Stores the full unfiltered list. Client-side filtering means we only ever
// need one cached result. Invalidate on upload/delete; page mount uses cache.

let _cache: DocumentTemplate[] | null = null;

export function invalidateTemplatesCache(): void {
  _cache = null;
}

export function appendToTemplatesCache(template: DocumentTemplate): void {
  if (_cache) _cache = [template, ..._cache];
}

export function removeFromTemplatesCache(id: number): void {
  if (_cache) _cache = _cache.filter((t) => t.id !== id);
}

// ── API calls ─────────────────────────────────────────────────────────────────

/**
 * List templates visible to the current user.
 * Unfiltered requests are served from cache when available.
 */
export async function listTemplates(opts?: {
  q?: string;
  tag?: string;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}): Promise<DocumentTemplate[]> {
  const isUnfiltered = !opts?.q && !opts?.tag && !opts?.sort_by;

  if (isUnfiltered && _cache) {
    return _cache;
  }

  const params: Record<string, string> = {};
  if (opts?.q?.trim()) params.q = opts.q.trim();
  if (opts?.tag?.trim()) params.tag = opts.tag.trim();
  if (opts?.sort_by) params.sort_by = opts.sort_by;
  if (opts?.sort_dir) params.sort_dir = opts.sort_dir;

  const res = await api.get("/templates", {
    params: Object.keys(params).length ? params : undefined,
  });
  const data = (res.data?.data ?? []) as DocumentTemplate[];

  if (isUnfiltered) _cache = data;

  return data;
}

export async function updateTemplateTags(
  id: number,
  tags: string[],
): Promise<string[]> {
  const res = await api.patch(`/templates/${id}/tags`, { tags });
  return res.data.tags as string[];
}

/**
 * Upload a new template.
 */
export async function uploadTemplate(
  payload: UploadTemplatePayload,
): Promise<DocumentTemplate> {
  const form = new FormData();
  form.append("name", payload.name.trim());
  if (payload.description?.trim()) {
    form.append("description", payload.description.trim());
  }
  form.append("file", payload.file);
  if (payload.is_global !== undefined) {
    form.append("is_global", payload.is_global ? "1" : "0");
  }
  if (payload.tags?.length) {
    payload.tags.forEach((tag) => form.append("tags[]", tag));
  }

  const res = await api.post("/templates", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data.template as DocumentTemplate;
}

/**
 * Delete a template by id.
 */
export async function deleteTemplate(id: number): Promise<void> {
  await api.delete(`/templates/${id}`);
}

/**
 * Trigger a file download for a template.
 * Fetches a blob and creates a temporary <a> link.
 */
export async function downloadTemplate(
  id: number,
  filename: string,
): Promise<void> {
  const res = await api.get(`/templates/${id}/download`, {
    responseType: "blob",
  });

  const url = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns a short label based on mime type. */
export function templateFileTypeLabel(mimeType: string): string {
  const map: Record<string, string> = {
    "application/pdf": "PDF",
    "application/msword": "DOC",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "DOCX",
    "application/vnd.ms-excel": "XLS",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
    "application/vnd.ms-powerpoint": "PPT",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "PPTX",
  };
  return map[mimeType] ?? "FILE";
}

/** Color classes per file type for badges. */
export function templateFileTypeColor(mimeType: string): string {
  if (mimeType.includes("pdf")) {
    return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800";
  }
  if (mimeType.includes("word") || mimeType.includes("msword")) {
    return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800";
  }
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800";
  }
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) {
    return "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-400 dark:border-orange-800";
  }
  return "bg-slate-50 text-slate-700 border-slate-200 dark:bg-surface-400 dark:text-slate-300 dark:border-surface-400";
}
export async function getTemplatePreviewLink(id: number) {
  const res = await api.get(`/templates/${id}/preview-link`);
  return res.data as { url: string; expires_in_minutes: number };
}
