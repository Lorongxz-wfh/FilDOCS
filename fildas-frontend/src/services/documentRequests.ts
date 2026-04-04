import api from "./api";

export type RequestMode = "multi_office" | "multi_doc";

export type DocumentRequestProgress = {
  total: number;
  submitted: number;
  accepted: number;
};

export type DocumentRequestRow = {
  id: number;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "open" | "closed" | "cancelled";
  mode: RequestMode;
  example_original_filename?: string | null;
  example_file_path?: string | null;
  example_preview_path?: string | null;
  created_by_user_id?: number | null;
  created_at?: string;
  updated_at?: string;
  progress?: DocumentRequestProgress;
};

export type DocumentRequestRecipientRow = {
  id: number;
  request_id: number;
  office_id: number;
  status: "pending" | "submitted" | "accepted" | "rejected";
  last_submitted_at: string | null;
  last_reviewed_at: string | null;
  office_name?: string;
  office_code?: string;
  latest_submission_status?: string | null;
  latest_submission_at?: string | null;
};

export type DocumentRequestItemRow = {
  id: number;
  request_id: number;
  title: string;
  description: string | null;
  example_original_filename: string | null;
  example_file_path: string | null;
  example_preview_path: string | null;
  sort_order: number;
  latest_submission?: DocumentRequestSubmissionRow | null;
};

export type DocumentRequestSubmissionFileRow = {
  id: number;
  original_filename: string;
  file_path?: string | null;
  preview_path?: string | null;
  mime?: string | null;
  size_bytes?: number | null;
  created_at?: string;
};

export type DocumentRequestSubmissionRow = {
  id: number;
  recipient_id: number;
  item_id?: number | null;
  attempt_no: number;
  status: "submitted" | "accepted" | "rejected";
  note?: string | null;
  submitted_by_user_id?: number | null;
  qa_reviewed_by_user_id?: number | null;
  qa_review_note?: string | null;
  reviewed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  files: DocumentRequestSubmissionFileRow[];
};

export type DocumentRequestMessageRow = {
  id: number;
  document_request_id: number;
  recipient_id?: number | null;
  item_id?: number | null;
  sender_user_id: number;
  type: "comment" | "system" | "review" | "upload";
  message: string;
  created_at?: string;
  updated_at?: string;
  sender: {
    id: number;
    name: string;
    profile_photo_path?: string | null;
    role?: string | null;
  };
};

// ── List ───────────────────────────────────────────────────────────────────
export async function listDocumentRequests(params?: {
  status?: "open" | "closed" | "cancelled";
  mode?: RequestMode;
  q?: string;
  per_page?: number;
  page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}) {
  const res = await api.get("/document-requests", { params });
  return res.data;
}

export async function listDocumentRequestInbox(params?: {
  q?: string;
  per_page?: number;
  page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}) {
  const res = await api.get("/document-requests/inbox", { params });
  return res.data;
}

export async function listDocumentRequestRecipients(params?: {
  q?: string;
  status?: string;
  request_status?: string;
  per_page?: number;
  page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
}) {
  const res = await api.get("/document-requests/recipients", { params });
  return res.data;
}

export async function listDocumentRequestIndividual(params?: {
  q?: string;
  status?: string;
  request_status?: string;
  per_page?: number;
  page?: number;
  sort_by?: string;
  sort_dir?: "asc" | "desc";
  office_id?: number;
  batch_id?: number;
}) {
  const res = await api.get("/document-requests/individual", { params });
  return res.data;
}

// ── Show ───────────────────────────────────────────────────────────────────
export async function getDocumentRequest(requestId: number) {
  const res = await api.get(`/document-requests/${requestId}`);
  return res.data as {
    request: DocumentRequestRow & {
      office_id?: number | null;
      office_name?: string | null;
      office_code?: string | null;
    };
    recipient?: DocumentRequestRecipientRow | null;
    recipients?: DocumentRequestRecipientRow[];
    items?: DocumentRequestItemRow[];
    latest_submission?: DocumentRequestSubmissionRow | null;
    submissions?: DocumentRequestSubmissionRow[];
  };
}

// ── Create ─────────────────────────────────────────────────────────────────
export type CreateMultiOfficeInput = {
  mode: "multi_office";
  title: string;
  description?: string | null;
  due_at?: string | null;
  office_ids: number[];
  example_file?: File | null;
};

export type CreateMultiDocInput = {
  mode: "multi_doc";
  title: string;
  description?: string | null;
  due_at?: string | null;
  office_id: number;
  items: { title: string; description?: string | null }[];
};

