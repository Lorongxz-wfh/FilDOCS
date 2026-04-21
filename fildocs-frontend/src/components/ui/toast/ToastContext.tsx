import React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export type ToastItem = {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
  visible: boolean; // drives CSS enter/exit transition
};

type ToastContextValue = {
  push: (t: Omit<ToastItem, "id" | "visible">) => void;
};

// ─── Context + Provider ───────────────────────────────────────────────────────

const ToastContext = React.createContext<ToastContextValue | null>(null);

function uid() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const remove = React.useCallback((id: string) => {
    // First mark invisible (triggers CSS exit), then remove from DOM
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t))
    );
    window.setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      300
    );
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastItem, "id" | "visible">) => {
      const id = uid();
      const durationMs = t.durationMs ?? 4000;
      // Add as invisible first, flip to visible on next tick so CSS transition fires
      setToasts((prev) =>
        [{ ...t, id, durationMs, visible: false }, ...prev].slice(0, 4)
      );
      window.requestAnimationFrame(() =>
        setToasts((prev) =>
          prev.map((item) => (item.id === id ? { ...item, visible: true } : item))
        )
      );
      window.setTimeout(() => remove(id), durationMs);
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <ToastHost toasts={toasts} onDismiss={remove} />
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

/** Non-throwing version — returns null when used outside ToastProvider */
export function useToastSafe() {
  return React.useContext(ToastContext);
}

// ─── Design tokens (mirrors Alert.tsx accent style) ───────────────────────────

const tokens: Record<
  ToastType,
  { border: string; bg: string; icon: string; iconEl: React.ReactNode }
> = {
  success: {
    border: "border-l-4 border-emerald-400 dark:border-emerald-500",
    bg:     "bg-white dark:bg-surface-500",
    icon:   "text-emerald-500",
    iconEl: <CheckCircle2 className="h-4 w-4" />,
  },
  error: {
    border: "border-l-4 border-rose-400 dark:border-rose-500",
    bg:     "bg-white dark:bg-surface-500",
    icon:   "text-rose-500",
    iconEl: <XCircle className="h-4 w-4" />,
  },
  warning: {
    border: "border-l-4 border-amber-400 dark:border-amber-500",
    bg:     "bg-white dark:bg-surface-500",
    icon:   "text-amber-500",
    iconEl: <AlertTriangle className="h-4 w-4" />,
  },
  info: {
    border: "border-l-4 border-sky-400 dark:border-sky-500",
    bg:     "bg-white dark:bg-surface-500",
    icon:   "text-sky-500",
    iconEl: <Info className="h-4 w-4" />,
  },
};

const progressColor: Record<ToastType, string> = {
  success: "bg-emerald-400 dark:bg-emerald-500",
  error:   "bg-rose-400 dark:bg-rose-500",
  warning: "bg-amber-400 dark:bg-amber-500",
  info:    "bg-sky-400 dark:bg-sky-500",
};

// ─── Individual toast ─────────────────────────────────────────────────────────

const ToastCard: React.FC<{ toast: ToastItem; onDismiss: () => void }> = ({
  toast,
  onDismiss,
}) => {
  const t = tokens[toast.type];

  return (
    <div
      role="alert"
      style={{
        transition: "opacity 280ms ease, transform 280ms ease",
        opacity: toast.visible ? 1 : 0,
        transform: toast.visible ? "translateX(0)" : "translateX(1.5rem)",
      }}
      className={[
        "relative w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl",
        "border border-slate-200 dark:border-surface-400",
        "shadow-md",
        t.bg,
        t.border,
      ].join(" ")}
    >
      {/* Content */}
      <div className="flex items-start gap-3 px-4 py-3 pr-10">
        <span className={["shrink-0 mt-0.5", t.icon].join(" ")}>{t.iconEl}</span>
        <div className="min-w-0 flex-1">
          {toast.title && (
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">
              {toast.title}
            </p>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-snug">
            {toast.message}
          </p>
        </div>
      </div>

      {/* Dismiss button */}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-surface-400 transition"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Progress bar */}
      <div
        className={["h-0.5 w-full origin-left", progressColor[toast.type]].join(" ")}
        style={{
          animation: toast.visible
            ? `toast-shrink ${toast.durationMs}ms linear forwards`
            : undefined,
        }}
      />

      <style>{`
        @keyframes toast-shrink {
          from { transform: scaleX(1); }
          to   { transform: scaleX(0); }
        }
      `}</style>
    </div>
  );
};

// ─── Host (stacking container) ────────────────────────────────────────────────

const ToastHost: React.FC<{
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}> = ({ toasts, onDismiss }) => (
  <div className="fixed bottom-5 right-5 z-9999 flex flex-col-reverse gap-2 items-end pointer-events-none">
    {toasts.map((t) => (
      <div key={t.id} className="pointer-events-auto">
        <ToastCard toast={t} onDismiss={() => onDismiss(t.id)} />
      </div>
    ))}
  </div>
);
