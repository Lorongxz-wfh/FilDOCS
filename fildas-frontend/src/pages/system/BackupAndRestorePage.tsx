import React, { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import PageFrame from "../../components/layout/PageFrame";
import Skeleton from "../../components/ui/loader/Skeleton";
import { DateRangePicker } from "../../components/ui/DateRangePicker";
import {
  FileSpreadsheet,
  ScrollText,
  Download,
  Loader2,
  Database,
  Trash2,
  HardDrive,
  CheckCircle2,
  FolderArchive,
  Users,
  RotateCcw,
  AlertTriangle,
  Upload,
  Clock,
  ChevronDown,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { PageActions } from "../../components/ui/PageActions";
import { getUserRole } from "../../lib/roleFilters";
import { useSmartRefresh } from "../../hooks/useSmartRefresh";
import DatePresetSwitcher, { type PresetOption } from "../../components/ui/DatePresetSwitcher";
import {
  getBackupSummary,
  downloadBackup,
  getSystemBackups,
  createSystemSnapshot,
  deleteSystemBackup,
  downloadSystemSnapshot,
  restoreSystemSnapshot,
  restoreDocumentBackup,
  saveToSystemBackup,
  uploadSystemSnapshot,
  getRestoreStatus,
  type BackupPreset,
  type BackupSummary,
  type SystemBackupFile,
} from "../../services/backupApi";

// ── Preset options ──────────────────────────────────────────────────────────
const PRESETS: PresetOption[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
  { value: "all", label: "All Time" },
];

// ── Formatter ──────────────────────────────────────────────────────────────
const formatSize = (bytes: number) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// ── Card component ──────────────────────────────────────────────────────────
type ExportCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconColor: string;
  bgColor: string;
  count: number | null;
  countLabel: string;
  loading: boolean;
  downloading: boolean;
  onDownload: () => void;
  onSaveToSystem?: () => void;
  saveLoading?: boolean;
};

function ExportCard({
  title,
  description,
  icon,
  iconColor,
  bgColor,
  count,
  countLabel,
  loading,
  downloading,
  onDownload,
  onSaveToSystem,
  saveLoading,
}: ExportCardProps) {
  return (
    <div className="flex flex-col rounded-md border border-slate-200 bg-white transition-all dark:border-surface-400 dark:bg-surface-500 overflow-hidden">
      <div className="flex flex-1 items-start gap-4 p-5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${bgColor} ${iconColor} border border-black/5 dark:border-white/5`}>
          {React.cloneElement(icon as React.ReactElement<any>, { className: "h-6 w-6" })}
        </div>
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between mb-0.5">
             <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
               {title}
             </h3>
             {loading ? <Skeleton className="h-4 w-12" /> : (
               <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-black/20 px-1.5 py-0.5 rounded border border-slate-100 dark:border-white/5">
                 {countLabel}
               </div>
             )}
          </div>
          
          <div className="h-8 flex items-end mb-2">
            {loading ? (
              <Skeleton className="h-7 w-16" />
            ) : (
              <p className="text-2xl font-semibold tabular-nums text-slate-800 dark:text-white leading-none">
                {count?.toLocaleString() ?? 0}
              </p>
            )}
          </div>
          
          <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 italic">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 p-2.5 dark:border-surface-400 dark:bg-white/5">
        {onSaveToSystem ? (
          <button
            type="button"
            disabled={loading || saveLoading || (count ?? 0) === 0}
            onClick={onSaveToSystem}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 hover:bg-white hover:text-brand-500 hover: transition-all disabled:opacity-30 dark:text-slate-400 dark:hover:bg-surface-400"
          >
            {saveLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <HardDrive className="h-3 w-3" />}
            {saveLoading ? "Saving..." : "Save to History"}
          </button>
        ) : <div />}

        <button
          type="button"
          disabled={downloading || loading || (count ?? 0) === 0}
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-white  transition-all hover:bg-brand-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? "Preparing..." : "Download CSV"}
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BackupAndRestorePage() {
  const role = getUserRole();
  const canRestore = role === "ADMIN" || role === "SYSADMIN";
  const [preset, setPreset] = useState<BackupPreset>("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [systemBackups, setSystemBackups] = useState<SystemBackupFile[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<{ status: string; message: string; progress: number } | null>(null);
  const [confirmingRestore, setConfirmingRestore] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Browser Persistence (Resistant to refreshes/crashes) ────────────────────
  useEffect(() => {
    const detectRestoration = async () => {
      const persistedNode = localStorage.getItem('fildocs_restoring_node');

      try {
        const data = await getRestoreStatus();
        
        if (data.status === 'running') {
            setRestoring(persistedNode);
            setRestoreStatus(data);
        } else if (data.status === 'completed' || data.status === 'failed') {
            // Let the interval or the user handle the final state
        } else {
            // Only clear if we don't think we're restoring
            if (!persistedNode) {
              setRestoring(null);
              setRestoreStatus(null);
            }
        }
      } catch (e) {
        if (!persistedNode) setRestoring(null);
      }
    };
    detectRestoration();
  }, []);

  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [isBackupMenuOpen, setIsBackupMenuOpen] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getBackupSummary(
        preset,
        preset === "custom" ? dateFrom : undefined,
        preset === "custom" ? dateTo : undefined,
      );
      setSummary(s);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load summary.");
    } finally {
      setLoading(false);
    }
  }, [preset, dateFrom, dateTo]);

  const fetchSystemBackups = useCallback(async () => {
    setBackupsLoading(true);
    try {
      const res = await getSystemBackups();
      setSystemBackups(res.backups);
      setTotalSize(res.total_size);
    } catch (e) {} finally {
      setBackupsLoading(false);
    }
  }, []);

  const { refresh } = useSmartRefresh(async () => {
    try {
      await Promise.all([fetchSummary(), fetchSystemBackups()]);
      return { changed: true, message: "Backup registry synchronized." };
    } catch (e: any) {
      throw e;
    }
  });

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDownload = (
    endpoint: "documents-csv" | "documents-zip" | "activity-csv" | "users-csv",
  ) => {
    setDownloading((prev) => ({ ...prev, [endpoint]: true }));
    downloadBackup(
      endpoint,
      preset,
      preset === "custom" ? dateFrom : undefined,
      preset === "custom" ? dateTo : undefined,
    );
    setTimeout(() => {
      setDownloading((prev) => ({ ...prev, [endpoint]: false }));
    }, 3000);
  };

  const handleSaveToSystem = async (endpoint: "documents-zip") => {
    setDownloading((prev) => ({ ...prev, [endpoint]: true }));
    setError(null);
    try {
      await saveToSystemBackup(
        preset,
        preset === "custom" ? dateFrom : undefined,
        preset === "custom" ? dateTo : undefined,
      );
      fetchSystemBackups();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? "Failed to save backup to system.");
    } finally {
      setDownloading((prev) => ({ ...prev, [endpoint]: false }));
    }
  };

  const handleCreateSnapshot = async (type: "db" | "doc" | "full" = "db") => {
    setCreating(true);
    setIsBackupMenuOpen(false);
    try {
      await createSystemSnapshot(type);
      fetchSystemBackups();
    } catch (e: any) {
      let msg = e?.response?.data?.message ?? e?.message ?? "Failed to create snapshot.";
      
      if (e?.code === 'ECONNABORTED' || e?.message?.includes('timeout') || (!e.response && e.message === 'Network Error')) {
        msg = "The request timed out or was interrupted. The server may still be processing the snapshot in the background. Please wait a few minutes and refresh.";
      }
      
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!canRestore) return;
    if (!confirm(`Delete "${filename}"? This cannot be undone.`)) return;
    try {
      await deleteSystemBackup(filename);
      fetchSystemBackups();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? "Failed to delete backup.";
      setError(msg);
    }
  };

  const handleRestoreSnapshot = async (backup: SystemBackupFile) => {
    if (!canRestore) return;
    setRestoring(backup.filename);
    localStorage.setItem('fildocs_restoring_node', backup.filename);
    setConfirmingRestore(null);
    setError(null);
    setRestoreStatus({ status: 'running', message: 'Connecting to server...', progress: 5 });
    
    try {
      if (backup.type === 'doc') {
        await restoreDocumentBackup(backup.filename);
      } else {
        await restoreSystemSnapshot(backup.filename);
      }
    } catch (e: any) {
      // RENDER/PRODUCTION RESILIENCE: 
      // Initial trigger often 504s because DB is busy wiping, but the job IS DISPATCHED.
      const isTimeout = e?.code === 'ECONNABORTED' || e?.response?.status === 504 || e?.message?.includes('timeout');
      
      if (isTimeout) {
        console.warn("Trigger timed out on production, but polling remains active.");
        return; // Stay in 'restoring' state to let polling track the worker
      }

      localStorage.removeItem('fildocs_restoring_node');
      const msg = e?.response?.data?.message ?? e?.message ?? "Restore failed.";
      setError(msg);
      setRestoring(null);
      setRestoreStatus(null);
    }
  };

  useEffect(() => {
    let interval: any;
    if (restoring) {
      interval = setInterval(async () => {
        try {
          const status = await getRestoreStatus();
          setRestoreStatus(status);
          
          if (status.status === 'completed') {
            localStorage.removeItem('fildocs_restoring_node');
            clearInterval(interval);
            setRestoring(null);
            setTimeout(() => {
                setShowSuccessModal(true);
            }, 500);
          } else if (status.status === 'failed') {
            localStorage.removeItem('fildocs_restoring_node');
            clearInterval(interval);
            setError("Restoration process failed: " + status.message);
          } else if (status.status === 'idle' && restoreStatus && restoreStatus.progress > 0) {
            console.warn("Restoration poll returned idle while previously active. Holding state...");
          } else if (status.status === 'running') {
            setRestoreStatus(status);
          }
        } catch (e) {
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [restoring]);

  const [uploadProgress, setUploadProgress] = useState(0);
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 1000 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setError(`File is too large (${formatSize(file.size)}). Maximum upload size is 1GB.`);
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);
    try {
      await uploadSystemSnapshot(file, (p) => setUploadProgress(p));
      fetchSystemBackups();
      if (e.target) e.target.value = '';
    } catch (e: any) {
      setUploadProgress(0);
      let msg = e?.response?.data?.message ?? e?.message ?? "Upload failed.";
      
      if (e?.response?.status === 413) {
        msg = "The file is too large for your server's configuration (HTTP 413). Please increase 'upload_max_filesize' and 'post_max_size' in your php.ini.";
      } else if (e?.message?.includes('timeout') || e?.code === 'ECONNABORTED') {
        msg = "The upload timed out. This usually happens on slow local servers with large files.";
      }

      setError(msg);
    } finally {
      setUploading(false);
    }
  };

  return (
    <PageFrame
      title="Backup & Recovery"
      right={
        <PageActions>
          <div className="flex items-center gap-2">
            <input
              type="file"
              id="snapshot-upload"
              className="hidden"
              accept=".zip,.sql,.sqlite"
              onChange={handleFileUpload}
            />
            <button
              type="button"
              className="h-8 px-3 flex items-center gap-1.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-50 transition-all dark:bg-surface-500 dark:border-surface-400 dark:text-slate-300"
              onClick={() => document.getElementById('snapshot-upload')?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
              {uploading ? `Uploading ${uploadProgress}%` : "Upload"}
            </button>
            
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsBackupMenuOpen(!isBackupMenuOpen)}
                disabled={creating}
                className="h-8 pl-3 pr-2 flex items-center gap-1.5 rounded-md bg-brand-500 text-[10px] font-semibold uppercase tracking-wider text-white  hover:bg-brand-600 active:scale-95 transition-all"
              >
                {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                Generate Snapshot
                <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isBackupMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {isBackupMenuOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsBackupMenuOpen(false)} 
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-72 z-50 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-surface-400 dark:bg-surface-500"
                    >
                      <div className="p-2 space-y-1">
                        <button
                          disabled={creating}
                          onClick={() => handleCreateSnapshot("db")}
                          className="w-full flex items-start gap-3 p-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                        >
                          <div className="mt-0.5 p-1.5 bg-brand-50 text-brand-600 rounded-md dark:bg-brand-950/30">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight">Database Snapshot</p>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">Primary system data and document metadata.</p>
                          </div>
                        </button>

                        <button
                          disabled={creating}
                          onClick={() => handleCreateSnapshot("doc")}
                          className="w-full flex items-start gap-3 p-2.5 rounded-md hover:bg-slate-50 dark:hover:bg-white/5 transition-colors text-left disabled:opacity-50"
                        >
                          <div className="mt-0.5 p-1.5 bg-sky-50 text-sky-600 rounded-md dark:bg-sky-950/30">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderArchive className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight">Documents Archive</p>
                            <p className="text-[10px] text-slate-500 leading-tight mt-0.5">All physical files, templates, and user signatures.</p>
                          </div>
                        </button>

                        <div className="h-px bg-slate-100 dark:bg-surface-400 my-1 mx-2" />

                        <button
                          disabled={creating}
                          onClick={() => handleCreateSnapshot("full")}
                          className="w-full flex items-start gap-3 p-2.5 rounded-md hover:bg-brand-500 group transition-colors text-left disabled:opacity-50"
                        >
                          <div className="mt-0.5 p-1.5 bg-brand-500 text-white rounded-md group-hover:bg-white group-hover:text-brand-600 transition-colors ">
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-[11px] font-semibold text-slate-900 dark:text-slate-100 group-hover:text-white uppercase tracking-tight">Complete System Backup</p>
                            <p className="text-[10px] text-slate-500 group-hover:text-white/80 leading-tight mt-0.5">Everything: Database and all physical files.</p>
                          </div>
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

        </PageActions>
      }
      contentClassName="flex flex-col bg-slate-50/50 dark:bg-surface-600"
      fullHeight
    >
      <div className="flex-1 overflow-y-auto p-6 scroll-bar">
        <AnimatePresence mode="wait">
          {error && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="rounded-md border border-rose-200 bg-rose-50/50 p-3.5 flex items-start gap-3 dark:border-rose-900/50 dark:bg-rose-950/20">
                <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                <div className="text-xs font-medium text-rose-600 dark:text-rose-400">
                   {error}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Resource Collections ── */}
        <div className="mb-10 text-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between mb-4 border-l-2 border-brand-500 pl-3">
             <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Resource Collections</h2>
             
             <div className="flex items-center gap-4">
                <DatePresetSwitcher
                  options={PRESETS}
                  value={preset}
                  onChange={(val) => setPreset(val)}
                  layoutId="backup-presets"
                />

                {preset === "custom" && (
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }} 
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2"
                  >
                    <DateRangePicker
                      from={dateFrom}
                      to={dateTo}
                      onSelect={(r: any) => {
                        setDateFrom(r.from);
                        setDateTo(r.to);
                      }}
                    />
                  </motion.div>
                )}
             </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <ExportCard
              title="Document Data"
              description="Full record export of titles, codes, and document status details."
              icon={<FileSpreadsheet />}
              iconColor="text-emerald-500"
              bgColor="bg-emerald-50/50 dark:bg-emerald-950/30"
              count={summary?.documents ?? null}
              countLabel="records"
              loading={loading}
              downloading={!!downloading["documents-csv"]}
              onDownload={() => handleDownload("documents-csv")}
            />

            <ExportCard
              title="Activity Logs"
              description="The complete institutional trail. Record of every system action."
              icon={<ScrollText />}
              iconColor="text-amber-500"
              bgColor="bg-amber-50/50 dark:bg-amber-950/30"
              count={summary?.activities ?? null}
              countLabel="events"
              loading={loading}
              downloading={!!downloading["activity-csv"]}
              onDownload={() => handleDownload("activity-csv")}
            />

            <ExportCard
              title="Documents & Files"
              description="All uploaded document versions, templates, and user attachments."
              icon={<FolderArchive />}
              iconColor="text-sky-500"
              bgColor="bg-sky-50/50 dark:bg-sky-950/30"
              count={summary?.files ?? null}
              countLabel="assets"
              loading={loading}
              downloading={!!downloading["documents-zip"]}
              onDownload={() => handleDownload("documents-zip")}
              onSaveToSystem={() => handleSaveToSystem("documents-zip")}
              saveLoading={!!downloading["documents-zip"]} 
            />

            <ExportCard
              title="User Directory"
              description="Export current human roster, roles, and administrative classifications."
              icon={<Users />}
              iconColor="text-indigo-500"
              bgColor="bg-indigo-50/50 dark:bg-indigo-950/30"
              count={summary?.users ?? null}
              countLabel="profiles"
              loading={loading}
              downloading={!!downloading["users-csv"]}
              onDownload={() => handleDownload("users-csv")}
            />
          </div>
        </div>

        {/* ── System Snapshots registry ── */}
        <div className="mb-8 flex flex-col">
          <div className="flex items-center justify-between mb-4 border-l-2 border-brand-500 pl-3 shrink-0">
             <div className="flex items-center gap-4">
                <h2 className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">System Snapshots</h2>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-100 dark:bg-surface-400 rounded-full border border-slate-200 dark:border-surface-300">
                   <HardDrive className="h-3 w-3 text-brand-500" />
                   <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-200 tabular-nums uppercase">{formatSize(totalSize)} USED</span>
                </div>
             </div>
             <div className="text-[10px] text-slate-400 font-semibold tracking-tighter cursor-default flex items-center gap-1.5">
               <ShieldCheck className="h-3 w-3" />
               ENCRYPTED PERSISTENT ARCHIVE
             </div>
          </div>

          <div className="max-h-[500px] flex flex-col overflow-hidden rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 ">
            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20">
                  <tr className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-surface-400 dark:bg-surface-600">
                    <th className="px-5 py-3 text-slate-900 dark:text-slate-100">Snapshot Name</th>
                    <th className="px-5 py-3 text-slate-900 dark:text-slate-100">Capacity</th>
                    <th className="px-5 py-3 text-slate-900 dark:text-slate-100">State</th>
                    <th className="px-5 py-3 text-slate-900 dark:text-slate-100">Archived At</th>
                    <th className="px-5 py-3 text-right text-slate-900 dark:text-slate-100">Control</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-surface-400">
                {backupsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={5} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                    </tr>
                  ))
                ) : systemBackups.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                      <Database className="mx-auto mb-3 h-8 w-8 opacity-20" />
                      <p className="font-semibold italic">No manual snapshots detected.</p>
                    </td>
                  </tr>
                ) : (
                  systemBackups.map((b) => {
                    const isDoc = b.type === 'doc';
                    return (
                      <tr 
                        key={b.filename} 
                        className="group hover:bg-slate-50/80 dark:hover:bg-white/5 transition-all text-nowrap"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={`h-8 w-8 flex items-center justify-center rounded border ${b.type === 'full' ? 'bg-brand-500 text-white border-brand-600' : isDoc ? 'bg-sky-50 text-sky-600 border-sky-100 dark:bg-sky-900/30 dark:border-sky-800' : 'bg-brand-50 text-brand-600 border-brand-100 dark:bg-brand-900/30 dark:border-brand-800'}`}>
                              {b.type === 'full' ? <Zap className="h-4 w-4" /> : isDoc ? <FolderArchive className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-extrabold text-slate-800 dark:text-slate-200 leading-tight truncate">
                                {b.filename.replace(/\.[^/.]+$/, "")}
                              </div>
                              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-tighter mt-0.5">
                                {b.type === 'full' ? 'Complete System' : isDoc ? 'Documents Archive' : 'Database Snapshot'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-semibold tabular-nums text-slate-600 dark:text-slate-400">
                          {formatSize(b.size)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1.5 text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/30 rounded border border-emerald-100 dark:border-emerald-900/50 w-fit">
                            <CheckCircle2 className="h-3 w-3" />
                            VALIDATED
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-semibold tabular-nums text-slate-500 dark:text-slate-400">
                           {new Date(b.created_at).toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', year: 'numeric' 
                          })}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0">
                            <button
                              onClick={() => downloadSystemSnapshot(b.filename)}
                              className="p-1.5 text-slate-400 hover:bg-white hover:text-brand-500 hover: rounded-md transition-all dark:hover:bg-surface-400"
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            {canRestore && (
                              <button
                                onClick={() => setConfirmingRestore(b.filename)}
                                className="p-1.5 text-slate-400 hover:bg-white hover:text-amber-500 hover: rounded-md transition-all dark:hover:bg-surface-400"
                                title="Restore"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            )}
                            {canRestore && (
                              <button
                                onClick={() => handleDeleteBackup(b.filename)}
                                className="p-1.5 text-slate-400 hover:bg-white hover:text-rose-500 hover: rounded-md transition-all dark:hover:bg-surface-400"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="rounded-md border border-slate-200 bg-white p-4 dark:border-surface-400 dark:bg-surface-500 ">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-brand-500 shrink-0 mt-0.5" />
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed uppercase tracking-tight">
               <span className="font-extrabold text-slate-900 dark:text-white mr-1">Institutional Data Policy:</span>
               All snapshots are hosted on high-availability persistent storage. For disaster recovery, ensure both 
               <span className="mx-1 text-brand-600 font-semibold dark:text-brand-400 italic">Database Image</span> and 
               <span className="mx-1 text-sky-600 font-semibold dark:text-sky-400 italic">Object Volume</span> are restored in sequence. 
               CSV exports omit sensitive checksums and binary blobs.
            </div>
          </div>
        </div>
      </div>

      {confirmingRestore && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl dark:border-surface-400 dark:bg-surface-500"
          >
            {(() => {
              const backup = systemBackups.find(b => b.filename === confirmingRestore);
              const isDoc = backup?.type === 'doc';
              
              return (
                <>
                  <div className={`flex items-center gap-4 ${isDoc ? 'text-sky-600 dark:text-sky-400' : 'text-rose-600 dark:text-rose-400'} mb-6`}>
                    <div className={`flex h-14 w-14 items-center justify-center rounded-xl ${isDoc ? 'bg-sky-50 dark:bg-sky-900/30' : 'bg-rose-50 dark:bg-rose-900/30'} border border-current/10`}>
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{isDoc ? 'Volume Restoration' : 'Kernel Level Reset'}</h3>
                      <p className="text-xs opacity-75 font-semibold uppercase tracking-widest">{isDoc ? 'Safe Operation' : 'Critical Failure Risk'}</p>
                    </div>
                  </div>

                  <div className="mb-6 space-y-3">
                    <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                      {isDoc ? (
                        <>You are re-populating the cloud object volume from: <span className="font-mono font-black text-slate-900 dark:text-white underline decoration-sky-500/30">{confirmingRestore}</span>.</>
                      ) : (
                        <>You are reverting the entire system database to state: <span className="font-mono font-black text-slate-900 dark:text-white underline decoration-rose-500/30">{confirmingRestore}</span>.</>
                      )}
                    </p>
                    <div className="p-3 bg-slate-50 dark:bg-black/20 rounded border border-slate-100 dark:border-white/5 text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-2">
                       <Clock className="h-3 w-3" />
                       Action will synchronize across all offices
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setConfirmingRestore(null)}
                      className="flex-1 rounded-md border border-slate-200 py-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-surface-400 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      ABORT
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(backup!)}
                      className={`flex-1 rounded-md ${isDoc ? 'bg-sky-600 hover:bg-sky-700' : 'bg-rose-600 hover:bg-rose-700'} py-3 text-xs font-semibold text-white transition shadow-lg shadow-current/10`}
                    >
                      {isDoc ? 'RESTORE VOLUME' : 'INITIATE RESET'}
                    </button>
                  </div>
                </>
              );
            })()}
          </motion.div>
        </div>
      )}

      {restoring && (
        <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-xl text-white p-6">
           {(!(restoreStatus && restoreStatus.status === 'failed')) && (
             <div className="relative mb-10">
                <div className="absolute inset-0 rounded-full bg-brand-500 blur-2xl opacity-20 animate-pulse" />
                <Loader2 className="h-16 w-16 animate-spin text-brand-500 relative" />
             </div>
           )}
           
           <div className="w-full max-w-sm">
             <h2 className="text-2xl font-black tracking-tighter uppercase italic text-center mb-6">
               {restoreStatus && restoreStatus.status === 'failed' 
                 ? 'Restoration Inhibited' 
                 : (systemBackups.find(b => b.filename === restoring)?.type === 'doc' 
                   ? 'Populating Volumetric Storage...' 
                   : 'Resurrecting System Core...')}
             </h2>

             {restoreStatus && (
               <div className="space-y-4">
                  {restoreStatus.status !== 'failed' && (
                    <>
                      <div className="flex items-center justify-between text-[10px] uppercase font-semibold tracking-widest text-slate-400">
                         <span>{restoreStatus.message}</span>
                         <span className="tabular-nums text-brand-500">
                           {restoreStatus.progress}%
                         </span>
                      </div>
                      
                      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5">
                         <motion.div 
                           className="h-full bg-brand-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]"
                           initial={{ width: 0 }}
                           animate={{ width: `${restoreStatus.progress}%` }}
                           transition={{ duration: 0.5 }}
                         />
                      </div>
                    </>
                  )}

                  {restoreStatus.status === 'failed' && (
                     <div className="mt-4 space-y-4">
                        <div className="p-5 bg-red-500/5 border border-red-500/20 rounded shadow-2xl font-mono text-[11px] leading-relaxed text-red-400 max-h-[400px] overflow-y-auto scroll-bar">
                           <div className="flex items-center gap-2 mb-4 pb-3 border-b border-red-500/10">
                              <span className="px-1.5 py-0.5 rounded bg-red-500 text-slate-900 font-black text-[9px] uppercase tracking-tighter">Failure Node</span>
                              <span className="text-red-500/60 tabular-nums uppercase text-[10px] tracking-widest">{new Date().toLocaleTimeString()}</span>
                           </div>
                           <div className="whitespace-pre-wrap break-words italic px-2 py-2 bg-red-950/20 rounded border border-red-500/10">
                              {restoreStatus.message}
                           </div>
                        </div>
                        <button
                          onClick={() => {
                            setRestoring(null);
                            setRestoreStatus(null);
                          }}
                          className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-[11px] font-semibold uppercase tracking-[0.3em] rounded transition-all border border-white/5 hover:border-white/20"
                        >
                          DISMISS AND DIAGNOSE
                        </button>
                     </div>
                  )}
               </div>
             )}
             
             <div className="mt-8 flex items-center justify-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 w-fit mx-auto">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest tabular-nums truncate max-w-[200px]">Node: {restoring}</span>
             </div>
           </div>
        </div>
      )}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-7 shadow-2xl dark:border-surface-400 dark:bg-surface-500 text-center"
          >
            <div className="flex flex-col items-center">
              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800 shadow-inner">
                <CheckCircle2 className="h-10 w-10" />
              </div>
              
              <h3 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white mb-2">Restoration Success</h3>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400 mb-6">Database Synchronized</p>
              
              <div className="mb-8 p-4 bg-slate-50 dark:bg-black/20 rounded-md border border-slate-100 dark:border-white/5">
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                  Institutional data recovery is complete. The application must now reload to finalize the synchronization.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full rounded-md bg-brand-500 py-4 text-xs font-semibold text-white shadow-lg shadow-brand-500/20 hover:bg-brand-600 transition-all active:scale-[0.98] uppercase tracking-widest"
              >
                Reload Application
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </PageFrame>
  );
}
