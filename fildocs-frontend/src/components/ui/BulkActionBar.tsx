import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "./Button";
import { X } from "lucide-react";

export type BulkAction = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "warning";
  count?: number;
  disabled?: boolean;
  loading?: boolean;
};

interface BulkActionBarProps {
  selectedCount: number;
  actions: BulkAction[];
  onClear: () => void;
}

export default function BulkActionBar({
  selectedCount,
  actions,
  onClear,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-2xl px-4"
      >
        <div className="pointer-events-auto flex items-center gap-4 bg-slate-900 dark:bg-surface-600 text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-3 pr-4 border-r border-white/20">
            <button
              onClick={onClear}
              className="p-1 hover:bg-white/10 rounded-md transition-colors"
              title="Clear selection"
            >
              <X size={16} />
            </button>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">{selectedCount} Selected</span>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-medium">Batch Action</span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 overflow-x-auto hide-scrollbar">
            {actions.map((action, idx) => {
              const showCount = action.count !== undefined;
              const isDisabled = action.disabled || (showCount && action.count === 0);

              return (
                <Button
                  key={idx}
                  variant={(action.variant as any) || "secondary"}
                  size="sm"
                  onClick={action.onClick}
                  disabled={isDisabled}
                  loading={action.loading}
                  className={`whitespace-nowrap flex items-center gap-1.5 h-9 px-3 text-xs font-semibold ring-offset-slate-900 transition-all ${
                    action.variant === "danger" 
                      ? "bg-rose-600 hover:bg-rose-700 text-white border-none  shadow-rose-900/20" 
                      : action.variant === "warning"
                        ? "bg-amber-500 hover:bg-amber-600 text-white border-none  shadow-amber-900/20"
                        : action.variant === "primary"
                          ? "bg-brand-600 hover:bg-brand-700 text-white border-none  shadow-brand-900/20"
                          : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                  }`}
                >
                  {action.icon}
                  {action.label}
                  {showCount && (
                    <span className="ml-0.5 opacity-60 tabular-nums">({action.count})</span>
                  )}
                </Button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
