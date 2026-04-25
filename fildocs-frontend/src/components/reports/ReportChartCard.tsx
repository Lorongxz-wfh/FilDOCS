import React, { useRef, useState } from "react";
import { Download } from "lucide-react";
import { ChartSkeleton, type ChartSkeletonProps } from "../ui/loader/ChartSkeleton";
import { Card, CardHeader, CardBody } from "../ui/Card";

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

  const exportActions = hasExport && (
    <div className="relative" data-export-menu>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={exporting || loading}
        className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400 transition-all disabled:opacity-50 active:scale-95 shadow-sm"
      >
        <Download size={12} strokeWidth={2.5} />
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
          <div className="absolute right-0 top-full z-20 mt-1.5 w-40 rounded-lg border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-xl overflow-hidden ring-1 ring-black/5">
            {onExportPdf && (
              <button
                type="button"
                onClick={handlePdf}
                className="w-full px-4 py-2.5 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
              >
                Export as PDF
              </button>
            )}
            {onExportCsv && (
              <button
                type="button"
                onClick={handleCsv}
                className="w-full px-4 py-2.5 text-left text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
              >
                Export as CSV
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <Card ref={cardRef} className={className}>
      <CardHeader
        title={title}
        subtitle={subtitle}
        right={
          <div className="flex items-center gap-2">
            {action}
            {exportActions}
          </div>
        }
      />
      <CardBody noPadding={false} className="p-4 sm:p-6">
        {loading ? (
          <ChartSkeleton height={skeletonHeight} type={skeletonType} />
        ) : (
          children
        )}
      </CardBody>
    </Card>
  );
};

export default ReportChartCard;
