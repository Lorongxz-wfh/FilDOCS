import React, { useState } from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { inputCls } from "../../utils/formStyles";

interface SearchFilterBarProps {
  search: string;
  setSearch: (val: string) => void;
  placeholder?: string;
  activeFiltersCount?: number;
  onClear?: () => void;
  children?: React.ReactNode;
  mobileFilters?: React.ReactNode;
  className?: string;
}

export const SearchFilterBar: React.FC<SearchFilterBarProps> = ({
  search,
  setSearch,
  placeholder = "Search...",
  activeFiltersCount = 0,
  onClear,
  children,
  mobileFilters,
  className = "",
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  return (
    <div className={`shrink-0 py-3 flex flex-col gap-3 sm:gap-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={placeholder}
            className={`${inputCls} pl-9 pr-8 text-sm`}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Filter Toggle */}
        <button
          type="button"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className={`sm:hidden flex items-center gap-2 px-3 h-9 rounded-lg border transition-all ${isFiltersOpen || activeFiltersCount > 0
            ? "bg-brand-50 border-brand-200 text-brand-600 dark:bg-brand-500/10 dark:border-brand-500/30 dark:text-brand-400 shadow-xs"
            : "bg-white border-slate-200 text-slate-600 dark:bg-surface-500 dark:border-surface-400 dark:text-slate-400"
            }`}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold">Filters</span>
          {activeFiltersCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold bg-brand-500 text-white rounded-full">
              {activeFiltersCount}
            </span>
          )}
        </button>

        {/* Desktop Filters Slot - Right Aligned */}
        <div className="hidden sm:flex items-center gap-2 ml-auto justify-end">
          {children}
          {onClear && (activeFiltersCount > 0 || search) && (
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300 transition-colors animate-in fade-in slide-in-from-right-1 duration-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile Collapsible Filters Slot */}
      {isFiltersOpen && mobileFilters && (
        <div className="sm:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400 animate-in fade-in slide-in-from-top-1 duration-200">
          {mobileFilters}
          {onClear && (
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsFiltersOpen(false);
              }}
              className="w-full py-2.5 text-xs font-bold text-brand-600 bg-brand-50 dark:text-brand-400 dark:bg-brand-500/10 rounded-lg transition"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchFilterBar;
