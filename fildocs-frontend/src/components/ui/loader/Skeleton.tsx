import React from "react";
import { motion } from "framer-motion";

type Props = {
  className?: string;
  style?: React.CSSProperties;
};

const Skeleton: React.FC<Props> = ({ className = "", style }) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      style={style}
      className={[
        "relative overflow-hidden rounded-md bg-slate-300/90 dark:bg-slate-600/80 shimmer-active",
        className,
      ].join(" ")}
    />
  );
};

export default Skeleton;
