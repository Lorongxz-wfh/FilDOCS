import axios from "axios";
import { clearAuthAndRedirect } from "../lib/auth";

// Automatically uses local URL in development, production URL when deployed
const BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) ||
  (import.meta.env.PROD
    ? "https://fildas-v2.onrender.com/api"
    : "http://127.0.0.1:8001/api");

const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("auth_token");

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
