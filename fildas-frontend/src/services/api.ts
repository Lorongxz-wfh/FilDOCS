import axios from "axios";
import { clearAuthAndRedirect } from "../lib/auth";

// Automatically uses local URL in development, production URL when deployed
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.PROD
    ? `${window.location.origin}/api`
    : "http://127.0.0.1:8001/api");

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
    const status = error?.response?.status;

    if (status === 401 || status === 419) {
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
