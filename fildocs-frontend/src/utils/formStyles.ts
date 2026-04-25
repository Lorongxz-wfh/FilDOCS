/**
 * Shared Tailwind class strings for form elements.
 * Import these instead of redefining inline — keeps styling consistent
 * and makes global updates (e.g. focus color, border radius) a one-line change.
 */

/** Full-width text/textarea input */
export const inputCls =
  "w-full rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed";

/** Select or fixed-width date/filter input (no forced w-full — caller sets width) */
export const selectCls =
  "rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition";

/** Compact select/input for filter panels and sidebars */
export const filterSelectCls =
  "w-full rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/20 transition";

/** Form field label */
export const labelCls =
  "block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2";

/** Helper/Description text */
export const helperCls = "mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500 italic";

/** Shared tab styling for underlined header tabs */
export const tabCls = (active: boolean) =>
  [
    "flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap",
    active
      ? "border-brand-500 text-slate-900 dark:text-surface-50"
      : "border-transparent text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300",
  ].join(" ");

/** Choice cards (used in modals for selecting modes/options) */
export const choiceCardCls = (active: boolean) =>
  [
    "group flex flex-col p-4 rounded-md border transition text-left cursor-pointer transition-all duration-200 active:scale-[0.98]",
    active
      ? "border-brand-500 ring-1 ring-brand-500/10 bg-slate-50 dark:bg-surface-400/20 shadow-sm"
      : "border-slate-200 dark:border-surface-400 hover:border-slate-300 dark:hover:border-surface-300 bg-white dark:bg-surface-500 hover:bg-slate-50 dark:hover:bg-surface-400",
  ].join(" ");
