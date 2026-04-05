import { clearAuthAndRedirect } from "../lib/auth";
import { getAuthUser } from "../lib/auth";
import { getApi, API_BASE, normalizePaginated } from "./_base";
import type {
  CreateDocumentPayload,
  Document,
  Paginated,
  DocumentVersion,
  ApiError,
  Office,
  DocumentShares,
  OfficeUser,
} from "./types";

let officesCache: Office[] | null = null;

export async function createDocumentWithProgress(
  payload: CreateDocumentPayload,
  onProgress?: (pct: number) => void,
): Promise<Document> {
  const formData = new FormData();
  formData.append("title", payload.title);
  formData.append("doctype", payload.doctype);

  if (payload.workflow_type) {
    formData.append("workflow_type", payload.workflow_type);
  }

  if (payload.review_office_id != null) {
    formData.append("review_office_id", String(payload.review_office_id));
  }

  if (payload.routing_mode) {
    formData.append("routing_mode", payload.routing_mode);
  }

  if (payload.custom_review_office_ids?.length) {
    for (const id of payload.custom_review_office_ids) {
      formData.append("custom_review_office_ids[]", String(id));
    }
  }

  if (payload.visibility_scope)
    formData.append("visibility_scope", payload.visibility_scope);
  if (payload.school_year) formData.append("school_year", payload.school_year);
  if (payload.semester) formData.append("semester", payload.semester);
  if (payload.description) formData.append("description", payload.description);

  if (payload.effective_date) {
    formData.append("effective_date", payload.effective_date);
  }

  if (payload.acting_as_office_id)
    formData.append("acting_as_office_id", String(payload.acting_as_office_id));

  if (payload.file) formData.append("file", payload.file);

  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Not authenticated");

  const url = `${API_BASE}/documents`;

  return await new Promise<Document>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      if (xhr.status === 401) {
        clearAuthAndRedirect();
        return;
      }

      const ok = xhr.status >= 200 && xhr.status < 300;
      if (!ok) {
        try {
          const data = JSON.parse(xhr.responseText || "{}");
          const err: ApiError = new Error(
            data.message || `Request failed (${xhr.status})`,
          );
          err.status = xhr.status;
          if (data?.errors && typeof data.errors === "object")
            err.details = data.errors;
          reject(err);
        } catch {
          reject(new Error(`Request failed (${xhr.status})`));
        }
        return;
      }

      try {
        const json = JSON.parse(xhr.responseText || "{}");
        const doc = (json?.data ?? json) as Document;
        resolve(doc);
      } catch {
        reject(new Error("Invalid server response"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(formData);
  });
}

export async function listDocumentsPage(params?: {
  page?: number;
  perPage?: number;

  // server-side search/filters
  q?: string;
  status?: string | string[];
  doctype?: string;
  owner_office_id?: number;
  assigned_office_id?: number;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD

  // phase / version
  phase?: string;
  version_number?: number;

  // document library space
  space?: "all" | "workqueue" | "library" | "archive";

  // document library scope
  scope?: "all" | "owned" | "shared" | "assigned" | "participant";

  // sorting
  sort_by?: "title" | "created_at" | "code" | "updated_at" | "distributed_at";
  sort_dir?: "asc" | "desc";
  archived?: number;
  archive_reason?: string;
}): Promise<Paginated<Document>> {
  try {
    const api = await getApi();
    const res = await api.get("/documents", {
      params: {
        page: params?.page ?? 1,
        per_page: params?.perPage ?? 25,

        q: params?.q,
        status: params?.status,
        doctype: params?.doctype,
        owner_office_id: params?.owner_office_id,
        assigned_office_id: params?.assigned_office_id,
        date_from: params?.date_from,
        date_to: params?.date_to,

        phase: params?.phase,
        version_number: params?.version_number,
        space: params?.space,
        scope: params?.scope,
        sort_by: params?.sort_by,
        sort_dir: params?.sort_dir,
        archived: params?.archived,
        archive_reason: params?.archive_reason,
      },
    });

    return normalizePaginated<Document>(res.data);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load documents (${status})`
        : "Failed to load documents");
    throw new Error(msg);
  }
}

// Backwards compatible: existing pages still get Document[]
export async function listDocuments(): Promise<Document[]> {
  const { data } = await listDocumentsPage({ page: 1, perPage: 25 });
  return data;
}

export async function getDocument(id: number): Promise<Document> {
  try {
    const api = await getApi();
    const res = await api.get(`/documents/${id}`);
    const doc = res.data?.data ?? res.data;

    if (!doc || typeof doc !== "object") {
      throw new Error("Invalid document response format");
    }

    return doc as Document;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load document (${status})`
        : "Failed to load document");
    throw new Error(msg);
  }
}

