import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useToastSafe } from "./toast/ToastContext";
import Tooltip from "./Tooltip";
import { normalizeError } from "../../lib/normalizeError";

type Side = "top" | "bottom" | "left" | "right";

interface RefreshButtonProps {
  /** Sync click — no toast feedback */
  onClick?: () => void;
  /**
   * Async load function — shows success/error toast on completion.
   * Return a string to use as the toast message, or void for the default.
   * Return `false` to suppress the success toast entirely.
   */
  onRefresh?: () => Promise<string | false | void>;
  loading?: boolean;
  disabled?: boolean;
  title?: string;
  tooltipSide?: Side;
  className?: string;
  /** Cooldown duration in ms after completion to prevent spam. Default 5000. */
  cooldownMs?: number;
}

export default function RefreshButton({
  onClick,
  onRefresh,
  loading = false,
  disabled = false,
  title = "Refresh",
  tooltipSide = "bottom",
  className = "",
  cooldownMs = 5000,
}: RefreshButtonProps) {
  const toast = useToastSafe();
  const [internalLoading, setInternalLoading] = useState(false);
  const [onCooldown, setOnCooldown] = useState(false);

  const handleClick = async () => {
    if (onRefresh) {
      setInternalLoading(true);
      try {
        const result = await onRefresh();
        if (result === false) return;
        if (typeof result === "string") {
          // Caller controls the message — infer type from content
          const isUpToDate =
            result.toLowerCase().includes("up to date") ||
            result.toLowerCase().includes("no new") ||
            result.toLowerCase().includes("already");
          toast?.push({
            type: isUpToDate ? "info" : "success",
            message: result,
            durationMs: 2500,
          });
        } else {
          toast?.push({
            type: "info",
            message: "Page refreshed.",
            durationMs: 2500,
          });
        }
      } catch (err) {
        toast?.push({ type: "error", message: normalizeError(err) });
      } finally {
        setInternalLoading(false);
        setOnCooldown(true);
        setTimeout(() => setOnCooldown(false), cooldownMs);
      }
    } else {
      onClick?.();
    }
  };

  const isSpinning = loading || internalLoading;
  const isDisabled = disabled || loading || internalLoading || onCooldown;

  return (
    <Tooltip text={onCooldown ? "Just refreshed" : title} side={tooltipSide}>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDisabled}
        className={`flex items-center justify-center h-8 w-8 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-surface-400 disabled:opacity-40 transition ${className}`}
        aria-label={title}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isSpinning ? "animate-spin" : ""}`} />
      </button>
    </Tooltip>
  );
}
