import React from "react";

type DivProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ className = "", ...props }: DivProps) {
  return (
    <div
      {...props}
      className={[
        "rounded-md border border-slate-200 bg-white",
        "dark:border-surface-400 dark:bg-surface-500",
        className,
      ].join(" ")}
    />
  );
}

export function CardHeader({ className = "", ...props }: DivProps) {
  return (
    <div
      {...props}
      className={[
        "px-4 py-3 border-b border-slate-200",
        "dark:border-surface-400",
        className,
      ].join(" ")}
    />
  );
}

export function CardBody({ className = "", ...props }: DivProps) {
  return <div {...props} className={["px-4 py-3", className].join(" ")} />;
}

export function CardFooter({ className = "", ...props }: DivProps) {
  return (
    <div
      {...props}
      className={[
        "px-4 py-3 border-t border-slate-200",
        "dark:border-surface-400",
        className,
      ].join(" ")}
    />
  );
}
