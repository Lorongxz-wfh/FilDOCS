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
        "relative overflow-hidden rounded-md bg-slate-300/90 dark:bg-slate-700/80 shimmer-active opacity-100",
        className,
      ].join(" ")}
    />
  );
};

export default Skeleton;
