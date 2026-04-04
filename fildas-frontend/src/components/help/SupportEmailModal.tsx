import React, { useState, useRef } from "react";
import Button from "../ui/Button";
import api from "../../services/api";
import { useToast } from "../ui/toast/ToastContext";
import { X, Image as ImageIcon, Upload, Send } from "lucide-react";

interface SupportEmailModalProps {
  open: boolean;
  onClose: () => void;
  defaultSubject?: string;
  userEmail: string;
}

const SupportEmailModal: React.FC<SupportEmailModalProps> = ({
  open,
  onClose,
  defaultSubject = "",
  userEmail,
}) => {
  const { push } = useToast();
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (attachments.length + files.length > 5) {
      push({
        type: "error",
        title: "Limit Exceeded",
        message: "You can only attach up to 5 images.",
      });
      return;
    }

    // Filter for only images
    const images = files.filter(f => f.type.startsWith("image/"));
    if (images.length < files.length) {
       push({
        type: "warning",
        title: "Invalid Format",
        message: "Only image files (JPEG, PNG, etc.) are allowed.",
      });
    }

    if (images.length === 0) return;

    const newAttachments = [...attachments, ...images];
    setAttachments(newAttachments);

    const newPreviews = images.map((file) => URL.createObjectURL(file));
    setPreviews([...previews, ...newPreviews]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    const newAttachments = [...attachments];
    newAttachments.splice(index, 1);
    setAttachments(newAttachments);

    const newPreviews = [...previews];
    URL.revokeObjectURL(newPreviews[index]);
    newPreviews.splice(index, 1);
    setPreviews(newPreviews);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      push({
        type: "error",
        title: "Incomplete Form",
        message: "Please fill in both subject and message.",
      });
      return;
    }

    setSending(true);
    const formData = new FormData();
    formData.append("subject", subject.trim());
    formData.append("message", message.trim());
    formData.append("sender_email", userEmail);
    
    attachments.forEach((file) => {
      formData.append(`attachments[]`, file);
    });

    try {
      await api.post("/support/send", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      
      push({
        type: "success",
        title: "Email Sent",
        message: "Your support request has been submitted successfully.",
      });
      
      // Reset form and close
      setSubject("");
      setMessage("");
      setAttachments([]);
      setPreviews([]);
      onClose();
    } catch (error: any) {
      push({
        type: "error",
        title: "Sending Failed",
        message: error.response?.data?.message || "Failed to send support email. Please try again.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-surface-500 shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        style={{ maxHeight: 'calc(100vh - 2rem)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-surface-400 px-6 py-4 bg-slate-50/50 dark:bg-surface-600/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-500 text-white shadow-sm">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">
                Compose Support Email
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Sending to: IT Support & Administrators
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-surface-400 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g., Issue with document approval flow"
              className="w-full rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/50 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 transition-all placeholder:text-slate-400"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1">
              Message Detail
            </label>
            <textarea
              rows={8}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please provide as much detail as possible about the issue..."
              className="w-full rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/50 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 transition-all resize-none placeholder:text-slate-400 leading-relaxed"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between pl-1">
              <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                Attachments <span className={attachments.length === 5 ? "text-amber-500" : ""}>({attachments.length}/5)</span>
              </label>
              {attachments.length < 5 && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 text-xs font-bold text-brand-600 dark:text-brand-400 hover:text-brand-700 transition-colors"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Attach Image
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {previews.length > 0 ? (
              <div className="grid grid-cols-5 gap-3">
                {previews.map((url, i) => (
                  <div
                    key={url}
                    className="group relative aspect-square rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 overflow-hidden shadow-sm"
                  >
                    <img
                      src={url}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="p-1.5 rounded-full bg-rose-500 text-white shadow-lg transform hover:scale-110 transition-transform"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
                {[...Array(5 - previews.length)].map((_, i) => (
                   <div 
                    key={`empty-${i}`}
                    onClick={() => attachments.length < 5 && fileInputRef.current?.click()}
                    className="aspect-square rounded-xl border border-dashed border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/30 flex items-center justify-center text-slate-300 dark:text-surface-300 cursor-pointer hover:bg-slate-50/50 transition-colors"
                   >
                     <ImageIcon className="h-5 w-5" />
                   </div>
                ))}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center py-10 rounded-2xl border-2 border-dashed border-slate-200 dark:border-surface-400 bg-slate-50/30 dark:bg-surface-600/30 cursor-pointer hover:bg-slate-50/50 hover:border-brand-300 transition-all group"
              >
                <div className="p-3 rounded-full bg-white dark:bg-surface-400 shadow-sm border border-slate-100 dark:border-surface-300 mb-3 group-hover:scale-110 transition-transform">
                  <Upload className="h-6 w-6 text-brand-500" />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">
                  Upload issue screenshots
                </span>
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Select up to 5 images (PNG, JPG, JPEG)
                </span>
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="border-t border-slate-100 dark:border-surface-400 px-6 py-4 bg-slate-50/50 dark:bg-surface-600/50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-400 rounded-xl transition-all"
          >
            Cancel
          </button>
          <Button
            type="submit"
            variant="primary"
            className="px-8 py-2.5 rounded-xl shadow-lg shadow-brand-500/20 font-bold"
            loading={sending}
            onClick={(e) => {
               // Programmatically trigger form submit since button is in footer
               const form = (e.currentTarget as any).closest('div').parentElement.querySelector('form');
               form?.requestSubmit();
            }}
          >
            Send Support Email
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SupportEmailModal;
