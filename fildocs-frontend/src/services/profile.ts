import api from "./api";
 
export async function fetchProfile() {
   const { data } = await api.get("/profile");
   return data.user;
}

export interface ProfileUpdatePayload {
  first_name: string;
  middle_name?: string;
  last_name: string;
  suffix?: string;
  email: string;
  current_password?: string;
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

export async function uploadSignature(file: File) {
  const form = new FormData();
  form.append("signature", file);
  const { data } = await api.post("/profile/signature", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.user;
}

export async function removeSignature() {
  const { data } = await api.delete("/profile/signature");
  return data.user;
}

export async function updateNotificationPreferences(payload: {
  email_doc_updates: boolean;
  email_approvals: boolean;
  email_requests: boolean;
}) {
  const { data } = await api.patch("/profile/notification-preferences", payload);
  return data as { email_doc_updates: boolean; email_approvals: boolean; email_requests: boolean };
}

export async function updateThemePreference(theme: "light" | "dark" | "system") {
  const { data } = await api.patch("/profile/theme-preference", { theme_preference: theme });
  return data.user;
}

export async function updateFontSizePreference(size: "small" | "default" | "large") {
  const { data } = await api.patch("/profile/font-size-preference", { font_size_preference: size });
  return data.user;
}

// ── Two-Factor Authentication ──────────────────────────────────────────────
export async function setupTwoFactor() {
  const { data } = await api.get("/profile/two-factor/setup");
  return data as { secret: string; qr_image: string; qr_url: string };
}

export async function confirmTwoFactor(payload: { secret: string; code: string }) {
  const { data } = await api.post("/profile/two-factor/confirm", payload);
  return data as { message: string; recovery_codes: string[] };
}

export async function disableTwoFactor(payload: {
  password: string;
  code?: string;
  recovery_code?: string;
}) {
  const { data } = await api.post("/profile/two-factor/disable", payload);
  return data;
}

export async function getRecoveryCodes(password: string) {
  const { data } = await api.post("/profile/two-factor/recovery-codes", { password });
  return data.recovery_codes as string[];
}

export async function regenerateRecoveryCodes(password: string) {
  const { data } = await api.post("/profile/two-factor/recovery-codes/regenerate", { password });
  return data as { message: string; recovery_codes: string[] };
}
