import React, { useState } from "react";
import { Globe, Building2 } from "lucide-react";
import { uploadTemplate, type DocumentTemplate } from "../../services/templates";
import { useToast } from "../ui/toast/ToastContext";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import { inputCls, labelCls } from "../../utils/formStyles";

type Props = {
  onUploaded: (template: DocumentTemplate) => void;
  canChooseScope?: boolean;
};

const ALLOWED_EXT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx";
const MAX_MB = 20;

const TemplateUploadForm: React.FC<Props> = ({ onUploaded, canChooseScope = false }) => {
  const { push } = useToast();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setFile(null);
    setIsGlobal(false);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Name is required."); return; }
    if (!file) { setError("Please select a file."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`File must be under ${MAX_MB} MB.`); return; }

    setLoading(true);
    try {
      const template = await uploadTemplate({
        name,
        description,
        file,
        ...(canChooseScope ? { is_global: isGlobal } : {}),
      });
      push({ type: "success", title: "Template uploaded", message: template.name });
      onUploaded(template);
      reset();
    } catch (e: any) {
      setError(e?.message ?? "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}

      {/* Name */}
      <div>
        <label className={labelCls}>
          Template name <span className="text-rose-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Leave Request Form"
          disabled={loading}
          className={inputCls}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelCls}>Description</label>
        <textarea
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description (optional)"
          disabled={loading}
          className={`${inputCls} resize-none`}
        />
      </div>

      {/* File */}
      <div>
        <label className={labelCls}>
          File <span className="text-rose-500">*</span>
        </label>
        <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-500">
          PDF, Word, Excel, or PowerPoint — max {MAX_MB} MB
        </p>
        <input
          type="file"
          accept={ALLOWED_EXT}
          disabled={loading}
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-700 dark:text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 dark:file:bg-surface-500 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-600 dark:file:text-slate-300 hover:file:bg-slate-200 dark:hover:file:bg-surface-400 disabled:opacity-50 transition"
        />
        {file && (
          <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            {file.name} &mdash; {(file.size / 1024).toFixed(0)} KB
          </p>
        )}
      </div>

      {/* Visibility scope — QA / sysadmin only */}
      {canChooseScope && (
        <div>
          <label className={labelCls}>Visibility</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsGlobal(false)}
              disabled={loading}
              className={[
                "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition",
                !isGlobal
                  ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/30 dark:text-brand-400"
                  : "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-500",
              ].join(" ")}
            >
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span>My office only</span>
            </button>
            <button
              type="button"
              onClick={() => setIsGlobal(true)}
              disabled={loading}
              className={[
                "flex flex-1 items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition",
                isGlobal
                  ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-600 dark:bg-brand-950/30 dark:text-brand-400"
                  : "border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-surface-500",
              ].join(" ")}
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              <span>All offices</span>
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={reset} disabled={loading}>
          Clear
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={loading}>
          {loading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
};

export default TemplateUploadForm;
