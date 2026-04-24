import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import logoUrl from "../../assets/FCU Logo.png";
import { Lock, LogOut, Sun, Moon } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import FormField from "../../components/ui/FormField";
import api from "../../services/api";
import { PasswordRequirements, validatePassword } from "../../components/auth/PasswordRequirements";
import { useToast } from "../../components/ui/toast/ToastContext";
import { clearAuth, getAuthUser } from "../../lib/auth";

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
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/login_bg.png)" }}
      />
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

      <button
        type="button"
        onClick={toggleDark}
        className="absolute top-4 right-4 z-20 flex items-center justify-center h-8 w-8 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition"
      >
        {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      <div className="relative z-10 w-full max-w-md mx-auto px-4 py-10">
        <div className="rounded-lg bg-white dark:bg-surface-500 border border-slate-200 dark:border-surface-400 shadow-xl shadow-slate-900/5 px-10 py-12 flex flex-col">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600">
              <img src={logoUrl} alt="FCU Logo" className="h-full w-full object-contain p-2" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h2 className="text-[1.6rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              Set New Password
            </h2>
            <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
              For <span className="font-semibold text-slate-600 dark:text-slate-300">{user?.email}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField
              label="New Secure Password"
              isPassword
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              isRequired
              icon={Lock}
              error={password.length > 0 && !passwordValid ? "Policy requirements not met" : undefined}
              isValid={passwordValid}
            />

            <PasswordRequirements password={password} />

            <FormField
              label="Confirm New Password"
              isPassword
              autoComplete="new-password"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              required
              isRequired
              icon={Lock}
              error={passwordsMismatch ? "Passwords do not match." : undefined}
              isValid={passwordsMatch}
            />

            {error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passwordValid || passwordsMismatch || !password || !passwordConfirmation}
              className="w-full py-2.5 rounded-md bg-brand-400 hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400 text-sm font-semibold text-white transition disabled:opacity-50 mt-2"
            >
              {loading ? "Hardening..." : "Update & Continue"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition mx-auto"
            >
              <LogOut className="h-3 w-3" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ForcePasswordChangePage;
