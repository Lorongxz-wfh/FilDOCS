import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, X, Check } from "lucide-react";
import { labelCls } from "../../utils/formStyles";

export type SelectOption = {
  value: string | number;
  label: string;
  sublabel?: string;
  dot?: string; // tailwind bg-* class for a status dot
  disabled?: boolean;
  disabledHint?: string;
};

type Props = {
  value: string | number | null;
  onChange: (value: string | number | null) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  loading?: boolean;
  clearable?: boolean;
  clearLabel?: string;
  searchable?: boolean;
  className?: string;
  error?: string;
};

export default function SelectDropdown({
  value,
  onChange,
  options,
  placeholder = "Select…",
  label,
  disabled = false,
  loading = false,
  clearable = true,
  clearLabel = "No selection",
  searchable = false,
  className = "",
  error,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;

  // Position the portal menu under the trigger button
  const updateMenuPosition = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setMenuStyle({
      position: "fixed",
      top: r.bottom + 4,
      left: r.left,
      width: r.width,
      zIndex: 9999,
    });
  };

  useLayoutEffect(() => {
    if (open) updateMenuPosition();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }

    const handleScroll = () => updateMenuPosition();
    const handleResize = () => updateMenuPosition();
    const handleMousedown = (e: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        // Check if click is inside the portal menu
        const menu = document.getElementById("select-dropdown-portal-menu");
        if (menu && menu.contains(e.target as Node)) return;
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMousedown);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);
    return () => {
      document.removeEventListener("mousedown", handleMousedown);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [open]);

  const triggerCls = [
    "w-full flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm outline-none transition-all",
    error
      ? "border-rose-300 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20"
      : "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600",
    open
      ? "ring-2 ring-brand-500 border-brand-500 dark:border-brand-400 "
      : "hover:border-slate-300 dark:hover:border-surface-300 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:focus:border-brand-400",
    disabled
      ? "opacity-50 cursor-not-allowed text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-surface-700"
      : "cursor-pointer text-slate-700 dark:text-slate-200",
  ].join(" ");

  const menu = open && !disabled && (
    <div
      id="select-dropdown-portal-menu"
      style={menuStyle}
      className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100"
    >
      {searchable && (
        <div className="relative border-b border-slate-100 dark:border-surface-400">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            autoFocus
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Search…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-0"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
      <ul className="max-h-60 overflow-y-auto py-1">
        {clearable && !search && (
          <li>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-surface-400 transition-colors"
            >
              {clearLabel}
            </button>
          </li>
        )}
        {(() => {
          const filtered =
            searchable && search
              ? options.filter(
                  (o) =>
                    o.label.toLowerCase().includes(search.toLowerCase()) ||
                    (o.sublabel ?? "").toLowerCase().includes(search.toLowerCase()),
                )
              : options;

          if (filtered.length === 0) {
            return (
              <li className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                No results found
              </li>
            );
          }

          return filtered.map((o) => {
            const isSelected = o.value === value;
            return (
              <li key={o.value}>
                <button
                  type="button"
                  disabled={o.disabled && !isSelected}
                  onClick={() => {
                    if (o.disabled && !isSelected) return;
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={[
                    "w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between gap-3",
                    isSelected
                      ? "bg-brand-50 dark:bg-brand-500/10 text-brand-600 dark:text-brand-400 font-semibold"
                      : o.disabled
                        ? "text-slate-300 dark:text-slate-600 cursor-not-allowed"
                        : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400/50",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {o.dot && (
                      <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${o.dot}`} />
                    )}
                    <div className="truncate flex flex-col">
                      <span className="truncate">{o.label}</span>
                      {o.sublabel && (
                        <span className="truncate text-[10px] opacity-60 leading-tight">
                          {o.sublabel}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2">
                    {o.disabled && !isSelected && o.disabledHint && (
                      <span className="text-[10px] bg-slate-100 dark:bg-surface-600 px-1.5 py-0.5 rounded text-slate-500 uppercase tracking-wider font-semibold">
                        {o.disabledHint}
                      </span>
                    )}
                    {isSelected && <Check className="h-3.5 w-3.5" />}
                  </div>
                </button>
              </li>
            );
          });
        })()}
      </ul>
    </div>
  );

  return (
    <div ref={wrapperRef} className={`relative flex flex-col ${className}`}>
      {label && <label className={labelCls}>{label}</label>}

      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        className={triggerCls}
      >
        <div className="truncate flex-1 text-left min-w-0">
          {loading ? (
            <span className="flex items-center gap-2 text-slate-400">
              <span className="h-3 w-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin" />
              Loading…
            </span>
          ) : selected ? (
            <span className="flex items-center gap-2">
              {selected.dot && (
                <span className={`shrink-0 h-1.5 w-1.5 rounded-full ${selected.dot}`} />
              )}
              <span className="truncate font-medium">{selected.label}</span>
            </span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500">{placeholder}</span>
          )}
        </div>
        <ChevronDown
          className={`shrink-0 h-4 w-4 text-slate-400 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {error && (
        <p className="mt-1 text-xs text-rose-500 font-medium">{error}</p>
      )}

      {menu && createPortal(menu, document.body)}
    </div>
  );
}
