/**
 * Reusable class string helpers for interactive / clickable elements.
 * Import these to keep cursor, focus-ring, and transition behaviour consistent.
 */

/** Pointer cursor — add to any non-button/non-anchor clickable element (div, span, etc.) */
export const clickable = "cursor-pointer";

/** Pointer cursor + no text-selection flash on click */
export const clickableNoSelect = "cursor-pointer select-none";

/** Keyboard-accessible focus ring (brand colour) */
export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1";

/** Base for small icon-only buttons */
export const iconButtonBase =
  "cursor-pointer rounded-md p-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

/** Quiet icon button (subtle hover) */
export const iconButtonQuiet =
  `${iconButtonBase} text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-surface-400 dark:hover:text-slate-200`;
