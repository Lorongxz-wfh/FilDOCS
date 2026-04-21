import { getApi } from "./_base";
import type { DocumentMessage } from "./types";

export async function listDocumentMessages(
  versionId: number,
): Promise<DocumentMessage[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/messages`);
    const payload = res.data;
    console.debug("[messagesApi] Raw response for version", versionId, payload);
    
    // Robust normalization
    if (Array.isArray(payload)) return payload as DocumentMessage[];
    if (payload?.data && Array.isArray(payload.data)) return payload.data as DocumentMessage[];
    if (payload?.messages && Array.isArray(payload.messages)) return payload.messages as DocumentMessage[];
    
    // If it's a single object that looks like a message, wrap it
    if (payload && typeof payload === "object" && (payload.id || payload.message)) {
      return [payload] as DocumentMessage[];
    }
    
    return [] as DocumentMessage[];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load messages (${status})`
        : "Failed to load messages");
    throw new Error(msg);
  }
}

export async function postDocumentMessage(
  versionId: number,
  payload: { message: string; type?: DocumentMessage["type"] },
): Promise<DocumentMessage> {
  try {
    const api = await getApi();
    console.debug("[messagesApi] Posting message to version", versionId, payload);
    const res = await api.post(
      `/document-versions/${versionId}/messages`,
      payload,
    );
    console.debug("[messagesApi] Post response", res.data);
    return (res.data?.data ?? res.data) as DocumentMessage;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to send message (${status})`
        : "Failed to send message");
    throw new Error(msg);
  }
}
