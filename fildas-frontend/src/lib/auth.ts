import { api } from "../services/api";

export type AuthUser = {
  id: number;
  full_name: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  profile_photo_path: string | null;
  profile_photo_url?: string | null;
  signature_path?: string | null;
  signature_url?: string | null;
  email: string;
  role: string;

  // Always prefer this for comparisons/permission checks
  office_id: number | null;

  // Extra display info (optional)
  office: { id: number; name: string; code: string } | null;
  two_factor_enabled: boolean;
};

export const AUTH_USER_KEY = "auth_user";
export const AUTH_TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Back-compat cleanup (you have some old code using "authtoken")
export function clearAuth(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem("authtoken");
  clearAuthUser();
  sessionStorage.removeItem("from_workqueue_session");
}

export function getAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (!raw) return null;

    const u = JSON.parse(raw) as any;

    // Back-compat: older payloads only had `office: {id...}` and no `office_id`
    if (u && (u.office_id === undefined || u.office_id === null)) {
      u.office_id = u.office?.id ?? null;
    }

    return u as AuthUser;
  } catch {
    return null;
  }
}

export function setAuthUser(user: AuthUser): void {
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthUser(): void {
  localStorage.removeItem(AUTH_USER_KEY);
}

export function clearAuthAndRedirect(): void {
  clearAuth();
  window.location.href = "/login";
}

/**
 * Perform a graceful logout by notifying the backend and then clearing local state.
 */
export async function logoutUser(reason: "manual" | "inactivity" = "manual"): Promise<void> {
  try {
    // We attempt to notify the backend, but we don't block the UI logout on failure
    await api.post("/logout", { reason });
  } catch (err) {
    console.error("Failed to notify backend of logout:", err);
  } finally {
    clearAuthAndRedirect();
  }
}

