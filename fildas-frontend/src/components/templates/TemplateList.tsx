import React from "react";
import type { DocumentTemplate } from "../../services/templates";
import TemplateCard from "./TemplateCard";
import SkeletonList from "../ui/loader/SkeletonList";

type Props = {
  templates: DocumentTemplate[];
  loading: boolean;
  deletingId: number | null;
  onDeleteClick: (id: number) => void;
  onSelect: (template: DocumentTemplate) => void;
};

const TemplateList: React.FC<Props> = ({
  templates,
  loading,
  deletingId,
  onDeleteClick,
  onSelect,
}) => {
  if (loading) {
    return <SkeletonList rows={5} rowClassName="h-16 rounded-xl" />;
  }

  if (templates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          No templates match your filters.
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Try adjusting your search or filters.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {templates.map((t) => (
        <TemplateCard
          key={t.id}
          template={t}
          isDeleting={deletingId === t.id}
          onDeleteClick={onDeleteClick}
          onDeleted={() => {}}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
};

export default TemplateList;
