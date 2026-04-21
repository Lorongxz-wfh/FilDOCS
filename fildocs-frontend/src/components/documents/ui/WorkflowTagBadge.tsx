import React from "react";

interface TagBadgeProps {
  name: string;
  className?: string;
}

const TagBadge: React.FC<TagBadgeProps> = ({ name, className = "" }) => {
  // Generate a consistent, high-contrast, professional-looking color based on name
  const getTagColors = (text: string) => {
    const tagName = text.toLowerCase().trim();
    
    // Explicit mappings for common status/critical tags
    if (tagName === "urgent" || tagName === "critical") return { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" };
    if (tagName === "confidential") return { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" };
    if (tagName === "internal") return { bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" };
    if (tagName === "external") return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    if (tagName === "form" || tagName === "forms") return { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" };
    
    // Hash-based color for dynamic tags (sticking to professional slates/blues)
    const colors = [
      { bg: "bg-slate-50", text: "text-slate-700", border: "border-slate-200" },
      { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
      { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
      { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200" },
    ];
    
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = text.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const { bg, text, border } = getTagColors(name);

  return (
    <span 
      className={[
        "inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase tracking-wider transition-all duration-200 select-none whitespace-nowrap",
        bg,
        text,
        border,
        "dark:bg-surface-400/20 dark:border-white/10 dark:text-neutral-300",
        className
      ].join(" ")}
      title={name}
    >
      {name}
    </span>
  );
};

export default TagBadge;