export async function getDocumentVersions(
  documentId: number,
): Promise<DocumentVersion[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/documents/${documentId}/versions`);
    const data = res.data;
    const versions = Array.isArray(data) ? data : data?.data;

    if (!Array.isArray(versions)) {
      throw new Error("Invalid versions response format");
    }

    const cleaned = versions as DocumentVersion[];

    // Keep newest first (safety) if backend ever changes ordering
    cleaned.sort((a, b) => Number(b.version_number) - Number(a.version_number));

    return cleaned;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load document versions (${status})`
        : "Failed to load document versions");
    throw new Error(msg);
  }
}

export async function createRevision(
  documentId: number,
  payload?: { revision_reason?: string | null },
): Promise<DocumentVersion> {
  try {
    const api = await getApi();
    const res = await api.post(
      `/documents/${documentId}/revision`,
      payload ?? {},
    );
    return res.data as DocumentVersion;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function cancelRevision(versionId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.post(`/document-versions/${versionId}/cancel`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function deleteDraftVersion(versionId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.delete(`/document-versions/${versionId}`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function getDocumentVersion(
  versionId: number,
): Promise<{ version: DocumentVersion; document: Document }> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}`);
    const json = res.data;
    if (!json?.version || !json?.document) {
      throw new Error("Invalid document version response format");
    }

    return {
      version: json.version as DocumentVersion,
      document: (json.document.data ?? json.document) as Document,
    };
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load document version (${status})`
        : "Failed to load document version");
    throw new Error(msg);
  }
}

export async function getDocumentPreviewUrl(
  versionId: number,
): Promise<string> {
  const { url } = await getDocumentPreviewLink(versionId);
  return url;
}

export async function replaceDocumentVersionFileWithProgress(
  versionId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE}/document-versions/${versionId}/replace-file`;

  return await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);

    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const pct = Math.round((event.loaded / event.total) * 100);
      onProgress?.(pct);
    };

    xhr.onload = () => {
      const ok = xhr.status >= 200 && xhr.status < 300;
      if (ok) return resolve();
      if (xhr.status === 401) {
        clearAuthAndRedirect();
        return;
      }

      try {
        const data = JSON.parse(xhr.responseText || "{}");
        reject(new Error(data.message || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => reject(new Error("Upload failed (network error)"));
    xhr.send(formData);
  });
}

export async function applyInAppSignature(
  versionId: number,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<void> {
  const token = localStorage.getItem("auth_token");
  if (!token) throw new Error("Not authenticated");

  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_BASE}/document-versions/${versionId}/apply-signature`;

  return await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("Accept", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress?.(Math.round((event.loaded / event.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      if (xhr.status === 401) { clearAuthAndRedirect(); return; }
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        reject(new Error(data.message || `Upload failed (${xhr.status})`));
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during signature upload."));
    xhr.send(formData);
  });
}

export async function removeInAppSignature(versionId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.delete(`/document-versions/${versionId}/apply-signature`);
    invalidatePreviewCache(versionId);
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || "Failed to remove signature.";
    throw new Error(msg);
  }
}

export async function getOriginalFileBlobUrl(versionId: number): Promise<string> {
  try {
    const api = await getApi();
    const resp = await api.get(`/document-versions/${versionId}/original-file`, {
      responseType: "arraybuffer",
    });
    const blob = new Blob([resp.data], { type: "application/pdf" });
    return URL.createObjectURL(blob);
  } catch (e: any) {
    const msg = e?.response?.data?.message || e?.message || "Failed to load original file.";
    throw new Error(msg);
  }
}

export async function updateDocumentCode(
  documentId: number,
  code: string,
): Promise<void> {
  try {
    const api = await getApi();
    await api.patch(`/documents/${documentId}`, { code });
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function updateDocumentTitle(
  documentId: number,
  title: string,
): Promise<void> {
  try {
    const api = await getApi();
    await api.patch(`/documents/${documentId}`, { title });
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function updateDocumentVersionDescription(
  versionId: number,
  description: string,
): Promise<DocumentVersion> {
  try {
    const api = await getApi();
    const res = await api.patch(`/document-versions/${versionId}`, {
      description,
    });
    const v = res.data?.version ?? res.data;
    return v as DocumentVersion;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function updateDocumentVersionEffectiveDate(
  versionId: number,
  effective_date: string | null,
): Promise<DocumentVersion> {
  try {
    const api = await getApi();
    const res = await api.patch(`/document-versions/${versionId}`, {
      effective_date,
    });
    const v = res.data?.version ?? res.data;
    return v as DocumentVersion;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function downloadDocument(
  version: DocumentVersion,
): Promise<void> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${version.id}/download`, {
      responseType: "blob",
      headers: {
        Accept: "application/octet-stream",
      },
    });

    const blob = res.data as Blob;
    const objectUrl = window.URL.createObjectURL(blob);

    const a = window.document.createElement("a");
    a.href = objectUrl;
    a.download = version.original_filename || `document-version-${version.id}`;
    window.document.body.appendChild(a);
    a.click();
    a.remove();

    window.URL.revokeObjectURL(objectUrl);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Download failed (${status})` : "Download failed");
    throw new Error(msg);
  }
}

export async function getDocumentShares(
  documentId: number,
): Promise<DocumentShares> {
  try {
    const api = await getApi();
    const res = await api.get(`/documents/${documentId}/shares`, {
      params: { t: Date.now() },
    });
    return res.data as DocumentShares;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Failed to load shares (${status})` : "Failed to load shares");
    throw new Error(msg);
  }
}

export async function setDocumentShares(
  documentId: number,
  officeIds: number[],
): Promise<DocumentShares> {
  try {
    const api = await getApi();
    const res = await api.post(`/documents/${documentId}/shares`, {
      office_ids: officeIds,
    });
    return res.data as DocumentShares;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to update shares (${status})`
        : "Failed to update shares");
    throw new Error(msg);
  }
}

export async function getDocumentTags(documentId: number): Promise<string[]> {
  const api = await getApi();
  const res = await api.get(`/documents/${documentId}/tags`);
  const tags = res.data?.tags;
  return Array.isArray(tags) ? (tags as string[]) : [];
}

export async function setDocumentTags(
  documentId: number,
  tags: string[],
): Promise<string[]> {
  const api = await getApi();
  const res = await api.put(`/documents/${documentId}/tags`, { tags });
  const out = res.data?.tags;
  return Array.isArray(out) ? (out as string[]) : [];
}

export async function listOffices(): Promise<Office[]> {
  if (officesCache) return officesCache;

  try {
    const api = await getApi();
    const res = await api.get("/offices");
    officesCache = res.data as Office[];
    return officesCache;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load offices (${status})`
        : "Failed to load offices");
    throw new Error(msg);
  }
}

export const getCurrentUserOfficeId = (): number => {
  return getAuthUser()?.office?.id ?? 0;
};

export async function getOfficeUsers(officeId: number): Promise<OfficeUser[]> {
  try {
    const api = await getApi();
    const res = await api.get<OfficeUser[]>(`/offices/${officeId}/users`);
    return res.data;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load office users (${status})`
        : "Failed to load office users");
    throw new Error(msg);
  }
}

const _previewLinkCache = new Map<number, { url: string; expiresAt: number }>();

export function invalidatePreviewCache(versionId: number): void {
  _previewLinkCache.delete(versionId);
}

export async function regenerateDocumentPreview(
  versionId: number,
): Promise<DocumentVersion> {
  invalidatePreviewCache(versionId);
  try {
    const api = await getApi();
    const res = await api.post(`/document-versions/${versionId}/regenerate-preview`);
    return res.data as DocumentVersion;
  } catch (e: any) {
    const msg =
      e?.response?.data?.message ||
      (e?.response?.status
        ? `Regenerate failed (${e.response.status})`
        : "Could not regenerate preview");
    throw new Error(msg);
  }
}

export async function getDocumentPreviewLink(
  versionId: number,
): Promise<{ url: string; expires_in_minutes: number }> {
  const cached = _previewLinkCache.get(versionId);
  if (cached && Date.now() < cached.expiresAt) {
    return { url: cached.url, expires_in_minutes: 0 };
  }
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/preview-link`);
    const data = res.data as { url: string; expires_in_minutes: number };
    const ttlMs = Math.max(0, (data.expires_in_minutes - 2) * 60 * 1000);
    _previewLinkCache.set(versionId, { url: data.url, expiresAt: Date.now() + ttlMs });
    return data;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to get preview link (${status})`
        : "Failed to get preview link");
    throw new Error(msg);
  }
}


export async function archiveDocument(documentId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.post(`/documents/${documentId}/archive`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}

export async function restoreDocument(documentId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.post(`/documents/${documentId}/restore`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Failed (${status})` : "Failed");
    throw new Error(msg);
  }
}
export async function deleteDocument(documentId: number): Promise<void> {
  try {
    const api = await getApi();
    await api.delete(`/documents/${documentId}`);
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message || (status ? `Delete failed (${status})` : "Delete failed");
    throw new Error(msg);
  }
}
