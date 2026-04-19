import React from "react";
import { Pencil, Check, X } from "lucide-react";

interface InlineEditFieldProps {
  value: string;
  onSave: (v: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  onSave,
  placeholder,
  className,
}) => {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value);
  const [saving, setSaving] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setDraft(value);
  }, [value]);

  React.useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const save = async () => {
    if (!draft.trim() || draft.trim() === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch {
      /* keep editing open on error */
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`group flex items-center gap-1.5 text-left hover:opacity-80 transition ${className ?? ""}`}
      >
        <span>{value || placeholder}</span>
        <Pencil className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition shrink-0" />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-1">
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
        disabled={saving}
        className="flex-1 rounded-md border border-sky-400 bg-white dark:bg-surface-600 px-2 py-1 text-sm font-semibold text-slate-900 dark:text-slate-100 outline-none transition disabled:opacity-50"
      />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition disabled:opacity-40"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(false);
        }}
        className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 transition"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default InlineEditField;
