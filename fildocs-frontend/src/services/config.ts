/**
 * Centralized API configuration for FilDOCS.
 * 
 * Ensures the API URL always includes the necessary /api prefix and 
 * provides reliable environment detection.
 */
export const getBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  
  if (envUrl) {
    // Ensure it always ends with /api
    return envUrl.endsWith("/api") ? envUrl : `${envUrl}/api`;
  }
  
  // Fallback for local vs production
  const isLocal = 
    window.location.hostname === "localhost" || 
    window.location.hostname === "127.0.0.1";
    
  return isLocal 
    ? "http://localhost:8001/api" 
    : "https://fildas-v2.onrender.com/api";
};

export const API_BASE = getBaseUrl();
