import React, { useEffect } from "react";

type Props = {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  widthClassName?: string;
  headerActions?: React.ReactNode;
  footer?: React.ReactNode;
};

export default function Modal({
  open,
  title,
  children,
  onClose,
  widthClassName = "max-w-lg",
  headerActions,
  footer,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0"
      />
      <div className="relative w-[92vw] max-h-[90vh] flex flex-col">
        <div
          className={[
            "mx-auto rounded-md border border-slate-200 bg-white shadow-lg flex flex-col w-full",
            "dark:border-surface-400 dark:bg-surface-500",
            widthClassName,
          ].join(" ")}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-surface-400">
            <h2 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
              {title}
            </h2>
            {headerActions ? (
              <div className="flex items-center gap-2 shrink-0">
                {headerActions}
              </div>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
                aria-label="Close"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Body */}
          <div className="p-3 sm:px-4 sm:py-4 max-h-[80vh] overflow-y-auto min-h-0 flex-1 sm:flex-none">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-surface-400 dark:bg-surface-600/30">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
