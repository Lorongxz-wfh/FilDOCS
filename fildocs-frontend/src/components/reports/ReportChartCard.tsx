import React, { useRef, useState } from "react";
import { Download } from "lucide-react";
import ChartSkeleton, { ChartSkeletonProps } from "../ui/loader/ChartSkeleton";

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  loading?: boolean;
  skeletonHeight?: number;
  skeletonType?: ChartSkeletonProps["type"];
  onExportCsv?: () => void;
  onExportPdf?: (element: HTMLElement) => Promise<void>;
};

const ReportChartCard: React.FC<Props> = ({
  title,
  subtitle,
  action,
  children,
  className = "",
  loading = false,
  skeletonHeight = 220,
  skeletonType = "bar",
  onExportCsv,
  onExportPdf,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const hasExport = onExportCsv || onExportPdf;

  const handlePdf = async () => {
    if (!onExportPdf || !cardRef.current) return;
    setOpen(false);
    setExporting(true);
    try {
      await onExportPdf(cardRef.current);
    } finally {
      setExporting(false);
    }
  };

  const handleCsv = () => {
    onExportCsv?.();
    setOpen(false);
  };

  return (
    <div
      ref={cardRef}
      className={`rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden ${className}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-surface-400 px-4 sm:px-6 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            {title}
          </p>
          {subtitle && (
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {action && <div>{action}</div>}
          {hasExport && (
            <div className="relative" data-export-menu>
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                disabled={exporting || loading}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition disabled:opacity-50 "
              >
                <Download size={12} />
                <span className="hidden sm:inline">
                  {exporting ? "Exporting…" : "Export"}
                </span>
              </button>
              {open && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-20 mt-1 w-36 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-lg overflow-hidden">
                    {onExportPdf && (
                      <button
                        type="button"
                        onClick={handlePdf}
                        className="w-full px-4 py-2.5 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                      >
                        Export as PDF
                      </button>
                    )}
                    {onExportCsv && (
                      <button
                        type="button"
                        onClick={handleCsv}
                        className="w-full px-4 py-2.5 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
                      >
                        Export as CSV
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="p-4 sm:p-6">
        {loading ? (
          <ChartSkeleton height={skeletonHeight} type={skeletonType} />
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default ReportChartCard;