export async function createDocumentRequest(
  input: CreateMultiOfficeInput | CreateMultiDocInput,
) {
  const form = new FormData();
  form.append("mode", input.mode);
  form.append("title", input.title);
  if (input.description != null) form.append("description", input.description);
  if (input.due_at != null) form.append("due_at", input.due_at);

  if (input.mode === "multi_office") {
    for (const id of input.office_ids) form.append("office_ids[]", String(id));
    if (input.example_file) form.append("example_file", input.example_file);
  } else {
    form.append("office_id", String(input.office_id));
    for (let i = 0; i < input.items.length; i++) {
      form.append(`items[${i}][title]`, input.items[i].title);
      if (input.items[i].description != null) {
        form.append(
          `items[${i}][description]`,
          input.items[i].description ?? "",
        );
      }
    }
  }

  const res = await api.post("/document-requests", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { message: string; id: number; item_ids?: number[] };
}

// ── Submit evidence ────────────────────────────────────────────────────────
export async function submitDocumentRequestEvidence(input: {
  request_id: number;
  recipient_id: number;
  item_id?: number | null;
  note?: string | null;
  files: File[];
}) {
  const form = new FormData();
  if (input.note != null) form.append("note", input.note);
  if (input.item_id != null) form.append("item_id", String(input.item_id));
  for (const f of input.files) form.append("files[]", f);

  const res = await api.post(
    `/document-requests/${input.request_id}/recipients/${input.recipient_id}/submit`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data as { message: string; submission_id: number };
}

// ── Review ─────────────────────────────────────────────────────────────────
export async function reviewDocumentRequestSubmission(input: {
  submission_id: number;
  decision: "accepted" | "rejected";
  note?: string | null;
}) {
  const res = await api.post(
    `/document-request-submissions/${input.submission_id}/review`,
    { decision: input.decision, note: input.note ?? null },
  );
  return res.data as { message: string };
}

// ── Signed preview/download links ──────────────────────────────────────────
export async function getDocumentRequestExamplePreviewLink(requestId: number) {
  const res = await api.get(
    `/document-requests/${requestId}/example/preview-link`,
  );
  return res.data as { url: string; expires_in_minutes: number };
}

export async function getDocumentRequestExampleDownloadLink(requestId: number) {
  const res = await api.get(
    `/document-requests/${requestId}/example/download-link`,
  );
  return res.data as { url: string; expires_in_minutes: number };
}

export async function getDocumentRequestItemExamplePreviewLink(itemId: number) {
  const res = await api.get(
    `/document-request-items/${itemId}/example/preview-link`,
  );
  return res.data as { url: string; expires_in_minutes: number };
}

export async function getDocumentRequestItemExampleDownloadLink(itemId: number) {
  const res = await api.get(
    `/document-request-items/${itemId}/example/download-link`,
  );
  return res.data as { url: string; expires_in_minutes: number };
}

export async function uploadDocumentRequestItemExample(
  itemId: number,
  file: File,
) {
  const form = new FormData();
  form.append("example_file", file);
  const res = await api.post(
    `/document-request-items/${itemId}/example`,
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data as {
    message: string;
    example_original_filename: string;
    example_file_path: string;
    example_preview_path: string | null;
  };
}

export async function getDocumentRequestSubmissionFilePreviewLink(
  fileId: number,
) {
  const res = await api.get(
    `/document-request-submission-files/${fileId}/preview-link`,
  );
  return res.data as { url: string; expires_in_minutes: number };
}

export async function getDocumentRequestSubmissionFileDownloadLink(
  fileId: number,
) {
  const res = await api.get(
    `/document-request-submission-files/${fileId}/download-link`,
  );
  return res.data as { url: string; expires_in_minutes: number };
}

// ── Messages ───────────────────────────────────────────────────────────────
export async function getDocumentRequestMessages(
  requestId: number,
  scope?: { recipient_id?: number; item_id?: number; thread?: "batch" | "recipient" | "item" },
) {
  const res = await api.get(`/document-requests/${requestId}/messages`, {
    params: scope,
  });
  return res.data as DocumentRequestMessageRow[];
}

export async function postDocumentRequestMessage(
  requestId: number,
  message: string,
  scope?: { recipient_id?: number; item_id?: number; thread?: "batch" | "recipient" | "item" },
) {
  const res = await api.post(`/document-requests/${requestId}/messages`, {
    message,
    ...scope,
  });
  return res.data as DocumentRequestMessageRow;
}

export async function getDocumentRequestRecipient(
  requestId: number,
  recipientId: number,
) {
  const res = await api.get(
    `/document-requests/${requestId}/recipients/${recipientId}`,
  );
  return res.data as {
    request: DocumentRequestRow & {
      office_id?: number | null;
      office_name?: string | null;
      office_code?: string | null;
    };
    recipient: DocumentRequestRecipientRow;
    latest_submission?: DocumentRequestSubmissionRow | null;
    submissions?: DocumentRequestSubmissionRow[];
  };
}

export async function getDocumentRequestItem(
  requestId: number,
  itemId: number,
) {
  const res = await api.get(`/document-requests/${requestId}/items/${itemId}`);
  return res.data as {
    request: DocumentRequestRow & {
      office_id?: number | null;
      office_name?: string | null;
      office_code?: string | null;
      item_title?: string | null;
      item_description?: string | null;
    };
    recipient: DocumentRequestRecipientRow;
    item: DocumentRequestItemRow;
    latest_submission?: DocumentRequestSubmissionRow | null;
    submissions?: DocumentRequestSubmissionRow[];
  };
}
// ── Update request status (close / cancel) ─────────────────────────────────
export async function updateDocumentRequestStatus(
  requestId: number,
  status: "closed" | "cancelled",
  reason?: string | null,
) {
  const res = await api.patch(`/document-requests/${requestId}/status`, {
    status,
    reason: reason ?? null,
  });
  return res.data as { message: string; id: number };
}

// ── Update request ─────────────────────────────────────────────────────────
export async function updateDocumentRequest(
  requestId: number,
  data: {
    title?: string;
    description?: string | null;
    due_at?: string | null;
  },
) {
  const res = await api.patch(`/document-requests/${requestId}`, data);
  return res.data as { message: string; id: number };
}

// ── Update item ────────────────────────────────────────────────────────────
export async function updateDocumentRequestItem(
  itemId: number,
  data: {
    title?: string;
    description?: string | null;
    due_at?: string | null;
  },
) {
  const res = await api.patch(`/document-request-items/${itemId}`, data);
  return res.data as { message: string; id: number };
}

// ── Update recipient due date ──────────────────────────────────────────────
export async function updateDocumentRequestRecipient(
  requestId: number,
  recipientId: number,
  data: { due_at?: string | null },
) {
  const res = await api.patch(
    `/document-requests/${requestId}/recipients/${recipientId}`,
    data,
  );
  return res.data as { message: string; id: number };
}
