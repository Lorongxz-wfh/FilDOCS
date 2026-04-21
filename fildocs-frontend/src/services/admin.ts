import api from "./api";

export interface AdminUser {
  id: number;
  full_name: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
  email: string;
  profile_photo_path?: string | null;
  profile_photo_url?: string | null;
  role_id: number | null;
  office_id: number | null;

  disabled_at?: string | null;
  disabled_by?: number | null;
  last_active_at?: string | null;
  deleted_at?: string | null;

  created_at: string;
  updated_at: string;
  two_factor_enabled?: boolean;
  role?: {
    id: number;
    name: string;
  } | null;
  office?: {
    id: number;
    name: string;
    code: string;
  } | null;
}

export interface AdminUsersResponse {
  data: AdminUser[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from?: number;
    to?: number;
  };
}

export async function getAdminUsers(params: {
  page?: number;
  per_page?: number;
  q?: string;
  status?: "active" | "disabled" | "";
  role_id?: number | "";
  sort_by?: "first_name" | "last_name" | "email" | "created_at";
  sort_dir?: "asc" | "desc";
}): Promise<AdminUsersResponse> {
  const res = await api.get("/admin/users", { params });
  return res.data as AdminUsersResponse;
}

export type AdminRole = {
  id: number;
  name: string;
  label: string;
};

export async function getAdminRoles(): Promise<AdminRole[]> {
  const res = await api.get("/admin/roles");
  return res.data as AdminRole[];
}

export type AdminOffice = {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  type?: string | null;
  cluster_kind?: "vp" | "president" | null;
  parent_office_id?: number | null;
  deleted_at?: string | null;

  parent_office?: {
    id: number;
    code: string;
    name: string;
  } | null;
};

export interface AdminOfficesResponse {
  data: AdminOffice[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}

export async function getAdminOffices(params?: {
  q?: string;
  status?: "active" | "disabled" | "all";
  type?: string;
  page?: number;
  per_page?: number;
  sort_by?: "name" | "code" | "type" | "created_at";
  sort_dir?: "asc" | "desc";
}): Promise<AdminOfficesResponse> {
  const res = await api.get("/admin/offices", { params });
  return res.data as AdminOfficesResponse;
}

export type AdminOfficeCreatePayload = {
  name: string;
  code: string;
  description?: string | null;
  type?: string | null;
  cluster_kind?: "vp" | "president" | null;
  parent_office_id?: number | null;
};

export async function createAdminOffice(
  payload: AdminOfficeCreatePayload,
): Promise<{ office: AdminOffice }> {
  const res = await api.post("/admin/offices", payload);
  return res.data as { office: AdminOffice };
}

export type AdminOfficeUpdatePayload = Partial<AdminOfficeCreatePayload>;

export async function updateAdminOffice(
  officeId: number,
  payload: AdminOfficeUpdatePayload,
): Promise<{ office: AdminOffice }> {
  const res = await api.patch(`/admin/offices/${officeId}`, payload);
  return res.data as { office: AdminOffice };
}

export async function disableAdminOffice(
  officeId: number,
): Promise<{ message: string }> {
  const res = await api.delete(`/admin/offices/${officeId}`);
  return res.data as { message: string };
}

export async function restoreAdminOffice(
  officeId: number,
): Promise<{ office: AdminOffice }> {
  const res = await api.patch(`/admin/offices/${officeId}/restore`);
  return res.data as { office: AdminOffice };
}

export type AdminUserUpdatePayload = Partial<{
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  suffix: string | null;
  email: string | null;
  office_id: number | null;
  role_id: number | null;
  password?: string;
}>;

export async function updateAdminUser(
  userId: number,
  payload: AdminUserUpdatePayload,
): Promise<{ user: AdminUser }> {
  const res = await api.patch(`/admin/users/${userId}`, payload);
  return res.data as { user: AdminUser };
}

export type AdminUserCreatePayload = {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix?: string | null;
  email: string;
  office_id?: number | null;
  role_id?: number | null;
  password?: string;
};

export async function createAdminUser(
  payload: AdminUserCreatePayload,
): Promise<{ user: AdminUser }> {
  const res = await api.post("/admin/users", payload);
  return res.data as { user: AdminUser };
}

export async function disableAdminUser(
  userId: number,
): Promise<{ user: AdminUser }> {
  const res = await api.patch(`/admin/users/${userId}/disable`);
  return res.data as { user: AdminUser };
}

export async function enableAdminUser(
  userId: number,
): Promise<{ user: AdminUser }> {
  const res = await api.patch(`/admin/users/${userId}/enable`);
  return res.data as { user: AdminUser };
}

export async function deleteAdminUser(
  userId: number,
): Promise<{ message: string }> {
  const res = await api.delete(`/admin/users/${userId}`);
  return res.data as { message: string };
}

export async function uploadAdminUserPhoto(
  userId: number,
  file: File,
): Promise<{ user: AdminUser }> {
  const formData = new FormData();
  formData.append("photo", file);
  const res = await api.post(`/admin/users/${userId}/photo`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data as { user: AdminUser };
}

export async function removeAdminUserPhoto(
  userId: number,
): Promise<{ user: AdminUser }> {
  const res = await api.delete(`/admin/users/${userId}/photo`);
  return res.data as { user: AdminUser };
}

export async function resetAdminUserTwoFactor(
  userId: number,
): Promise<{ message: string; user: AdminUser }> {
  const res = await api.patch(`/admin/users/${userId}/reset-2fa`);
  return res.data as { message: string; user: AdminUser };
}

// ── Admin Sessions ──────────────────────────────────────────────────────────
export interface AdminSession {
  id: number;
  user: AdminUser;
  ip_address: string;
  user_agent: string;
  last_used_at: string;
  created_at: string;
}

export async function getAdminSessions(): Promise<AdminSession[]> {
  const res = await api.get("/admin/sessions");
  return res.data as AdminSession[];
}

export async function revokeAdminSession(id: number): Promise<{ message: string }> {
  const res = await api.delete(`/admin/sessions/${id}`);
  return res.data;
}

export async function getAdminSessionActivity(id: number): Promise<any[]> {
  const res = await api.get(`/admin/sessions/${id}/activity`);
  return res.data;
}
