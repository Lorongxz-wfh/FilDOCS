// import { selectCls } from "../../utils/formStyles";
import SelectDropdown from "../ui/SelectDropdown";
import React from "react";
import { DateRangePicker } from "../ui/DateRangePicker";
import type { ActivityLogsParams, Scope, Category } from "../../hooks/useActivityLogs";
import SearchFilterBar from "../ui/SearchFilterBar";

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
  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (params.scope !== "all") count++;
    if (params.category) count++;
    if (params.dateFrom) count++;
    if (params.dateTo) count++;
    return count;
  }, [params.scope, params.category, params.dateFrom, params.dateTo]);

  return (
    <SearchFilterBar
      search={params.q}
      setSearch={(val) => updateParams({ q: val })}
      placeholder="Search event / label…"
      activeFiltersCount={activeFiltersCount}
      onClear={onClear}
      mobileFilters={
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Scope</label>
              {isOfficeHead ? (
                <div className="px-3 h-9 rounded-md border border-slate-200 dark:border-surface-400 bg-slate-100 dark:bg-surface-500 opacity-60 flex items-center justify-center text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  Office scoped
                </div>
              ) : (
                <SelectDropdown
                  value={params.scope}
                  onChange={(val) => updateParams({ scope: val as Scope })}
                  className="w-full"
                  options={[
                    { value: "all", label: "All" },
                    { value: "office", label: "My office" },
                    { value: "mine", label: "Mine" },
                  ]}
                />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Category</label>
              <SelectDropdown
                value={params.category}
                onChange={(val) => updateParams({ category: val as Category })}
                className="w-full"
                options={[
                  { value: "", label: "All categories" },
                  { value: "workflow", label: "Workflow" },
                  { value: "request", label: "Document Requests" },
                  { value: "document", label: "Documents" },
                  { value: "user", label: "User Management" },
                  { value: "template", label: "Templates" },
                  { value: "profile", label: "Profile & Auth" },
                ]}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Date Range</label>
            <DateRangePicker
              from={params.dateFrom}
              to={params.dateTo}
              onSelect={(r: any) => updateParams({ dateFrom: r.from, dateTo: r.to })}
            />
          </div>
        </div>
      }
    >
      {!isOfficeHead ? (
        <SelectDropdown
          value={params.scope}
          onChange={(val) => updateParams({ scope: val as Scope })}
          className="w-24"
          options={[
            { value: "all", label: "All" },
            { value: "office", label: "My office" },
            { value: "mine", label: "Mine" },
          ]}
        />
      ) : (
        <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-3 h-8 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          {officeName || "Your office"}
        </span>
      )}

      <SelectDropdown
        value={params.category}
        onChange={(val) => updateParams({ category: val as Category })}
        className="w-36"
        options={[
          { value: "", label: "All categories" },
          { value: "workflow", label: "Workflow" },
          { value: "request", label: "Document Requests" },
          { value: "document", label: "Documents" },
          { value: "user", label: "User Management" },
          { value: "template", label: "Templates" },
          { value: "profile", label: "Profile & Auth" },
        ]}
      />

      <DateRangePicker
        from={params.dateFrom}
        to={params.dateTo}
        onSelect={(r: any) => updateParams({ dateFrom: r.from, dateTo: r.to })}
      />
    </SearchFilterBar>
  );
};

export default ActivityLogsFilters;
