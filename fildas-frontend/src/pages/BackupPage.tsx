import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Skeleton from "../components/ui/loader/Skeleton";
import DateRangeInput from "../components/ui/DateRangeInput";
import {
  FileSpreadsheet,
  ScrollText,
  Download,
  Loader2,
  Calendar,
  Database,
  Trash2,
  HardDrive,
  CheckCircle2,
} from "lucide-react";
import { PageActions, RefreshAction } from "../components/ui/PageActions";
import {
  getBackupSummary,
  downloadBackup,
  getSystemBackups,
  createSystemSnapshot,
  deleteSystemBackup,
  downloadSystemSnapshot,
  type BackupPreset,
  type BackupSummary,
  type SystemBackupFile,
} from "../services/backupApi";

// ── Preset options ──────────────────────────────────────────────────────────
const PRESETS: { value: BackupPreset; label: string }[] = [
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
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

// ── Card component ──────────────────────────────────────────────────────────
type BackupCardProps = {
  title: string;
  description: string;
  icon: React.ReactNode;
  iconBg: string;
  count: number | null;
  countLabel: string;
  loading: boolean;
  downloading: boolean;
  onDownload: () => void;
};

function BackupCard({
  title,
  description,
  icon,
  iconBg,
  count,
  countLabel,
  loading,
  downloading,
  onDownload,
}: BackupCardProps) {
  return (
    <div className="rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
      <div className="flex items-start gap-4 px-5 py-4">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBg}`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-surface-400">
        {loading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
              {count?.toLocaleString() ?? 0}
            </span>{" "}
            {countLabel}
          </p>
        )}
        <button
          type="button"
          disabled={downloading || loading || (count ?? 0) === 0}
          onClick={onDownload}
          className="flex items-center gap-1.5 rounded-md bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed dark:hover:bg-brand-400"
        >
          {downloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="h-3.5 w-3.5" />
          )}
          {downloading ? "Preparing…" : "Download"}
        </button>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function BackupPage() {
  const navigate = useNavigate();

  const [preset, setPreset] = useState<BackupPreset>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [systemBackups, setSystemBackups] = useState<SystemBackupFile[]>([]);
  const [totalSize, setTotalSize] = useState(0);
  
  const [loading, setLoading] = useState(true);
  const [backupsLoading, setBackupsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  // ── Fetch summary when preset/dates change ──
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

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  useEffect(() => {
    fetchSystemBackups();
  }, [fetchSystemBackups]);

  // ── Download handler ──
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
    // Reset after a delay (streaming download starts immediately)
    setTimeout(() => {
      setDownloading((prev) => ({ ...prev, [endpoint]: false }));
    }, 3000);
  };

  const handleCreateSnapshot = async () => {
    setCreating(true);
    try {
      await createSystemSnapshot();
      fetchSystemBackups();
    } catch (e) {
      alert("Failed to create snapshot.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}? This action cannot be undone.`)) return;
    try {
      await deleteSystemBackup(filename);
      fetchSystemBackups();
    } catch (e) {
      alert("Failed to delete backup.");
    }
  };

  return (
    <PageFrame
      title="Backup & Recovery"
      onBack={() => navigate(-1)}
      contentClassName="flex flex-col overflow-hidden"
      right={
        <PageActions>
          <RefreshAction
            onRefresh={async () => {
              fetchSummary();
              fetchSystemBackups();
            }}
            loading={loading || backupsLoading}
          />
        </PageActions>
      }
    >
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-surface-400 dark:bg-surface-600 px-5 py-3.5">
        <div className="mt-0 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-slate-400 sm:shrink-0">
            <Calendar className="h-3.5 w-3.5" />
          </div>
          
          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 dark:border-white/5 bg-slate-100/50 dark:bg-black/20 p-1 flex items-center">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                className={`flex-1 py-1.5 px-0.5 text-[10px] sm:text-xs font-bold transition-all rounded-lg ${
                  preset === p.value
                    ? "bg-brand-500 text-white shadow-sm active:scale-95"
                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white/50 dark:hover:bg-white/5"
                }`}
              >
                {p.value === "custom" ? "Custom" : p.label}
              </button>
            ))}
          </div>

          {preset === "custom" && (
            <DateRangeInput
              from={dateFrom}
              to={dateTo}
              onFromChange={setDateFrom}
              onToChange={setDateTo}
            />
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-5">
        {error && (
          <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600 dark:bg-rose-950/20 dark:border-rose-800 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* ── Data Exports ── */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Data Exports</h2>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <BackupCard
              title="Document Metadata"
              description="Export records as CSV — titles, codes, offices, statuses, and dates."
              icon={<FileSpreadsheet className="h-5 w-5 text-emerald-500" />}
              iconBg="bg-emerald-50 dark:bg-emerald-950/30"
              count={summary?.documents ?? null}
              countLabel="documents"
              loading={loading}
              downloading={!!downloading["documents-csv"]}
              onDownload={() => handleDownload("documents-csv")}
            />

            <BackupCard
              title="Activity Logs"
              description="Export the full activity trail — every action, actor, and timestamp."
              icon={<ScrollText className="h-5 w-5 text-amber-500" />}
              iconBg="bg-amber-50 dark:bg-amber-950/30"
              count={summary?.activities ?? null}
              countLabel="log entries"
              loading={loading}
              downloading={!!downloading["activity-csv"]}
              onDownload={() => handleDownload("activity-csv")}
            />
          </div>
        </div>

        {/* ── System Recovery ── */}
        <div className="mb-6">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
             <div>
               <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">System Snapshots</h2>
               <p className="mt-1 text-[10px] text-slate-500 italic">Complete database state archives for disaster recovery.</p>
             </div>
             
             <div className="flex items-center gap-4">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Total Usage</span>
                  <div className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-200">
                    <HardDrive className="h-3 w-3 text-brand-500" />
                    {formatSize(totalSize)}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={creating}
                  onClick={handleCreateSnapshot}
                  className="flex items-center gap-2 rounded-md bg-brand-500 px-4 py-2 text-xs font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Database className="h-3.5 w-3.5" />
                  )}
                  {creating ? "Snapshooting..." : "Trigger System Snapshot"}
                </button>
             </div>
          </div>

          <div className="overflow-hidden rounded-md border border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500">
            <table className="w-full text-left text-xs">
               <thead>
                 <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:border-surface-400 dark:bg-white/5">
                   <th className="px-5 py-3">Snapshot Name</th>
                   <th className="px-5 py-3">Size</th>
                   <th className="px-5 py-3">Status</th>
                   <th className="px-5 py-3">Created At</th>
                   <th className="px-5 py-3 text-right">Actions</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-surface-400">
                 {backupsLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={5} className="px-5 py-4"><Skeleton className="h-4 w-full" /></td>
                      </tr>
                    ))
                 ) : systemBackups.length === 0 ? (
                   <tr>
                     <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                        <Database className="mx-auto mb-3 h-8 w-8 opacity-20" />
                        <p className="font-semibold">No snapshots found.</p>
                        <p className="text-[10px]">Manual triggers will appear here.</p>
                     </td>
                   </tr>
                 ) : (
                   systemBackups.map((b) => (
                     <tr key={b.filename} className="group hover:bg-slate-50/80 dark:hover:bg-white/5 transition-colors">
                       <td className="px-5 py-4 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                         <div className="h-7 w-7 flex items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-950/30">
                           <Database className="h-4 w-4" />
                         </div>
                         {b.filename}
                       </td>
                       <td className="px-5 py-4 text-slate-500 dark:text-slate-400 font-medium">{formatSize(b.size)}</td>
                       <td className="px-5 py-4">
                         <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold tracking-tight">
                           <CheckCircle2 className="h-3.5 w-3.5" />
                           READY
                         </div>
                       </td>
                       <td className="px-5 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                         {new Date(b.created_at).toLocaleString('en-US', { 
                            month: 'short', day: 'numeric', year: 'numeric',
                            hour: 'numeric', minute: '2-digit', hour12: true 
                         })}
                       </td>
                       <td className="px-5 py-4 text-right">
                         <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => downloadSystemSnapshot(b.filename)}
                              className="p-1 text-slate-400 hover:text-brand-500 transition-colors"
                              title="Download Snapshot"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(b.filename)}
                              className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                              title="Delete Snapshot"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                         </div>
                       </td>
                     </tr>
                   ))
                 )}
               </tbody>
            </table>
          </div>
        </div>

        {/* Info note */}
        <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-surface-400 dark:bg-surface-600">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
            <span className="font-bold text-slate-700 dark:text-slate-200 mr-1 uppercase tracking-tighter">Institutional Policy:</span>
            System Snapshots are full database state archives. It is recommended to perform a snapshot before any major metadata migration or bulk user management operation. 
            All exports use UTF-8 encoding. CSV files are optimized for Excel; ZIP archives maintain institutional office hierarchy.
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
