import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import Skeleton from "../components/ui/loader/Skeleton";
import DateRangeInput from "../components/ui/DateRangeInput";
import {
  // HardDrive,
  FileSpreadsheet,
  FileArchive,
  ScrollText,
  Users,
  Download,
  Loader2,
  Calendar,
} from "lucide-react";
import RefreshButton from "../components/ui/RefreshButton";
import {
  getBackupSummary,
  downloadBackup,
  type BackupPreset,
  type BackupSummary,
} from "../services/backupApi";

// ── Preset options ──────────────────────────────────────────────────────────
const PRESETS: { value: BackupPreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "custom", label: "Custom Range" },
  { value: "all", label: "All Time" },
];

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
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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

  return (
    <PageFrame
      title="Backup & Export"
      onBack={() => navigate(-1)}
      contentClassName="flex flex-col overflow-hidden"
      right={
        <RefreshButton
          onClick={() => fetchSummary()}
          loading={loading}
          title="Refresh summary"
        />
      }
    >
      {/* ── Header ── */}
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 dark:border-surface-400 dark:bg-surface-600 px-5 py-3.5">
        {/* ── Date preset selector ── */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <div className="flex rounded-md border border-slate-200 dark:border-surface-400 overflow-hidden">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => setPreset(p.value)}
                className={`px-3 py-1.5 text-xs font-medium transition ${
                  preset === p.value
                    ? "bg-brand-500 text-white"
                    : "bg-white text-slate-600 hover:bg-slate-50 dark:bg-surface-500 dark:text-slate-300 dark:hover:bg-surface-400"
                }`}
              >
                {p.label}
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BackupCard
            title="Document Metadata"
            description="Export all document records as CSV — titles, codes, offices, statuses, and dates."
            icon={<FileSpreadsheet className="h-5 w-5 text-emerald-500" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/30"
            count={summary?.documents ?? null}
            countLabel="documents"
            loading={loading}
            downloading={!!downloading["documents-csv"]}
            onDownload={() => handleDownload("documents-csv")}
          />

          <BackupCard
            title="Document Files"
            description="Download all document PDF files organized by office folders as a ZIP archive."
            icon={<FileArchive className="h-5 w-5 text-sky-500" />}
            iconBg="bg-sky-50 dark:bg-sky-950/30"
            count={summary?.files ?? null}
            countLabel="files"
            loading={loading}
            downloading={!!downloading["documents-zip"]}
            onDownload={() => handleDownload("documents-zip")}
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

          <BackupCard
            title="User Directory"
            description="Export all user accounts — names, roles, offices, and account status."
            icon={<Users className="h-5 w-5 text-violet-500" />}
            iconBg="bg-violet-50 dark:bg-violet-950/30"
            count={summary?.users ?? null}
            countLabel="users"
            loading={loading}
            downloading={!!downloading["users-csv"]}
            onDownload={() => handleDownload("users-csv")}
          />
        </div>

        {/* Info note */}
        <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-surface-400 dark:bg-surface-600">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Exported files use UTF-8 encoding. CSV files can be opened in Excel or Google Sheets.
            ZIP archives organize files by office code. Large exports may take a moment to prepare.
          </p>
        </div>
      </div>
    </PageFrame>
  );
}
