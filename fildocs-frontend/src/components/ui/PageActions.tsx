import Button from "./Button";
import { Plus, Archive, FileDown, Upload, Trash2 } from "lucide-react";

/**
 * A flex container for page-level actions in the header.
 * Ensures consistent spacing and alignment.
 */
export function PageActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">{children}</div>;
}

/**
 * Standardizes the "Create" action across all pages.
 */
export function CreateAction({
  label = "Create",
  onClick,
  disabled,
  loading,
  className = "",
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}) {
  return (
    <Button
      variant="primary"
      size="sm"
      reveal
      onClick={onClick}
      disabled={disabled}
      loading={loading}
      className={className}
    >
      <Plus className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}


/**
 * Standardizes the "Archive" link/button.
 */
export function ArchiveAction({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" reveal onClick={onClick}>
      <Archive className="h-3.5 w-3.5" />
      <span>Archive</span>
    </Button>
  );
}

/**
 * Standardizes the "Export" or "Download" action.
 */
export function ExportAction({
  onClick,
  label = "Export",
  loading,
  disabled,
}: {
  onClick: () => void;
  label?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      reveal
      onClick={onClick}
      loading={loading}
      disabled={disabled}
    >
      <FileDown className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}

/**
 * Standardizes the "Upload" action.
 */
export function UploadAction({
  label = "Upload",
  onClick,
  disabled,
  loading,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      variant="primary"
      size="sm"
      reveal
      onClick={onClick}
      disabled={disabled}
      loading={loading}
    >
      <Upload className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}

/**
 * Standardizes the "Delete" or "Cancel" action.
 */
export function DeleteAction({
  label = "Delete",
  onClick,
  disabled,
  loading,
}: {
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <Button
      variant="danger"
      size="sm"
      reveal
      onClick={onClick}
      disabled={disabled}
      loading={loading}
    >
      <Trash2 className="h-3.5 w-3.5" />
      <span>{label}</span>
    </Button>
  );
}

/**
 * A generic, responsive action button for page headers.
 */
export function ActionButton({
  label,
  icon: Icon,
  onClick,
  disabled,
  loading,
  variant = "outline",
}: {
  label: string;
  icon: any;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: "primary" | "secondary" | "outline" | "danger" | "ghost";
}) {
  const SafeButton = Button as any;
  if (!SafeButton) return null;

  return (
    <SafeButton
      variant={variant}
      size="sm"
      reveal
      onClick={onClick}
      disabled={disabled}
      loading={loading}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      <span>{label}</span>
    </Button>
  );
}

/**
 * Export split button (simplified).
 */
export function ExportSplitAction({
  onExport,
  loading,
  disabled,
}: {
  onExport: (format: "csv" | "pdf") => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 rounded-sm overflow-hidden divide-x divide-slate-200 dark:divide-surface-400  shrink-0">
      <button
        type="button"
        onClick={() => onExport("csv")}
        disabled={loading || disabled}
        className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors disabled:opacity-50"
      >
        CSV
      </button>
      <button
        type="button"
        onClick={() => onExport("pdf")}
        disabled={loading || disabled}
        className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors disabled:opacity-50"
      >
        PDF
      </button>
    </div>
  );
}
