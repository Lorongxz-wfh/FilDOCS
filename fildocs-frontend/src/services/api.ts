import axios from "axios";
import { clearAuthAndRedirect } from "../lib/auth";

// Smart Environment Detection: 
// Automatically uses localhost:8001 when running locally, 
// and the production Render URL when deployed.
const BASE_URL = 
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:8001/api"
    : "https://fildocs.onrender.com/api";

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");

  // ── Single-Threaded Dev Server Traffic Control ────────────────────────
  // If an upload is active, we cancel low-priority background polls 
  // (maintenance, notifications) so they don't 'cut in line' on the 
  // single-threaded local development server (artisan serve).
  const isBackgroundPoll = config.url?.includes('/maintenance') || 
                           config.url?.includes('/notifications') || 
                           config.url?.includes('/unread-count');
  
  if (isBackgroundPoll && (window as any).IS_UPLOADING_BACKUP) {
    const source = axios.CancelToken.source();
    config.cancelToken = source.token;
    source.cancel("Upload in progress. Background polling paused.");
    return config;
  }

  config.headers = config.headers ?? {};
  config.headers.Accept = "application/json";

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // ── Intentional Cancellation Handling ────────────────────────────────
    // If we cancelled a request due to an upload bottleneck, we should 
    // swallow the error so it doesn't trigger "Network Error" UI boxes.
    if (axios.isCancel(error)) {
      console.log("Background request paused:", error.message);
      return new Promise(() => {}); // Never-resolving promise keeps UI clean
    }

    const status = error?.response?.status;

    if (status === 401 || status === 419) {
      // PROD RESILIENCE: 
      // Do not auto-logout if we are currently in a Restoration window.
      // During restore, the users table may be empty for a few seconds/minutes.
      if (localStorage.getItem('fildocs_restoring_node')) {
        console.warn("Auth check failed during active restoration. Ignoring redirect.");
        return Promise.reject(error);
      }

      clearAuthAndRedirect();
      return Promise.reject(error);
    }

    // Force logout during maintenance hard-lock
    if (status === 503 && error?.response?.data?.force_logout) {
      // If we are already on the login page, don't redirect to /maintenance. 
      // This allows the user to see the maintenance message as an error on the form.
      if (window.location.pathname === "/login") {
        return Promise.reject(error);
      }

      const { message, expires_at } = error.response.data;
      if (message) localStorage.setItem("maintenance_message", message);
      if (expires_at) localStorage.setItem("maintenance_expires_at", expires_at);
      
      window.location.href = "/maintenance";
      return Promise.reject(error);
    }

    return Promise.reject(error);
  },
);

export async function ensureCsrfCookie() {
  // Use the local axios instance to ensure base URL consistency
  await axios.get(`${BASE_URL.replace("/api", "")}/sanctum/csrf-cookie`, {
    withCredentials: true,
  });
}

// Exporting named 'api' and default to ensure compatibility across all imports
export { api };
export default api;

/**
 * Resolves a relative backend path to a fully qualified URL.
 */
export const getAssetUrl = (path: string | null | undefined): string | null => {
  if (!path) return null;
  if (path.startsWith("http") || path.startsWith("data:") || path.startsWith("blob:")) return path;
  
  // Prefix with the backend origin (removing /api from BASE_URL)
  const origin = BASE_URL.replace("/api", "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  
  return `${origin}${cleanPath}`;
};
