import React from "react";

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

const Skeleton: React.FC<Props> = ({ className = "", style }) => {
  return (
    <div
      style={style}
      className={[
        "animate-pulse rounded-md bg-slate-100 border border-slate-200/50 dark:bg-surface-400/30 dark:border-surface-400",
        className,
      ].join(" ")}
    />
  );
};

export default Skeleton;
