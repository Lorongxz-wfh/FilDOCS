import React, { useState } from "react";
import { 
  ShieldCheck, 
  ShieldAlert, 
  Smartphone, 
  Key, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  RefreshCw,
  Trash2
} from "lucide-react";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import FormField from "../ui/FormField";
import { useToast } from "../ui/toast/ToastContext";
import { 
  setupTwoFactor, 
  confirmTwoFactor, 
  disableTwoFactor,
  getRecoveryCodes 
} from "../../services/profile";
import { normalizeError } from "../../lib/normalizeError";

interface TwoFactorManagerProps {
  user: any;
}

export const TwoFactorManager: React.FC<TwoFactorManagerProps> = ({ user }) => {
  const { push } = useToast();
  const [isEnabled, setIsEnabled] = useState(!!user?.two_factor_enabled);
  
  // Modals
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);

  // Setup state
  const [setupData, setSetupData] = useState<{ secret: string; qr_image: string; qr_url: string } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [showRecoveryNow, setShowRecoveryNow] = useState(false);

  // Disable state
  const [password, setPassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [disableIsRecovery, setDisableIsRecovery] = useState(false);

  const handleStartSetup = async () => {
    setLoading(true);
    try {
      const data = await setupTwoFactor();
      setSetupData(data);
      setIsSetupModalOpen(true);
    } catch (err) {
      push({ type: "error", title: "Setup Failed", message: normalizeError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmSetup = async () => {
    if (!setupData) return;
    setLoading(true);
    try {
      const res = await confirmTwoFactor({
        secret: setupData.secret,
        code: confirmCode
      });
      setRecoveryCodes(res.recovery_codes);
      setShowRecoveryNow(true);
      setIsEnabled(true);
      
      // Update local storage user
      const localUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
      localStorage.setItem("auth_user", JSON.stringify({ ...localUser, two_factor_enabled: true }));
      window.dispatchEvent(new Event("auth_user_updated"));

      push({ type: "success", title: "Enabled", message: "Two-factor authentication is now active." });
    } catch (err) {
      push({ type: "error", title: "Verification Failed", message: normalizeError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    setLoading(true);
    try {
      await disableTwoFactor({
        password,
        [disableIsRecovery ? "recovery_code" : "code"]: disableCode
      });
      setIsEnabled(false);
      setIsDisableModalOpen(false);
      setPassword("");
      setDisableCode("");
      
      const localUser = JSON.parse(localStorage.getItem("auth_user") || "{}");
      localStorage.setItem("auth_user", JSON.stringify({ ...localUser, two_factor_enabled: false }));
      window.dispatchEvent(new Event("auth_user_updated"));
      
      push({ type: "success", title: "Disabled", message: "Two-factor authentication has been turned off." });
    } catch (err) {
      push({ type: "error", title: "Action Failed", message: normalizeError(err) });
    } finally {
      setLoading(false);
    }
  };

  const handleViewRecovery = async (confirmPassword: string) => {
    setLoading(true);
    try {
      const codes = await getRecoveryCodes(confirmPassword);
      setRecoveryCodes(codes);
      setIsRecoveryModalOpen(true);
    } catch (err) {
      push({ type: "error", title: "Verification Failed", message: normalizeError(err) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Status Banner ─────────────────────────────────────────────────── */}
      <div className={`p-5 rounded-md border flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-colors ${
        isEnabled 
          ? "border-emerald-100 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/20" 
          : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500"
      }`}>
        <div className={`h-12 w-12 rounded-full flex items-center justify-center shrink-0 ${
          isEnabled ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50" : "bg-slate-100 text-slate-400 dark:bg-surface-400"
        }`}>
          {isEnabled ? <ShieldCheck className="h-6 w-6" /> : <ShieldAlert className="h-6 w-6" />}
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
            {isEnabled ? "Two-Factor Authentication is active" : "Secure your account with 2FA"}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-lg leading-relaxed">
            {isEnabled 
              ? "Your account is protected by an additional verification layer. You will be prompted for a 6-digit code from your authenticator app when signing in."
              : "Enhance your account security by requiring a verification code when logging in. This protects your account even if your password is stolen."}
          </p>
        </div>

        <div className="shrink-0 flex gap-2">
          {isEnabled ? (
            <Button variant="ghost" size="sm" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50" onClick={() => setIsDisableModalOpen(true)}>
              Disable
            </Button>
          ) : (
            <Button size="sm" onClick={handleStartSetup} loading={loading}>
                Enable 2FA
            </Button>
          )}
        </div>
      </div>

      {isEnabled && (
          <div className="flex flex-wrap gap-3 pl-2">
             <button 
               onClick={() => {
                   // For simplicity here, we'll just show the modal and let the user enter their password
                   setIsRecoveryModalOpen(true);
                   setRecoveryCodes([]); // Reset to force re-auth in UX
               }}
               className="text-[11px] font-bold uppercase tracking-wider text-slate-400 hover:text-brand-500 flex items-center gap-1.5 transition-colors"
             >
                <Key className="h-3 w-3" />
                View Recovery Codes
             </button>
          </div>
      )}

      {/* ── Setup Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={isSetupModalOpen}
        onClose={() => !loading && !showRecoveryNow && setIsSetupModalOpen(false)}
        title={showRecoveryNow ? "Recovery Codes Saved" : "Setup Authenticator App"}
        widthClassName="max-w-md"
      >
        {!showRecoveryNow ? (
          <div className="space-y-6">
            <div className="flex gap-4">
               <div className="h-10 w-10 rounded bg-brand-50 dark:bg-brand-500/10 flex items-center justify-center shrink-0">
                  <Smartphone className="h-5 w-5 text-brand-600 dark:text-brand-400" />
               </div>
               <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">1. Scan the QR Code</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Scan this image with your authenticator app (e.g., Google Authenticator, Authy).</p>
               </div>
            </div>

            <div className="flex justify-center bg-white p-4 sm:p-6 rounded-lg border border-slate-100 dark:border-surface-400">
               {setupData?.qr_image ? (
                 <div className="relative w-full max-w-[160px] sm:max-w-[200px] aspect-square mx-auto">
                    <img src={setupData.qr_image} alt="2FA QR Code" className="w-full h-full object-contain" />
                 </div>
               ) : (
                 <div className="w-full max-w-[160px] sm:max-w-[200px] aspect-square bg-slate-50 dark:bg-surface-400 animate-pulse rounded flex items-center justify-center mx-auto">
                    <RefreshCw className="h-6 w-6 text-slate-200 dark:text-slate-100 opacity-20 animate-spin" />
                 </div>
               )}
            </div>

            <div className="bg-slate-50 dark:bg-surface-400/20 p-3 rounded-md border border-slate-100 dark:border-surface-400 space-y-2">
                <p className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider text-center">Or enter manually</p>
                <div className="flex items-center justify-center gap-2">
                   <code className="text-xs sm:text-sm font-mono font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-surface-500 px-2.5 py-1 rounded shadow-sm break-all text-center border border-slate-100 dark:border-surface-400">
                      {setupData?.secret.match(/.{1,4}/g)?.join(' ') || "..."}
                   </code>
                   <button 
                     className="p-1 hover:bg-slate-200 dark:hover:bg-surface-400 rounded text-slate-400 transition shrink-0"
                     onClick={() => {
                        navigator.clipboard.writeText(setupData?.secret || "");
                        push({ type: "success", message: "Secret copied to clipboard." });
                     }}
                   >
                      <Copy className="h-3.5 w-3.5" />
                   </button>
                </div>
            </div>

            <div className="space-y-3 pt-2">
               <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">2. Verification Code</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Enter the 6-digit code shown in your app to confirm.</p>
               </div>
               <input 
                 className="w-full text-center text-xl sm:text-2xl font-mono tracking-[0.3em] sm:tracking-[0.5em] h-12 sm:h-14 rounded-md bg-white dark:bg-surface-500 border-slate-200 dark:border-surface-400 text-slate-800 dark:text-slate-100 focus:border-brand-500 focus:ring-brand-500/20"
                 placeholder="000000"
                 maxLength={6}
                 value={confirmCode}
                 onChange={e => setConfirmCode(e.target.value.replace(/[^0-9]/g, ""))}
               />
               <Button 
                 className="w-full" 
                 loading={loading} 
                 disabled={confirmCode.length !== 6}
                 onClick={handleConfirmSetup}
               >
                  Verify and Activate
               </Button>
            </div>
          </div>
        ) : (
           <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 p-3 rounded-md border border-emerald-100 dark:border-emerald-500/20">
                 <CheckCircle2 className="h-5 w-5" />
                 <p className="text-xs font-bold uppercase tracking-wider">Setup Complete</p>
              </div>

              <div className="space-y-3">
                 <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Store these recovery codes in a secure place. If you lose access to your authenticator app, these are the **only way** to regain access to your account.
                 </p>

                 <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-surface-400/20 p-4 rounded-md border border-slate-100 dark:border-surface-400 font-mono text-[11px] font-bold text-slate-600 dark:text-slate-300">
                    {recoveryCodes.map(c => (
                      <div key={c} className="bg-white dark:bg-surface-500 p-1.5 px-2 rounded shadow-sm border border-slate-100 dark:border-surface-400">
                        {c}
                      </div>
                    ))}
                 </div>
              </div>

              <div className="flex gap-3">
                 <Button 
                   variant="outline" 
                   className="flex-1" 
                   onClick={() => {
                     const text = recoveryCodes.join("\n");
                     navigator.clipboard.writeText(text);
                     push({ type: "success", message: "Codes copied to clipboard." });
                   }}
                 >
                    Copy Codes
                 </Button>
                 <Button 
                   className="flex-1" 
                   onClick={() => {
                     setIsSetupModalOpen(false);
                     setShowRecoveryNow(false);
                   }}
                 >
                    Done
                 </Button>
              </div>
           </div>
        )}
      </Modal>

      {/* ── Recovery View Modal ───────────────────────────────────────────── */}
      <Modal
        open={isRecoveryModalOpen}
        onClose={() => setIsRecoveryModalOpen(false)}
        title="Recovery Codes"
        widthClassName="max-w-md"
      >
        {recoveryCodes.length === 0 ? (
          <div className="space-y-5">
             <div className="p-3 bg-amber-50 border border-amber-100 rounded text-amber-700 space-y-1">
                <div className="flex items-center gap-2">
                   <AlertCircle className="h-4 w-4" />
                   <p className="text-xs font-bold uppercase tracking-wider">Security Check</p>
                </div>
                <p className="text-[11px]">Please enter your password to view your recovery codes.</p>
             </div>
             <FormField 
                label="Account Password" 
                isPassword 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Confirm your password"
             />
             <Button 
               className="w-full" 
               loading={loading}
               onClick={() => handleViewRecovery(password)}
             >
                Verify Password
             </Button>
          </div>
        ) : (
          <div className="space-y-5">
             <div className="grid grid-cols-2 gap-2 bg-slate-50 p-4 rounded-md border border-slate-100 font-mono text-[11px] font-bold text-slate-600">
                {recoveryCodes.map(c => (
                  <div key={c} className="bg-white p-1.5 px-2 rounded shadow-sm border border-slate-100">
                    {c}
                  </div>
                ))}
             </div>
             <Button 
               variant="outline" 
               className="w-full"
               onClick={() => {
                 const text = recoveryCodes.join("\n");
                 navigator.clipboard.writeText(text);
                 push({ type: "success", message: "Codes copied to clipboard." });
               }}
             >
                Copy to Clipboard
             </Button>
          </div>
        )}
      </Modal>

      {/* ── Disable Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={isDisableModalOpen}
        onClose={() => setIsDisableModalOpen(false)}
        title="Disable Two-Factor Authentication"
        widthClassName="max-w-md"
        footer={
          <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
             <Button variant="ghost" onClick={() => setIsDisableModalOpen(false)}>Cancel</Button>
             <Button 
               variant="danger" 
               loading={loading} 
               onClick={handleDisable}
               disabled={!password}
             >
                Disable 2FA
             </Button>
          </div>
        }
      >
        <div className="space-y-6">
           <div className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700 flex gap-3">
              <Trash2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="space-y-1">
                 <p className="text-xs font-bold uppercase tracking-wider">Warning</p>
                 <p className="text-[11px] leading-relaxed">Disabling two-factor authentication makes your account less secure. You will only need your password to log in.</p>
              </div>
           </div>

           <div className="space-y-4">
              <FormField 
                 label="Confirm Password" 
                 isPassword 
                 value={password}
                 onChange={e => setPassword(e.target.value)}
                 placeholder="Enter password to confirm"
                 hint="You must verify your identity to disable 2FA."
              />

              <div className="pt-2 border-t border-slate-100 space-y-4">
                <FormField 
                  label={disableIsRecovery ? "Recovery Code" : "Verification Code"}
                  type="text"
                  placeholder={disableIsRecovery ? "XXXXX-XXXXX" : "000 000"}
                  value={disableCode}
                  onChange={e => setDisableCode(e.target.value)}
                  icon={disableIsRecovery ? Key : CheckCircle2}
                  maxLength={disableIsRecovery ? 21 : 6}
                />
                
                <button
                  type="button"
                  onClick={() => {
                    setDisableIsRecovery(!disableIsRecovery);
                    setDisableCode("");
                  }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition"
                >
                  {disableIsRecovery ? "Use authenticator app code instead" : "Can't access your app? Use a recovery code"}
                </button>
              </div>
           </div>
        </div>
      </Modal>
    </div>
  );
};
