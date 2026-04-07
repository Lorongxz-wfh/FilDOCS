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
        "animate-pulse relative overflow-hidden rounded-sm bg-sky-100/20 dark:bg-sky-950/15",
        className,
      ].join(" ")}
    />
  );
};

export default Skeleton;
