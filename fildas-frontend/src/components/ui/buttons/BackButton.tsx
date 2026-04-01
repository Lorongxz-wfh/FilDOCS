import Tooltip from "../Tooltip";

type Props = {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
};

export default function BackButton({
  onClick,
  disabled = false,
  label = "Back",
}: Props) {
  return (
    <Tooltip content={label}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:text-slate-500 dark:hover:bg-surface-400 dark:hover:text-slate-200 transition"
        aria-label={label}
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
      </button>
    </Tooltip>
  );
}
