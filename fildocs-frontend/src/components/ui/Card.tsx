import React from "react";

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
  noBorder?: boolean;
}

/**
 * Standardized Card Header
 * Includes title (uppercase tracking), optional icon, subtitle, and right-aligned actions.
 */
export const CardHeader: React.FC<{
  title: string | React.ReactNode;
  subtitle?: string | React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, icon, right, className = "" }) => (
  <div className={`shrink-0 flex items-start justify-between gap-3 border-b border-slate-100 dark:border-surface-400 p-3 sm:px-4 sm:py-3 ${className}`}>
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 leading-tight truncate">
          {title}
        </p>
      </div>
      {subtitle && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1 italic">
          {subtitle}
        </p>
      )}
    </div>
    {right && <div className="flex items-center shrink-0">{right}</div>}
  </div>
);

/**
 * Standardized Card Body
 * Handles consistent padding and flex growth.
 */
export const CardBody: React.FC<{ 
  children: React.ReactNode; 
  className?: string; 
  noPadding?: boolean 
}> = ({ children, className = "", noPadding }) => (
  <div className={`flex-1 flex flex-col ${noPadding ? "" : "p-3 sm:p-4"} ${className}`}>
    {children}
  </div>
);

/**
 * Standardized Card Footer
 * Subtle background and border to separate actions from content.
 */
export const CardFooter: React.FC<{ 
  children: React.ReactNode; 
  className?: string 
}> = ({ children, className = "" }) => (
  <div className={`shrink-0 border-t border-slate-100 dark:border-surface-400 px-4 py-2 bg-slate-50/50 dark:bg-surface-600/30 ${className}`}>
    {children}
  </div>
);

/**
 * Standardized Card Container
 * Enforces the system's 1px border, , and rounded-md geometry.
 */
export const Card: React.FC<CardProps> = ({ 
  children, 
  className = "", 
  onClick, 
  hoverable, 
  noBorder 
}) => {
  const isClickable = !!onClick || hoverable;
  return (
    <div
      onClick={onClick}
      className={`
        flex flex-col rounded-md bg-white dark:bg-surface-500 overflow-hidden 
        transition-[transform,border-color,background-color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)]
        ${noBorder ? "" : "border border-slate-200 dark:border-surface-400"}
        ${isClickable ? "cursor-pointer hover:border-brand-300 dark:hover:border-surface-300 active:scale-[0.99]" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
