import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoUrl from "../assets/FCU Logo.png";
import { Lock, ShieldAlert, LogOut, ArrowRight, Sun, Moon } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import FormField from "../components/ui/FormField";
import api from "../services/api";
import { PasswordRequirements, validatePassword } from "../components/auth/PasswordRequirements";
import { useToast } from "../components/ui/toast/ToastContext";
import { clearAuth, getAuthUser } from "../lib/auth";

const ForcePasswordChangePage: React.FC = () => {
  const navigate = useNavigate();
  const { push } = useToast();
  const { theme, toggle: toggleDark } = useTheme();
  const user = getAuthUser();

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordValid = validatePassword(password);
  const passwordsMatch = passwordValid && passwordConfirmation.length > 0 && password === passwordConfirmation;
  const passwordsMismatch = passwordConfirmation.length > 0 && password !== passwordConfirmation;

  useEffect(() => {
    // If user is not logged in or doesn't need to change password (checked on login),
    // they shouldn't be here. But since the login page redirects here, 
    // we trust the initial state. If they reload, we might need to check.
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  const handleLogout = () => {
    clearAuth();
    navigate("/login", { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) {
      setError("Please meet all password complexity requirements.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await api.post("/profile/password", {
        password,
        password_confirmation: passwordConfirmation,
      });
      
      push({
        type: "success",
        title: "Security Updated",
        message: "Your password has been hardened. You can now access the system."
      });
      
      // Update local storage flag so they don't get redirected here again
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem("auth_user", JSON.stringify({ ...parsed, must_change_password: false }));
      }
      
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-900">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{ backgroundImage: "url(/login_bg.png)" }}
      />
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      <button
        type="button"
        onClick={toggleDark}
        className="absolute top-4 right-4 z-20 flex items-center justify-center h-8 w-8 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-10">
        <div className="rounded-2xl bg-white dark:bg-surface-500 shadow-2xl border border-slate-200 dark:border-surface-400 overflow-hidden">
          {/* Header Banner */}
          <div className="bg-amber-500 px-6 py-4 flex items-center gap-3">
             <div className="bg-white/20 p-2 rounded-lg">
                <ShieldAlert className="h-5 w-5 text-white" />
             </div>
             <div>
                <h1 className="text-white font-bold text-sm leading-tight">Security Hardening Required</h1>
                <p className="text-white/80 text-[11px]">Institution policy update: Your password must be modernized.</p>
             </div>
          </div>

          <div className="px-8 pt-8 pb-10">
            {/* Logo */}
            <div className="flex items-center justify-center mb-8">
              <div className="h-14 w-14 overflow-hidden rounded-lg border border-slate-100 dark:border-surface-400 bg-white dark:bg-surface-600 shadow-sm">
                <img src={logoUrl} alt="FCU Logo" className="h-full w-full object-contain p-2" />
              </div>
            </div>

            <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 italic tracking-tight uppercase">Modernize Credentials</h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Account: <span className="font-bold text-slate-700 dark:text-slate-200">{user?.email}</span>
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <FormField
                label="New Secure Password"
                isPassword
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                icon={Lock}
                error={password.length > 0 && !passwordValid ? "Policy requirements not met" : undefined}
                isValid={passwordValid}
              />

              {password && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <PasswordRequirements password={password} />
                </div>
              )}

              <FormField
                label="Confirm New Password"
                isPassword
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
                icon={Lock}
                error={passwordsMismatch ? "Passwords do not match" : undefined}
                isValid={passwordsMatch}
              />

              {error && (
                <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-4 py-3 text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={loading || !passwordValid || passwordsMismatch}
                  className="group w-full py-2.5 rounded-md bg-slate-900 dark:bg-brand-400 hover:bg-slate-800 dark:hover:bg-brand-500 text-sm font-bold text-white transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? "Hardening..." : (
                    <>
                      Update & Continue
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Sign Out
                </button>
              </div>
            </form>
          </div>
          
          <div className="bg-slate-50 dark:bg-surface-600 px-8 py-4 border-t border-slate-100 dark:border-surface-400">
             <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center uppercase tracking-widest font-bold">FilDAS Institutional Security</p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ForcePasswordChangePage;
