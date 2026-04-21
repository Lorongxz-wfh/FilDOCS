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
        "relative overflow-hidden rounded-md bg-slate-200/50 dark:bg-surface-400 shimmer-active",
        className,
      ].join(" ")}
    />
  );
};

export default Skeleton;
