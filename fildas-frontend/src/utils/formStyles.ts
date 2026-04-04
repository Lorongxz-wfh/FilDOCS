/**
 * Shared Tailwind class strings for form elements.
 * Import these instead of redefining inline — keeps styling consistent
 * and makes global updates (e.g. focus color, border radius) a one-line change.
 */

/** Full-width text/textarea input */
export const inputCls =
  "w-full rounded-md border border-neutral-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed";

/** Select or fixed-width date/filter input (no forced w-full — caller sets width) */
export const selectCls =
  "rounded-md border border-neutral-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 transition";

/** Compact select/input for filter panels and sidebars */
export const filterSelectCls =
  "w-full rounded-md border border-neutral-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs text-neutral-900 dark:text-neutral-100 outline-none focus:border-brand-600 focus:ring-1 focus:ring-brand-600 transition";

/** Form field label */
export const labelCls =
  "block text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5";

/** Helper/Description text */
export const helperCls = "mt-1.5 text-xs text-neutral-400 dark:text-neutral-500";

/** Shared tab styling for underlined header tabs */
export const tabCls = (active: boolean) =>
  [
    "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap",
    active
      ? "border-brand-500 text-neutral-900 dark:text-surface-50"
      : "border-transparent text-neutral-400 hover:text-neutral-700 dark:text-neutral-500 dark:hover:text-neutral-300",
  ].join(" ");

/** Choice cards (used in modals for selecting modes/options) */
export const choiceCardCls = (active: boolean) =>
  [
    "group flex flex-col p-4 rounded-md border transition text-left cursor-pointer transition-all duration-150",
    active
      ? "border-brand-500 ring-1 ring-brand-500 bg-neutral-50 dark:bg-surface-400 shadow-sm"
      : "border-neutral-200 dark:border-surface-400 hover:border-neutral-300 dark:hover:border-surface-300 bg-white dark:bg-surface-500 hover:bg-neutral-50 dark:hover:bg-surface-400",
  ].join(" ");
