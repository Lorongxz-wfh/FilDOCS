import api from "./api";

export interface SystemHealthStatus {
  status: {
    database: boolean;
    database_info: {
      bytes: number;
      formatted: string;
      driver: string;
    };
    cache: {
      active: boolean;
      driver: string;
    };
    storage: {
      driver: string;
      connected: boolean;
      bucket: string | null;
      error?: string | null;
    };
    mail: boolean;
  };
  maintenance: {
    mode: MaintenanceMode;
    message: string | null;
    expires_at: string | null;
    starts_at: string | null;
    is_notified: boolean;
  };
  active_sessions: number;
  server_info: {
    php_version: string;
    laravel_version: string;
    server_time: string;
  };
}

export type MaintenanceMode = "off" | "soft" | "hard";

export interface UpdateMaintenanceRequest {
  mode: MaintenanceMode;
  message?: string | null;
  expires_at?: string | null;
}

export interface SystemDiagnostics {
  db_latency: number;
  cache_io: boolean;
  storage_io: boolean;
  pusher: boolean;
  broadcasting_driver: string;
  timestamp: string;
}

/**
 * Fetch maintenance status only. Safe for all authenticated users.
 */
export async function getMaintenanceStatus(): Promise<{ maintenance: SystemHealthStatus['maintenance'] }> {
  const { data } = await api.get("/system/maintenance");
  return data;
}

/**
 * Fetch system health metrics and current status.
 * REQUIRES ADMIN ROLE.
 */
export async function getSystemHealth(): Promise<SystemHealthStatus> {
  const { data } = await api.get("/admin/system/health");
  return data;
}

/**
 * Update system maintenance mode settings.
 */
export async function updateMaintenanceMode(req: UpdateMaintenanceRequest): Promise<any> {
  const { data } = await api.patch("/admin/system/maintenance", req);
  return data;
}

/**
 * Fetch recent system logs (tail).
 */
export async function getSystemLogs(): Promise<{ logs: string }> {
  const { data } = await api.get("/admin/system/logs");
  return data;
}

/**
 * Run deep infrastructure diagnostics.
 */
export async function runSystemDiagnostics(): Promise<SystemDiagnostics> {
  const { data } = await api.post("/admin/system/diagnostics");
  return data;
}

/**
 * Send a manual test email to the current user.
 */
export async function sendSystemTestEmail(): Promise<{ message: string }> {
  const { data } = await api.post("/admin/system/test-email");
  return data;
}

export async function scheduleMaintenance(params: { minutes: number; message?: string; mode: 'soft' | 'hard' }): Promise<{ message: string; starts_at: string }> {
  const { data } = await api.post("/admin/system/scheduler/schedule", params);
  return data;
}

export async function cancelMaintenance(): Promise<{ message: string }> {
  const { data } = await api.post("/admin/system/scheduler/cancel");
  return data;
}
