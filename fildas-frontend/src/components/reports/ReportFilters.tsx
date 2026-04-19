import React from "react";
import { filterSelectCls } from "../../utils/formStyles";
import SelectDropdown from "../ui/SelectDropdown";



export type Bucket = "daily" | "weekly" | "monthly" | "yearly" | "total";
export type Parent = "ALL" | "PO" | "VAd" | "VA" | "VF" | "VR";
export type DateField = "completed" | "created";
export type Scope = "clusters" | "offices";

interface ReportFiltersProps {
  onClear: () => void;
  activeFilterCount: number;
  isOfficeHead: boolean;
  isRestricted?: boolean;
  me: any;
  scope: Scope;
  setScope: (scope: Scope) => void;
  parent: Parent;
  setParent: (parent: Parent) => void;
  officeId: number | null;
  setOfficeId: (id: number | null) => void;
  officesList: { id: number; name: string; code: string }[];
  bucket: Bucket;
  setBucket: (bucket: Bucket) => void;
  dateField: DateField;
  setDateField: (field: DateField) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
}

const ReportFilters: React.FC<ReportFiltersProps> = ({
  onClear,
  activeFilterCount,
  isOfficeHead,
  isRestricted = false,
  me,
  scope,
  setScope,
  parent,
  setParent,
  officeId,
  setOfficeId,
  officesList,
  bucket,
  setBucket,
  dateField,
  setDateField,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
}) => {
  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-surface-400">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Active Filters
          </span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-brand-500 text-white px-1.5 py-0.5 text-[10px] font-semibold leading-none">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[10px] font-semibold text-brand-500 dark:text-brand-400 hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Office head: locked scope notice */}
      {isOfficeHead && (
        <div className="rounded-md bg-slate-50 dark:bg-surface-600 border border-slate-200 dark:border-surface-400 px-3 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
            Data scope
          </p>
          <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
            {me?.office?.name ?? "Your office"}
          </p>
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            Scoped to your office only
          </p>
        </div>
      )}

      {/* View by — hidden for restricted roles */}
      {!isRestricted && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            View by
          </p>
          <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-surface-400">
            {(["offices", "clusters"] as Scope[]).map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setScope(s);
                  if (s === "clusters") setOfficeId(null);
                  if (s === "offices") setParent("ALL");
                }}
                className={[
                  "flex-1 py-1.5 text-xs font-medium transition-colors",
                  i > 0 ? "border-l border-slate-200 dark:border-surface-400" : "",
                  scope === s
                    ? "bg-brand-500 text-white"
                    : "bg-white dark:bg-surface-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500",
                ].join(" ")}
              >
                {s === "clusters" ? "Clusters" : "Offices"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cluster picker — hidden for restricted roles */}
      {!isRestricted && scope === "clusters" && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Cluster
          </p>
          <SelectDropdown
            value={parent}
            onChange={(val) => setParent(val as Parent)}
            className="w-full"
            options={[
              { value: "ALL", label: "All clusters" },
              { value: "PO", label: "President (PO)" },
              { value: "VAd", label: "VP-Admin (VAd)" },
              { value: "VA", label: "VP-AA (VA)" },
              { value: "VF", label: "VP-Finance (VF)" },
              { value: "VR", label: "VP-REQA (VR)" },
            ]}
          />
        </div>
      )}

      {/* Office picker — hidden for restricted roles */}
      {!isRestricted && scope === "offices" && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Office
          </p>
          <SelectDropdown
            value={officeId ?? ""}
            onChange={(val) => setOfficeId(val ? Number(val) : null)}
            className="w-full"
            options={[
              { value: "", label: "All offices" },
              ...[...officesList]
                .sort((a, b) => a.code.localeCompare(b.code))
                .map((o) => ({
                  value: String(o.id),
                  label: `${o.code} — ${o.name}`,
                })),
            ]}
          />
        </div>
      )}

      {/* Group by */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Group by
        </p>
        <SelectDropdown
          value={bucket}
          onChange={(val) => setBucket(val as Bucket)}
          className="w-full"
          options={[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "monthly", label: "Monthly" },
            { value: "yearly", label: "Yearly" },
            { value: "total", label: "Total" },
          ]}
        />
      </div>

      {/* Date field */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Date field
        </p>
        <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-surface-400">
          {(["completed", "created"] as DateField[]).map((f, i) => (
            <button
              key={f}
              type="button"
              onClick={() => setDateField(f)}
              className={[
                "flex-1 py-1.5 text-xs font-medium transition-colors",
                i > 0 ? "border-l border-slate-200 dark:border-surface-400" : "",
                dateField === f
                  ? "bg-brand-500 text-white"
                  : "bg-white dark:bg-surface-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-500",
              ].join(" ")}
            >
              {f === "completed" ? "Completed" : "Created"}
            </button>
          ))}
        </div>
      </div>

      {/* Date range */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Date range
        </p>
        <div className="flex flex-col gap-2">
          <div>
            <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">From</p>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={filterSelectCls}
            />
          </div>
          <div>
            <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">To</p>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={filterSelectCls}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;
