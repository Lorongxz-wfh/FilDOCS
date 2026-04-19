import React, { useState } from "react";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Alert from "../ui/Alert";
import { ShieldCheck, Lock, Smartphone } from "lucide-react";
import { verifySecurity } from "../../services/trashApi";
import { getAuthUser } from "../../lib/auth";
import { inputCls } from "../../utils/formStyles";

interface SecurityVerificationModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: (password: string, code?: string) => void;
  title?: string;
  description?: string;
  actionLabel?: string;
}

const SecurityVerificationModal: React.FC<SecurityVerificationModalProps> = ({
  open,
  onClose,
  onVerified,
  title = "Security Verification",
  description = "This is a high-impact administrative action. Please verify your identity to proceed.",
  actionLabel = "Confirm Action",
}) => {
  const me = getAuthUser();
  const has2fa = !!me?.two_factor_enabled;

  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await verifySecurity(password, code || undefined);
      onVerified(password, code || undefined);
      onClose();
      // Reset state for next time
      setPassword("");
      setCode("");
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} widthClassName="max-w-md">
      <form onSubmit={handleVerify} className="p-5 space-y-5">
        <div className="flex items-start gap-4 p-4 rounded-lg bg-orange-50 dark:bg-orange-950/20 border border-orange-100 dark:border-orange-900/30">
          <div className="shrink-0 p-2 rounded-full bg-white dark:bg-surface-600 ">
            <ShieldCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold text-orange-900 dark:text-orange-200">Sensitive Action</p>
            <p className="text-xs text-orange-700 dark:text-orange-300 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
              Account Password
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock size={14} />
              </div>
              <input
                type="password"
                required
                autoFocus
                placeholder="Enter your current password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className={`${inputCls} pl-9`}
              />
            </div>
          </div>

          {has2fa && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                2FA Verification Code
              </label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Smartphone size={14} />
                </div>
                <input
                  type="text"
                  required
                  placeholder="6-digit code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCode(e.target.value.replace(/[^0-9]/g, ""))}
                  className={`${inputCls} pl-9`}
                />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="button" variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" className="flex-1" loading={loading}>
            {actionLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SecurityVerificationModal;
