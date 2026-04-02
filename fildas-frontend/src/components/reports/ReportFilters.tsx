import React from "react";
import { X } from "lucide-react";
import { filterSelectCls } from "../../utils/formStyles";

export type Bucket = "daily" | "weekly" | "monthly" | "yearly" | "total";
export type Parent = "ALL" | "PO" | "VAd" | "VA" | "VF" | "VR";
export type DateField = "completed" | "created";
export type Scope = "clusters" | "offices";

interface ReportFiltersProps {
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  activeFilterCount: number;
  clearAllFilters: () => void;
  isOfficeHead: boolean;
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
  filtersOpen,
  setFiltersOpen,
  activeFilterCount,
  clearAllFilters,
  isOfficeHead,
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
    <>
      {/* Sliding filter panel — fixed overlay on mobile */}
      <div
        className={`fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm sm:hidden transition-opacity duration-300 ${
          filtersOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setFiltersOpen(false)}
      />
      <aside
        className={[
          "fixed inset-y-0 right-0 z-50 flex flex-col sm:static sm:inset-y-auto sm:right-auto bg-white dark:bg-surface-500 overflow-y-auto transition-all duration-300 ease-in-out",
          filtersOpen
            ? "w-72 sm:w-64 opacity-100 border-l border-slate-200 dark:border-surface-400 shadow-2xl sm:shadow-none"
            : "w-0 opacity-0 overflow-hidden border-transparent pointer-events-none sm:pointer-events-auto",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-surface-400">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Filters
            </span>
            {activeFilterCount > 0 && (
              <span className="rounded-full bg-brand-400 px-1.5 py-0.5 text-[10px] font-semibold text-white leading-none">
                {activeFilterCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="text-[11px] font-medium text-brand-500 dark:text-brand-400 hover:underline"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setFiltersOpen(false)}
              className="text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-5 p-4">
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

          {/* View by — hidden for office head */}
          {!isOfficeHead && (
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
                      i > 0
                        ? "border-l border-slate-200 dark:border-surface-400"
                        : "",
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

          {/* Cluster picker */}
          {!isOfficeHead && scope === "clusters" && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Cluster
              </p>
              <select
                value={parent}
                onChange={(e) => setParent(e.target.value as Parent)}
                className={filterSelectCls}
              >
                <option value="ALL">All clusters</option>
                <option value="PO">President (PO)</option>
                <option value="VAd">VP-Admin (VAd)</option>
                <option value="VA">VP-AA (VA)</option>
                <option value="VF">VP-Finance (VF)</option>
                <option value="VR">VP-REQA (VR)</option>
              </select>
            </div>
          )}

          {/* Office picker */}
          {!isOfficeHead && scope === "offices" && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Office
              </p>
              <select
                value={officeId ?? ""}
                onChange={(e) =>
                  setOfficeId(e.target.value ? Number(e.target.value) : null)
                }
                className={filterSelectCls}
              >
                <option value="">All offices</option>
                {[...officesList]
                  .sort((a, b) => a.code.localeCompare(b.code))
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.code} — {o.name}
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Group by */}
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Group by
            </p>
            <select
              value={bucket}
              onChange={(e) => setBucket(e.target.value as Bucket)}
              className={filterSelectCls}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="total">Total</option>
            </select>
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
                    i > 0
                      ? "border-l border-slate-200 dark:border-surface-400"
                      : "",
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
                <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">
                  From
                </p>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className={filterSelectCls}
                />
              </div>
              <div>
                <p className="mb-1 text-[10px] text-slate-400 dark:text-slate-500">
                  To
                </p>
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
      </aside>
    </>
  );
};

export default ReportFilters;
