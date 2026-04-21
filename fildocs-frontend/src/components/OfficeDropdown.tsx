import React, { useState, useEffect, useRef } from "react";
import type { Office } from "../services/documents";
import { listOffices } from "../services/documents";
import { ChevronDown } from "lucide-react";

interface OfficeDropdownProps {
  value: number | null;
  onChange: (officeId: number, name: string, code: string) => void;
  error?: string;
  excludeOfficeIds?: number[];
  hideLabel?: boolean;
}

const OfficeDropdown: React.FC<OfficeDropdownProps> = ({
  value,
  onChange,
  error,
  excludeOfficeIds = [],
  hideLabel = false,
}) => {
  const [offices, setOffices] = useState<Office[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await listOffices();
        setOffices(data.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (err) {
        console.error("Failed to load offices", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch("");
      }
    };
    if (isOpen) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  const filtered = offices.filter((office) => {
    const q = search.toLowerCase();
    return (
      office.name.toLowerCase().includes(q) ||
      office.code.toLowerCase().includes(q)
    );
  });

  const selected = offices.find((o) => o.id === value);

  const inputCls = `w-full rounded-md border px-3 py-2 text-sm outline-none transition
    bg-white dark:bg-surface-600
    text-slate-900 dark:text-slate-100
    placeholder-slate-400 dark:placeholder-slate-500
    ${
      error
        ? "border-rose-300 dark:border-rose-700 focus:border-rose-500"
        : "border-slate-200 dark:border-surface-400 focus:border-brand-400 dark:focus:border-brand-300"
    }`;

  return (
    <div ref={containerRef} className="relative">
      {!hideLabel && (
        <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-1.5">
          Office / Department{" "}
          <span className="text-rose-500 normal-case">*</span>
        </label>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Search office…"
          value={isOpen ? search : (selected?.name ?? "")}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className={inputCls}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <ChevronDown
            className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-lg overflow-hidden">
          <ul className="max-h-48 overflow-y-auto py-1">
            {loading ? (
              <li className="px-3 py-2.5 text-xs text-slate-400 dark:text-slate-500">
                Loading…
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2.5 text-xs text-slate-400 dark:text-slate-500">
                No offices found
              </li>
            ) : (
              filtered.map((office) => {
                const isExcluded =
                  excludeOfficeIds.includes(office.id) && office.id !== value;
                const isSelected = value === office.id;

                return (
                  <li key={office.id}>
                    <button
                      type="button"
                      disabled={isExcluded}
                      className={[
                        "w-full text-left px-3 py-2 text-sm transition",
                        isSelected
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 font-medium"
                          : isExcluded
                            ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                            : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400",
                      ].join(" ")}
                      onClick={() => {
                        if (isExcluded) return;
                        onChange(office.id, office.name, office.code);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    >
                      <span className="font-medium">{office.name}</span>
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                        ({office.code})
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {error && (
        <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{error}</p>
      )}
    </div>
  );
};

export default OfficeDropdown;
