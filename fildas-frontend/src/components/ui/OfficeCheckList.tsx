import React, { useState, useMemo } from "react";
import { Search, Check } from "lucide-react";
import type { Office } from "../../services/documents";

interface OfficeCheckListProps {
  offices: Office[];
  loading: boolean;
  selectedIds: number[];
  onToggle: (id: number) => void;
  multi?: boolean; // false = single select (radio behavior)
}

const OfficeCheckList: React.FC<OfficeCheckListProps> = ({
  offices,
  loading,
  selectedIds,
  onToggle,
  multi = true,
}) => {
  const [search, setSearch] = useState("");

  const sortedAndFiltered = useMemo(() => {
    const q = search.toLowerCase();
    
    // Sort logic: selected first, then alphabetical by name
    const baseList = [...offices].sort((a, b) => {
      const aSelected = selectedIds.includes(a.id);
      const bSelected = selectedIds.includes(b.id);
      
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      return a.name.localeCompare(b.name);
    });

    if (!q) return baseList;
    return baseList.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [offices, search, selectedIds]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100 dark:border-surface-400 flex items-center gap-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search offices…"
          className="flex-1 text-sm bg-transparent outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            ✕
          </button>
        )}
      </div>
      <ul className="max-h-[350px] overflow-y-auto py-1 custom-scrollbar">
        {loading ? (
          <li className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
            Loading offices…
          </li>
        ) : sortedAndFiltered.length === 0 ? (
          <li className="px-4 py-3 text-xs text-slate-400 dark:text-slate-500">
            No offices found.
          </li>
        ) : (
          sortedAndFiltered.map((office) => {
            const isSelected = selectedIds.includes(office.id);
            return (
              <li key={office.id}>
                <button
                  type="button"
                  onClick={() => onToggle(office.id)}
                  className={[
                    "w-full flex items-center gap-3 px-4 py-2 text-sm transition",
                    isSelected
                      ? "bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400"
                      : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400",
                  ].join(" ")}
                >
                  {multi ? (
                    <span
                      className={[
                        "h-4 w-4 shrink-0 rounded border flex items-center justify-center transition",
                        isSelected
                          ? "bg-sky-500 border-sky-500"
                          : "border-slate-300 dark:border-surface-300 bg-white dark:bg-surface-600",
                      ].join(" ")}
                    >
                      {isSelected && (
                        <Check className="h-3 w-3 text-white" strokeWidth={3} />
                      )}
                    </span>
                  ) : (
                    <span
                      className={[
                        "h-4 w-4 shrink-0 rounded-full border flex items-center justify-center transition",
                        isSelected
                          ? "border-sky-500"
                          : "border-slate-300 dark:border-surface-300",
                      ].join(" ")}
                    >
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-sky-500" />
                      )}
                    </span>
                  )}
                  <span className="flex-1 text-left font-medium truncate">
                    {office.name}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0">
                    {office.code}
                  </span>
                </button>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};

export default OfficeCheckList;
