import { getApi } from "./_base";
import type { DocumentMessage } from "./types";

export async function listDocumentMessages(
  versionId: number,
): Promise<DocumentMessage[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/messages`);
    return res.data as DocumentMessage[];
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
    const res = await api.post(
      `/document-versions/${versionId}/messages`,
      payload,
    );
    return res.data as DocumentMessage;
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
