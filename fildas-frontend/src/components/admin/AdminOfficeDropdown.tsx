import React, { useEffect, useMemo, useState } from "react";
import { getAdminOffices, type AdminOffice } from "../../services/admin";

// Shared input classes for admin forms
export const adminInputCls = [
  "w-full rounded-md border px-3 py-2 text-sm outline-none transition",
  "border-slate-300 bg-white text-slate-900",
  "focus:border-brand-400 dark:focus:border-brand-300",
  "dark:border-surface-400 dark:bg-surface-400 dark:text-slate-200",
  "disabled:bg-slate-50 disabled:opacity-60 dark:disabled:bg-surface-600",
].join(" ");

type Props = {
  value: number | null;
  onChange: (officeId: number | null) => void;
  error?: string;
  label?: string;
  required?: boolean;
  excludeOfficeIds?: number[];
  disabled?: boolean;
  autoLoad?: boolean;
};

const AdminOfficeDropdown: React.FC<Props> = ({
  value,
  onChange,
  error,
  label = "Office / Department",
  required = false,
  excludeOfficeIds = [],
  disabled = false,
  autoLoad = true,
}) => {
  const [offices, setOffices] = useState<AdminOffice[]>([]);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    if (!autoLoad || disabled) {
      setLoading(false);
      return () => {
        alive = false;
      };
    }

    const load = async () => {
      try {
        const res = await getAdminOffices({ per_page: 500 });
        if (!alive) return;
        setOffices(res.data);
      } catch (e) {
        console.error("Failed to load admin offices", e);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [autoLoad, disabled]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return offices;
    return offices.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.code.toLowerCase().includes(q),
    );
  }, [offices, search]);

  const selected = useMemo(
    () => offices.find((o) => o.id === value) ?? null,
    [offices, value],
  );

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        {label} {required ? <span className="text-rose-500">*</span> : null}
      </label>

      <div className="relative">
        <input
          type="text"
          placeholder={disabled ? "Disabled" : "Search office..."}
          value={isOpen ? search : selected?.name || ""}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => {
            if (disabled) return;
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          disabled={disabled}
          className={[
            "block w-full rounded-md border px-3 py-2 text-sm  outline-none transition",
            disabled
              ? "bg-slate-50 text-slate-500 dark:bg-surface-600 dark:text-slate-500"
              : "bg-white text-slate-900 dark:bg-surface-400 dark:text-slate-200",
            error
              ? "border-rose-300 focus:border-rose-500 dark:border-rose-700"
              : "border-slate-300 focus:border-brand-400 dark:border-surface-400 dark:focus:border-brand-300",
          ].join(" ")}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg
            className={`h-4 w-4 text-slate-400 dark:text-slate-500 transition ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-10 mt-1 w-full rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-lg">
          <ul className="max-h-56 overflow-y-auto">
            {loading ? (
              <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                Loading...
              </li>
            ) : filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                No offices found
              </li>
            ) : (
              filtered.map((office) => {
                const isExcluded =
                  excludeOfficeIds.includes(office.id) && office.id !== value;

                return (
                  <li key={office.id}>
                    <button
                      type="button"
                      disabled={isExcluded}
                      aria-disabled={isExcluded}
                      className={`w-full text-left px-3 py-2 text-sm transition ${
                        value === office.id
                          ? "bg-sky-50 text-sky-700 font-medium dark:bg-sky-950/40 dark:text-sky-400"
                          : isExcluded
                            ? "text-slate-400 cursor-not-allowed dark:text-slate-600"
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-surface-400"
                      }`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (isExcluded) return;
                        onChange(office.id);
                        setIsOpen(false);
                        setSearch("");
                      }}
                    >
                      <span className="font-medium">{office.name}</span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                        ({office.code})
                      </span>
                    </button>
                  </li>
                );
              })
            )}

            {!loading && (
              <li className="border-t border-slate-100 dark:border-surface-400">
                <button
                  type="button"
                  className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-400"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onChange(null);
                    setIsOpen(false);
                    setSearch("");
                  }}
                >
                  Clear selection
                </button>
              </li>
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

export default AdminOfficeDropdown;
