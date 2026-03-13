import React from "react";

import BackButton from "./buttons/BackButton";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  onBackDisabled?: boolean;
  className?: string;
};

export default function PageHeading({
  title,
  subtitle,
  right,
  onBack,
  onBackDisabled,
  className = "",
}: Props) {
  return (
    <div
      className={[
        "flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 min-w-0",
        className,
      ].join(" ")}
    >
      <div className="flex items-center gap-2 min-w-0">
        {onBack && <BackButton onClick={onBack} disabled={onBackDisabled} />}
        <div className="min-w-0">
          <h1 className="text-base font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {title}
          </h1>
          {subtitle && (
            <div className="mt-0.5 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {right && (
        <div className="flex items-center gap-2 overflow-x-auto pb-0.5 sm:pb-0 sm:flex-wrap sm:shrink-0">
          {right}
        </div>
      )}
    </div>
  );
}
