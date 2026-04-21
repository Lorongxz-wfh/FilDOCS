import api from "./api";

export type TrashType = "users" | "offices" | "templates" | "requests" | "documents";

export interface TrashItem {
  id: number;
  deleted_at: string;
  [key: string]: any;
}

export interface TrashListResponse {
  data: TrashItem[];
  current_page: number;
  last_page: number;
  total: number;
}

export const getTrashItems = async (type: TrashType, page = 1, q?: string): Promise<TrashListResponse> => {
  const res = await api.get(`/admin/trash/${type}`, { params: { page, q } });
  return res.data;
};

export const verifySecurity = async (password: string, code?: string) => {
  return api.post("/admin/trash/verify", { password, code });
};

export const restoreTrashItem = async (type: TrashType, id: number, password?: string, code?: string) => {
  return api.post(`/admin/trash/${type}/${id}/restore`, { password, code });
};

export const purgeTrashItem = async (type: TrashType, id: number, password?: string, code?: string) => {
  return api.delete(`/admin/trash/${type}/${id}/purge`, { data: { password, code } });
};
