type Props = {
  title: string;
  subtitle?: string;
  onClick: () => void;
};

export default function DocListItem({ title, subtitle, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "block w-full rounded-md border border-slate-200 bg-white px-3 py-2.5 text-left text-sm transition",
        "hover:border-brand-300 hover:bg-brand-50",
        "dark:border-surface-400 dark:bg-surface-600 dark:text-slate-200",
        "dark:hover:border-brand-300 dark:hover:bg-surface-400",
      ].join(" ")}
    >
      <div className="font-medium truncate">{title}</div>
      {subtitle && (
        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {subtitle}
        </div>
      )}
    </button>
  );
}
