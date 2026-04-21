import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import logoUrl from "../../assets/FCU Logo.png";
import { Sun, Moon, Lock, CheckCircle2, ArrowLeft, AlertCircle } from "lucide-react";
import { useTheme } from "../../hooks/useTheme";
import FormField from "../../components/ui/FormField";
import api from "../../services/api";
import { PasswordRequirements, validatePassword } from "../../components/auth/PasswordRequirements";

const ResetPasswordPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";
  const email = searchParams.get("email") || "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(4);
  const { theme, toggle: toggleDark } = useTheme();

  const passwordValid = validatePassword(password);
  const passwordsMatch =
    passwordValid &&
    passwordConfirmation.length > 0 &&
    password === passwordConfirmation;
  const passwordsMismatch =
    passwordConfirmation.length > 0 && password !== passwordConfirmation;

  const missingParams = !token || !email;

  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate("/login", { replace: true });
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid || passwordsMismatch) return;
    setError(null);
    setLoading(true);
    try {
      await api.post("/reset-password", {
        token,
        email,
        password,
        password_confirmation: passwordConfirmation,
      });
      setSuccess(true);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        "Failed to reset password. The link may have expired.";
      setError(msg);
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

      <div className="relative z-10 w-full max-w-sm mx-auto px-4 py-10">
        <div className="rounded-3xl bg-white dark:bg-surface-500 shadow-2xl px-10 py-12">
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="h-14 w-14 overflow-hidden rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600">
              <img
                src={logoUrl}
                alt="FCU Logo"
                className="h-full w-full object-contain p-2"
              />
            </div>
          </div>

          {missingParams ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 dark:bg-rose-950/40">
                <AlertCircle className="h-6 w-6 text-rose-500 dark:text-rose-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Invalid Reset Link
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  This password reset link is invalid or incomplete. Please request a new one.
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="w-full py-2.5 rounded-md bg-brand-400 hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400 text-sm font-semibold text-white transition text-center block"
              >
                Request New Link
              </Link>
              <Link
                to="/login"
                className="flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Sign In
              </Link>
            </div>
          ) : success ? (
            <div className="flex flex-col items-center text-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950/40">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
                  Password Reset
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                  Your password has been reset successfully. You'll be redirected
                  to the login page in{" "}
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {countdown}s
                  </span>.
                </p>
              </div>
              <Link
                to="/login"
                className="w-full py-2.5 rounded-md bg-brand-400 hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400 text-sm font-semibold text-white transition text-center block"
              >
                Sign In Now
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-[1.6rem] font-semibold tracking-tight text-slate-900 dark:text-slate-100 text-center">
                Set New Password
              </h2>
              <p className="mt-1 text-sm text-slate-400 dark:text-slate-400 text-center">
                Enter a new password for{" "}
                <span className="font-semibold text-slate-600 dark:text-slate-300">
                  {email}
                </span>
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                <FormField
                  label="New Password"
                  isPassword
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  isRequired
                  icon={Lock}
                  hint="Password requires uppercase, numbers, and symbols."
                  error={password.length > 0 && !passwordValid ? "Please meet all complexity requirements." : undefined}
                  isValid={passwordValid}
                />

                {password && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <PasswordRequirements password={password} />
                  </div>
                )}

                <FormField
                  label="Confirm Password"
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
                  className="w-full py-2.5 rounded-md bg-brand-400 hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  to="/login"
                  className="flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default ResetPasswordPage;
