import { getApi, API_BASE, dedupeFetch } from "./_base";

export type BackupPreset = "today" | "this_week" | "this_month" | "custom" | "all";

export type BackupSummary = {
  documents: number;
  files: number;
  activities: number;
  users: number;
};

function buildParams(preset: BackupPreset, dateFrom?: string, dateTo?: string) {
  const p: Record<string, string> = { preset };
  if (preset === "custom") {
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
  }
  return p;
}

export async function getBackupSummary(
  preset: BackupPreset,
  dateFrom?: string,
  dateTo?: string,
): Promise<BackupSummary> {
  return dedupeFetch(`backup-summary-${preset}-${dateFrom}-${dateTo}`, async () => {
    const api = await getApi();
    const res = await api.get("/backup/summary", {
      params: buildParams(preset, dateFrom, dateTo),
    });
    return res.data as BackupSummary;
  });
}

/**
 * Trigger a file download for a backup endpoint.
 * Uses a hidden link + auth token in the URL since we need streaming downloads.
 */
export function downloadBackup(
  endpoint: "documents-csv" | "documents-zip" | "activity-csv" | "users-csv",
  preset: BackupPreset,
  dateFrom?: string,
  dateTo?: string,
): void {
  const params = new URLSearchParams(buildParams(preset, dateFrom, dateTo));
  const token = localStorage.getItem("auth_token") ?? "";

  // We can't use axios for file downloads easily, so we use a hidden iframe/link approach
  // But since the API requires Bearer auth, we'll use fetch + blob
  const url = `${API_BASE}/backup/${endpoint}?${params.toString()}`;

  fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "*/*" },
  })
    .then((res) => {
      if (!res.ok) throw new Error(`Download failed (${res.status})`);

      // Extract filename from Content-Disposition header
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename[^;=\n]*=['"]*([^'";\n]*)/);
      const filename = match?.[1] ?? `fildas-backup-${endpoint}.${endpoint.includes("zip") ? "zip" : "csv"}`;

      return res.blob().then((blob) => ({ blob, filename }));
    })
    .then(({ blob, filename }) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    })
    .catch((err) => {
      console.error("Backup download failed:", err);
      alert("Download failed. Please try again.");
    });
}

// ── System Snapshots (Backups) ──────────────────────────────────────────────
export type SystemBackupFile = {
  filename: string;
  type: "db" | "doc" | "full";
  size: number;
  created_at: string;
};

export type SystemBackupResponse = {
  backups: SystemBackupFile[];
  total_size: number;
};

export async function getSystemBackups(): Promise<SystemBackupResponse> {
  return dedupeFetch("system-backups", async () => {
    const api = await getApi();
    const res = await api.get("/admin/system/backups");
    return res.data as SystemBackupResponse;
  });
}

export async function createSystemSnapshot(type: "db" | "doc" | "full" = "db"): Promise<SystemBackupFile> {
  const api = await getApi();
  const res = await api.post("/admin/system/backups", { type }, {
    timeout: 600000 // 10 minutes for large instititutional snapshots
  });
  return res.data.backup as SystemBackupFile;
}

/**
 * Triggers a Document ZIP generation and tells the system to save it 
 * to the internal backup history instead of just downloading it.
 */
export async function saveToSystemBackup(
  preset: BackupPreset,
  dateFrom?: string,
  dateTo?: string,
): Promise<any> {
  const api = await getApi();
  const res = await api.get("/backup/documents-zip", {
    params: {
      ...buildParams(preset, dateFrom, dateTo),
      save_to_system: true
    }
  });
  return res.data;
}

export async function deleteSystemBackup(filename: string): Promise<void> {
  const api = await getApi();
  await api.delete(`/admin/system/backups/${filename}`);
}

export async function downloadSystemSnapshot(filename: string): Promise<void> {
  const token = localStorage.getItem("auth_token") ?? "";
  const url = `${API_BASE}/admin/system/backups/${filename}`;

  fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json, */*" },
  })
    .then(async (res) => {
      if (!res.ok) throw new Error("Download failed");
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.url) {
          // Offload to cloud storage directly
          window.location.href = data.url;
          return null;
        }
      }
      
      return res.blob();
    })
    .then((blob) => {
      if (!blob) return; // Handled via redirect
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    })
    .catch((err) => {
      console.error("System backup download failed:", err);
      alert("Download failed. For large snapshots, please wait a few minutes after generation before attempting to download.");
    });
}

export async function restoreSystemSnapshot(filename: string): Promise<void> {
  const api = await getApi();
  await api.post(`/admin/system/backups/${filename}/restore`);
}

/**
 * Restores object storage (Cloudflare R2) from a 'doc_snap' ZIP file.
 */
export async function restoreDocumentBackup(filename: string): Promise<void> {
  const api = await getApi();
  await api.post(`/admin/system/backups/${filename}/restore-documents`);
}

export async function uploadSystemSnapshot(file: File): Promise<void> {
  const api = await getApi();
  const formData = new FormData();
  formData.append("file", file);
  await api.post("/admin/system/backups/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}
