import React from "react";
import type { DocumentVersion } from "../../../services/documents";
import { logOpenedVersion } from "../../../services/documents";

type Props = {
  allVersions: DocumentVersion[];
  selectedVersion: DocumentVersion | null;
  isLoadingSelectedVersion: boolean;
  onSelectVersion: (v: DocumentVersion) => void;
};

const statusColors: Record<string, string> = {
  draft: "bg-slate-100 text-slate-600 dark:bg-surface-400 dark:text-slate-300",
  review: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  approval: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  registration: "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  distributed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

function getStatusColor(status: string): string {
  const key = status.toLowerCase().trim();
  return (
    statusColors[key] ??
    Object.entries(statusColors).find(([k]) => key.includes(k))?.[1] ??
    statusColors.draft
  );
}

const VersionsDropdown: React.FC<Props> = ({
  allVersions,
  selectedVersion,
  isLoadingSelectedVersion,
  onSelectVersion,
}) => {
  const [open, setOpen] = React.useState(false);
  const [dropdownPos, setDropdownPos] = React.useState<{ top: number; right: number } | null>(null);

  const triggerRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const fixedRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      const inTrigger = triggerRef.current?.contains(e.target as Node);
      const inFixed = fixedRef.current?.contains(e.target as Node);
      if (!inTrigger && !inFixed) setOpen(false);
    };
    if (open) window.document.addEventListener("mousedown", handler);
    return () => window.document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={triggerRef} className="flex items-center">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          if (buttonRef.current) {
            const r = buttonRef.current.getBoundingClientRect();
            setDropdownPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
          }
          setOpen((v) => !v);
        }}
        className="flex items-center gap-2 rounded-md border border-slate-300 dark:border-surface-300 bg-slate-100 dark:bg-surface-500 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-surface-400  transition"
      >
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          v{selectedVersion?.version_number ?? "—"}
        </span>
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && dropdownPos && (
        <div
          ref={fixedRef}
          style={{ position: "fixed", top: dropdownPos.top, right: dropdownPos.right }}
          className="z-999 w-72 rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-xl overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-slate-100 dark:border-surface-400">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Select version
            </p>
          </div>
          <div className="max-h-56 overflow-y-auto">
            <div className="p-2 space-y-1">
              {allVersions.map((v) => {
                const isSel = v.id === (selectedVersion?.id ?? null);
                return (
                  <button
                    key={v.id}
                    type="button"
                    disabled={isLoadingSelectedVersion}
                    onClick={() => {
                      onSelectVersion(v);
                      logOpenedVersion(v.id, "versions_panel");
                      setOpen(false);
                    }}
                    className={[
                      "w-full rounded-md px-3 py-2 text-left transition border",
                      isSel
                        ? "border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30"
                        : "border-transparent hover:bg-slate-50 dark:hover:bg-surface-500",
                      isLoadingSelectedVersion ? "opacity-60 cursor-not-allowed" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          v{v.version_number}
                        </span>
                        {isSel && (
                          <span className="text-xs text-sky-500">current</span>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(v.status)}`}>
                        {v.status}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                      {new Date(v.created_at).toLocaleDateString()} · Updated{" "}
                      {new Date(v.updated_at).toLocaleDateString()}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VersionsDropdown;
