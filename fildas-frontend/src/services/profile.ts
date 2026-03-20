import api from "./api";

export interface ProfileUpdatePayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  email: string;
}

export interface PasswordChangePayload {
  current_password: string;
  password: string;
  password_confirmation: string;
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  const { data } = await api.patch("/profile", payload);
  return data.user;
}

export async function changePassword(payload: PasswordChangePayload) {
  const { data } = await api.post("/profile/password", payload);
  return data;
}

export async function uploadProfilePhoto(file: File) {
  const form = new FormData();
  form.append("photo", file);
  const { data } = await api.post("/profile/photo", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.user;
}

export async function removeProfilePhoto() {
  const { data } = await api.delete("/profile/photo");
  return data.user;
}

export async function updateNotificationPreferences(payload: {
  email_doc_updates: boolean;
  email_approvals: boolean;
}) {
  const { data } = await api.patch("/profile/notification-preferences", payload);
  return data as { email_doc_updates: boolean; email_approvals: boolean };
}
