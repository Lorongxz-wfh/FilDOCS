import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
  className?: string;
  /** Unique ID for framer-motion layoutId (essential for smooth transitions) */
  id: string;
  /** If true, tabs will divide the full width equally (even distribution) */
  fullWidth?: boolean;
}

/**
 * Animated Tab Indicator component.
 * Uses layoutId to slide the underline between tabs.
 */
export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange, className = "", id, fullWidth = false }) => {
  return (
    <div className={`shrink-0 flex items-center border-b border-neutral-200 dark:border-surface-400 overflow-x-auto hide-scrollbar ${className}`}>
      {tabs.map((t) => {
        const isActive = activeTab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={[
              "relative group flex items-center gap-2 py-3 text-xs font-semibold tracking-wide transition-all whitespace-nowrap",
              fullWidth ? "flex-1 justify-center px-1" : "px-6",
              isActive 
                ? "text-slate-900 dark:text-surface-50" 
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-surface-50"
            ].join(" ")}
          >
            {t.icon && (
              <span className={`shrink-0 transition-colors ${isActive ? "text-brand-500 dark:text-brand-400" : "text-slate-400 group-hover:text-slate-600"}`}>
                {t.icon}
              </span>
            )}
            <span className="relative z-10">{t.label}</span>
            {t.badge}
            
            {isActive && (
              <motion.div
                layoutId={`tab-indicator-${id}`}
                className="absolute bottom-0 left-1 right-1 h-0.5 bg-brand-500 z-10 rounded-sm"
                transition={{ type: "spring", bounce: 0, duration: 0.25 }}
              />
            )}
            
            {/* Hover Indicator (Subtle) */}
            {!isActive && (
              <div className="absolute bottom-0 left-1 right-1 h-0.5 bg-slate-200 dark:bg-surface-300 opacity-0 group-hover:opacity-100 transition-opacity rounded-t-full" />
            )}
          </button>
        );
      })}
    </div>
  );
};

/**
 * Animated Tab Content wrapper.
 * Fades and slightly slides content when switching.
 */
export const TabContent: React.FC<{ activeKey: string; currentKey: string; children: React.ReactNode; className?: string }> = ({ activeKey, currentKey, children, className = "" }) => {
  return (
    <AnimatePresence mode="wait">
      {activeKey === currentKey && (
        <motion.div
          key={currentKey}
          initial={{ opacity: 0, x: 4 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -4 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          className={className || "w-full"}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
