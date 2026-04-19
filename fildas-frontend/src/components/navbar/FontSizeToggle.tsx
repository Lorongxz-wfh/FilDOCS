import React from "react";
import { Type, Check } from "lucide-react";
import { useThemeContext } from "../../lib/ThemeContext";
import { type FontSize } from "../../lib/theme";

export default function FontSizeToggle() {
  const { fontSize, setFontSize } = useThemeContext();
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const options: { label: string; value: FontSize; size: string }[] = [
    { label: "Small", value: "small", size: "12px" },
    { label: "Default", value: "default", size: "14px" },
    { label: "Large", value: "large", size: "16px" },
  ];

  // Close when clicking outside
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-400 transition-all duration-200 active:scale-90"
        title="Adjust font size"
      >
        <Type className="h-4.5 w-4.5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl ring-1 ring-black/5 dark:border-surface-400 dark:bg-surface-500 animate-pop-in-top">
          <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-surface-300">
            Font Scaling
          </div>
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                setFontSize(opt.value);
                setIsOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                fontSize === opt.value
                  ? "bg-brand-50 text-brand-600 dark:bg-brand-900/20 dark:text-brand-400"
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-surface-400"
              }`}
            >
              <div className="flex flex-col items-start gap-0.5">
                <span className="font-semibold">{opt.label}</span>
                <span className="text-[10px] opacity-60">Base: {opt.size}</span>
              </div>
              {fontSize === opt.value && <Check className="h-3.5 w-3.5" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
