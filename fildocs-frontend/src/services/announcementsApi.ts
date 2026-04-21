import api from "./api";

export interface Announcement {
  id: number;
  title: string;
  body: string;
  type: "info" | "warning" | "urgent";
  is_pinned: boolean;
  is_archived: boolean;
  expires_at: string | null;
  archived_at: string | null;
  created_at: string;
  created_by: string;
}

export interface AnnouncementListResponse {
  data: Announcement[];
  meta: { current_page: number; last_page: number; total: number };
}

export async function listActiveAnnouncements(): Promise<Announcement[]> {
  const res = await api.get("/announcements");
  return res.data;
}

export async function listAllAnnouncements(
  page = 1,
): Promise<AnnouncementListResponse> {
  const res = await api.get("/announcements/all", { params: { page } });
  return res.data;
}

export async function createAnnouncement(payload: {
  title: string;
  body: string;
  type: "info" | "warning" | "urgent";
  is_pinned: boolean;
  expires_at: string | null;
}): Promise<Announcement> {
  const res = await api.post("/announcements", payload);
  return res.data;
}

export async function deleteAnnouncement(id: number): Promise<void> {
  await api.delete(`/announcements/${id}`);
}

export async function archiveAnnouncement(id: number): Promise<void> {
  await api.patch(`/announcements/${id}/archive`);
}

export async function unarchiveAnnouncement(id: number): Promise<void> {
  await api.patch(`/announcements/${id}/unarchive`);
}
