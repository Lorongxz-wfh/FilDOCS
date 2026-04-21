import Skeleton from "./loader/Skeleton";

type Props = {
  label: string;
  value: number;
  loading?: boolean;
  valueClassName?: string;
};

export default function StatCard({
  label,
  value,
  loading,
  valueClassName = "",
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-5 px-4">
      <div
        className={["text-3xl font-semibold tabular-nums h-9 flex items-center", valueClassName].join(
          " ",
        )}
      >
        {loading ? <Skeleton className="h-8 w-14" /> : value}
      </div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  );
}
