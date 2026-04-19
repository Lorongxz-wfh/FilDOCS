import React from "react";
import { motion } from "framer-motion";

export interface PresetOption {
  value: string;
  label: string;
  mobileIcon?: React.ReactNode;
  mobileBadge?: string | number;
}

interface DatePresetSwitcherProps {
  options: PresetOption[];
  value: string;
  onChange: (value: any) => void;
  layoutId?: string;
  className?: string;
}

const DatePresetSwitcher: React.FC<DatePresetSwitcherProps> = ({
  options,
  value,
  onChange,
  layoutId = "active-preset",
  className = "",
}) => {
  return (
    <div className={`flex items-center rounded-md border border-slate-200 bg-white/50 p-0.5 dark:border-surface-400 dark:bg-black/20 relative ${className}`}>
      {options.map((p) => {
        const isActive = value === p.value;
        return (
          <button
            key={p.value}
            type="button"
            onClick={() => onChange(p.value)}
            className={`relative px-3 py-1 text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider transition-all rounded-sm min-w-[50px] flex items-center justify-center z-0 ${
              isActive
                ? "text-brand-600 font-extrabold dark:text-brand-400"
                : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 bg-white dark:bg-surface-400  rounded-sm -z-10"
                transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
              />
            )}
            
            {/* Desktop Label */}
            <span className={`${p.mobileIcon ? 'hidden md:inline' : 'inline'} z-10`}>
              {p.label}
            </span>

            {/* Mobile Icon Variant */}
            {p.mobileIcon && (
              <div className="md:hidden relative flex items-center justify-center z-10">
                {p.mobileIcon}
                {p.mobileBadge && (
                  <span className="absolute text-[7px] font-black pt-1.5 leading-none">
                    {p.mobileBadge}
                  </span>
                )}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

export default DatePresetSwitcher;
