import React from "react";
import { type LucideIcon, Search, Inbox } from "lucide-react";
import { motion } from "framer-motion";

interface EmptyStateProps {
  /** Custom icon element or LucideIcon component */
  icon?: React.ReactNode | LucideIcon;
  /** Primary heading for the empty state */
  label: string;
  /** Secondary supporting text */
  description?: string;
  /** Call to action button or element */
  action?: React.ReactNode;
  /** Custom wrapper classes */
  className?: string;
  /** If true, uses a default search icon and styling optimized for "No results" scenarios */
  isSearch?: boolean;
}

/**
 * Standardized Empty State component for FilDOCS.
 * Follows premium, utilitarian design principles with clear typography and spacing.
 */
export default function EmptyState({
  icon: Icon,
  label,
  description,
  action,
  className = "",
  isSearch = false,
}: EmptyStateProps) {
  const renderIcon = () => {
    const finalIcon = Icon ?? (isSearch ? Search : Inbox);
    if (!finalIcon) return null;

    // Check if it's a Lucide icon component (function or forwardRef object)
    const isComponent =
      typeof finalIcon === "function" ||
      (typeof finalIcon === "object" && "$$typeof" in (finalIcon as any));

    if (isComponent) {
      const LucideIconComponent = finalIcon as LucideIcon;
      return <LucideIconComponent className="h-6 w-6" strokeWidth={1.5} />;
    }

    return finalIcon as React.ReactNode;
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 dark:bg-surface-600 mb-4 border border-slate-100 dark:border-surface-400 shadow-sm shadow-slate-200/50 dark:shadow-none">
        <div className="text-slate-400 dark:text-slate-500">
          {renderIcon()}
        </div>
      </div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1.5">
        {label}
      </h3>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[280px] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </motion.div>
  );
}
