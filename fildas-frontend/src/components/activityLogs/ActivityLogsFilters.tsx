import React from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { inputCls, selectCls } from "../../utils/formStyles";
import DateRangeInput from "../ui/DateRangeInput";
import type { ActivityLogsParams, Scope, Category } from "../../hooks/useActivityLogs";

interface Props {
  params: ActivityLogsParams;
  updateParams: (updates: Partial<ActivityLogsParams>) => void;
  isOfficeHead: boolean;
  officeName?: string;
  onClear: () => void;
}

const ActivityLogsFilters: React.FC<Props> = ({
  params,
  updateParams,
  isOfficeHead,
  officeName,
  onClear,
}) => {
  const [isFiltersOpen, setIsFiltersOpen] = React.useState(false);

  const hasFilters =
    params.category !== "" ||
    params.q !== "" ||
    params.dateFrom !== "" ||
    params.dateTo !== "" ||
    (!isOfficeHead && params.scope !== "all");

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (params.scope !== "all") count++;
    if (params.category) count++;
    if (params.dateFrom) count++;
    if (params.dateTo) count++;
    return count;
  }, [params.scope, params.category, params.dateFrom, params.dateTo]);

  return (
    <div className="shrink-0 py-3 flex flex-col gap-3 sm:gap-2">
      <div className="flex items-center gap-2">
        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            value={params.q}
            onChange={(e) => updateParams({ q: e.target.value })}
            placeholder="Search event / label…"
            className={`${inputCls} pl-9 pr-10 text-sm`}
          />
          {params.q && (
            <button
              type="button"
              onClick={() => updateParams({ q: "" })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              title="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Mobile Filter Toggle */}
        <button
          type="button"
          onClick={() => setIsFiltersOpen(!isFiltersOpen)}
          className={`sm:hidden flex items-center gap-2 px-3 h-9 rounded-lg border transition-all ${
            isFiltersOpen || activeFiltersCount > 0
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

        {/* Desktop Filters */}
        <div className="hidden sm:flex items-center gap-2">
          {isOfficeHead ? (
            <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 h-8 text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {officeName || "Your office"}
            </span>
          ) : (
            <select
              value={params.scope}
              onChange={(e) => updateParams({ scope: e.target.value as Scope })}
              className={`${selectCls} text-xs h-8 w-24`}
            >
              <option value="all">All</option>
              <option value="office">My office</option>
              <option value="mine">Mine</option>
            </select>
          )}

          <select
            value={params.category}
            onChange={(e) => updateParams({ category: e.target.value as Category })}
            className={`${selectCls} text-xs h-8 w-36`}
          >
            <option value="">All categories</option>
            <option value="workflow">Workflow</option>
            <option value="request">Document Requests</option>
            <option value="document">Documents</option>
            <option value="user">User Management</option>
            <option value="template">Templates</option>
            <option value="profile">Profile & Auth</option>
          </select>

          <DateRangeInput
            from={params.dateFrom}
            to={params.dateTo}
            onFromChange={(val) => updateParams({ dateFrom: val })}
            onToChange={(val) => updateParams({ dateTo: val })}
          />

          {hasFilters && (
            <button
              type="button"
              onClick={onClear}
              className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Mobile Collapsible Panel */}
      {isFiltersOpen && (
        <div className="sm:hidden flex flex-col gap-3 p-4 bg-slate-50 dark:bg-surface-600 rounded-xl border border-slate-200 dark:border-surface-400 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Scope</label>
              {isOfficeHead ? (
                <div className={inputCls + " text-center bg-slate-100 dark:bg-surface-500 opacity-60 flex items-center justify-center text-[11px] h-9 h-9"}>
                  Office scoped
                </div>
              ) : (
                <select
                  value={params.scope}
                  onChange={(e) => updateParams({ scope: e.target.value as Scope })}
                  className={selectCls}
                >
                  <option value="all">All</option>
                  <option value="office">My office</option>
                  <option value="mine">Mine</option>
                </select>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Category</label>
              <select
                value={params.category}
                onChange={(e) => updateParams({ category: e.target.value as Category })}
                className={selectCls}
              >
                <option value="">All categories</option>
                <option value="workflow">Workflow</option>
                <option value="request">Document Requests</option>
                <option value="document">Documents</option>
                <option value="user">User Management</option>
                <option value="template">Templates</option>
                <option value="profile">Profile & Auth</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
            <DateRangeInput
              from={params.dateFrom}
              to={params.dateTo}
              onFromChange={(val) => updateParams({ dateFrom: val })}
              onToChange={(val) => updateParams({ dateTo: val })}
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={onClear}
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

export default ActivityLogsFilters;
