import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { setAuthUser } from "../../lib/auth";
import logoUrl from "../../assets/FCU Logo.png";
import { CheckCircle2, Sun, Moon, Mail, Lock, AlertCircle, X } from "lucide-react";
import { useThemeContext } from "../../lib/ThemeContext";
import FormField from "../../components/ui/FormField";
import api from "../../services/api";
import { useSearchParams } from "react-router-dom";

import MaintenanceBanner from "../../components/layout/MaintenanceBanner";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isInactiveLogout = searchParams.get("inactive") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isResendingEmail, setIsResendingEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { theme, toggle: toggleDark, setTheme } = useThemeContext();

  // 2FA Challenge States
  const [showChallenge, setShowChallenge] = useState(false);
  const [challengeId, setChallengeId] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [code, setCode] = useState("");
  const resendTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Recovery timer from localStorage
  React.useEffect(() => {
    const resendUntil = localStorage.getItem("fildocs_resend_2fa_until");
    if (resendUntil) {
      const remaining = Math.round((Number(resendUntil) - Date.now()) / 1000);
      if (remaining > 0) {
        setResendCooldown(remaining);
      } else {
        localStorage.removeItem("fildocs_resend_2fa_until");
      }
    }
  }, []);

  // Timer tick
  React.useEffect(() => {
    if (resendCooldown > 0) {
      resendTimerRef.current = setInterval(() => {
        setResendCooldown((prev) => {
          if (prev <= 1) {
            if (resendTimerRef.current) clearInterval(resendTimerRef.current);
            localStorage.removeItem("fildocs_resend_2fa_until");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [resendCooldown > 0]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/login", { email, password });
      const data = res.data;

      if (data.two_factor_required) {
        setChallengeId(data.challenge_id);
        setShowChallenge(true);
        setLoading(false);
        return;
      }

      handleLoginSuccess(data);
    } catch (err: any) {
      if (err?.response?.status === 429) {
        const retryAfter = err?.response?.data?.retry_after;
        const msg = err?.response?.data?.message || `Too many attempts. Please try again in ${retryAfter}s.`;
        setError(msg);
      } else if (err?.response?.status === 503) {
        // Handle maintenance rejection on login
        setError(err?.response?.data?.message || "System is under maintenance. Only administrators can sign in.");
      } else {
        const msg = err?.response?.data?.message || err?.message || "Login failed";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChallengeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await api.post("/login/two-factor", {
        challenge_id: challengeId,
        [isRecovery ? "recovery_code" : "code"]: code,
      });
      
      // If we got here, the backend accepted the code. 
      // We navigate immediately; any secondary failures won't show as a "code error"
      handleLoginSuccess(res.data);
    } catch (err: any) {
      // If we somehow have a token now, it means handleLoginSuccess was partially 
      // successful or the race condition favored the token save.
      if (localStorage.getItem("auth_token")) {
        console.warn("Login success detected despite challenge error caught:", err);
        navigate("/dashboard", { replace: true });
        return;
      }

      const status = err?.response?.status;
      if (status === 429) {
        const retryAfter = err?.response?.data?.retry_after;
        const msg = err?.response?.data?.message || `Too many attempts. Please try again in ${retryAfter}s.`;
        setError(msg);
      } else if (status === 503) {
        setError(err?.response?.data?.message || "System is under maintenance.");
      } else {
        const msg = err?.response?.data?.message || "Invalid verification code.";
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (data: any) => {
    // 1. CRITICAL: Save keys first
    localStorage.setItem("auth_token", data.token);
    setAuthUser(data.user);

    // 2. Wrap non-critical side effects in try/catch to prevent transition crashes
    try {
      if (data.user?.theme_preference) {
        setTheme(data.user.theme_preference);
      }
      
      // Fire events
      window.dispatchEvent(new Event("show_splash"));
      window.dispatchEvent(new Event("auth_user_updated"));
      
      // 3. INTENTIONAL PAINT DELAY: Give the browser a moment to render the splash 
      // and stabilize storage before the heavy Lazy-loading of the dashboard starts.
      // This prevents the "Something went wrong" race-condition crashes.
      setTimeout(() => {
        if (data.user?.must_change_password) {
          navigate("/force-password-change", { replace: true });
        } else {
          navigate("/dashboard", { replace: true });
        }
      }, 100);
    } catch (sideEffectError) {
      console.error("Non-critical login side-effect failed:", sideEffectError);
    }
  };

  const features = [
    "Automated Document Routing",
    "Real-time Status Tracking",
    "Secure Controlled Access",
  ];

  return (
    <main className="relative min-h-screen flex flex-col overflow-y-auto lg:overflow-hidden">
      <MaintenanceBanner />
      
      <div className="flex-1 relative flex items-center justify-center">
        {/* Background */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url(/login_bg.png)" }}
        />
        <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleDark}
          className="absolute top-4 right-4 z-20 flex items-center justify-center h-8 w-8 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition"
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        {/* Card container */}
        <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-4 lg:py-8 flex items-stretch justify-center">
          {/* ── Left panel ───────────────────────────────────────────────────── */}
          <div className="hidden lg:flex flex-col justify-between w-[430px] rounded-3xl rounded-r-none bg-gradient-to-br from-sky-500 via-blue-600 to-blue-700 text-white p-9 shadow-2xl">
            <div>
              {/* Institutional Header (Horizontal) */}
              <div className="flex items-start gap-4 mb-6 lg:mb-8">
                <div className="h-16 w-16 overflow-hidden rounded-2xl border border-white/25 bg-white/20 backdrop-blur-md shadow-lg shadow-blue-900/10 shrink-0">
                  <img
                    src={logoUrl}
                    alt="FCU Logo"
                    className="h-full w-full object-contain p-0.5"
                  />
                </div>
                <div className="flex flex-col pt-2">
                  <h3 className="text-[15.6px] font-display font-black uppercase tracking-tight leading-none text-white">
                    Filamer Christian University, Inc.
                  </h3>
                  <p className="text-[11px] text-blue-100/80 leading-tight mt-2 font-medium">
                    Roxas Avenue, Roxas City, Capiz, Philippines
                    <br />
                    Quality Assurance Office
                  </p>
                </div>
              </div>

              {/* Brand Section */}
              <div className="mb-4">
                <h1 className="text-[4.5rem] font-display font-semibold tracking-tighter text-white leading-none">
                  FilDOCS
                </h1>
                <p className="text-lg font-display font-semibold text-blue-200 mt-1">
                  Filamer Document Operations and Control System
                </p>
              </div>

              {/* Hero & Features */}
              <div>
                <p className="text-sm text-blue-100/90 leading-relaxed max-w-[320px] mb-6 font-medium">
                  A centralized workflow system built for seamless review,
                  tracking, and institutional accountability.
                </p>

                <ul className="space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-3.5">
                      <div className="shrink-0 h-6 w-6 rounded-md bg-white/15 backdrop-blur-sm flex items-center justify-center">
                        <CheckCircle2 size={13} className="text-blue-200" />
                      </div>
                      <span className="text-[13px] font-semibold tracking-tight text-white/95">
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer */}
            <p className="text-[9px] mt-4 font-semibold text-blue-300/60 uppercase tracking-widest">
              Filamer Christian University • Quality Assurance Office
            </p>
          </div>

          {/* ── Right panel ──────────────────────────────────────────────────── */}
          <div className="w-full max-w-sm lg:max-w-none lg:w-[390px] rounded-3xl lg:rounded-l-none bg-white dark:bg-surface-500 shadow-2xl px-10 py-6 lg:py-8 flex flex-col justify-center">
            {/* Mobile logo */}
            <div className="flex lg:hidden items-center justify-center mb-8">
              <div className="h-14 w-14 overflow-hidden rounded-md border border-slate-200 bg-white">
                <img
                  src={logoUrl}
                  alt="FCU Logo"
                  className="h-full w-full object-contain p-2"
                />
              </div>
            </div>

            <h2 className="text-[1.6rem] font-display font-semibold tracking-tight text-slate-900 dark:text-slate-100">
              {showChallenge ? "Two-Factor Verification" : "Sign In"}
            </h2>
            <p className="mt-0.5 text-sm text-slate-400 dark:text-slate-400">
              {showChallenge 
                ? (isRecovery ? "Enter a backup recovery code to access your account." : "Enter the 6-digit code from your authenticator app.") 
                : "Enter your credentials to access your portal."}
            </p>

            {isInactiveLogout && (
              <div className="mt-6 flex items-start gap-3 rounded-lg border border-brand-100 bg-brand-50/50 p-3.5 dark:border-brand-900/30 dark:bg-brand-950/20 animate-in fade-in slide-in-from-top-2 duration-300">
                <AlertCircle className="mt-0.5 h-4 w-4 text-brand-600 dark:text-brand-400 shrink-0" />
                <div className="flex-1">
                  <p className="text-[11px] font-semibold text-brand-900 dark:text-brand-100 uppercase tracking-tight">
                    Session Timed Out
                  </p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-brand-700/80 dark:text-brand-300/80 font-medium">
                    You have been logged out due to inactivity for security. Please sign in again.
                  </p>
                </div>
                <button 
                  type="button"
                  onClick={() => {
                    searchParams.delete("inactive");
                    setSearchParams(searchParams);
                  }}
                  className="rounded p-1 text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-900/50 transition-colors"
                  title="Dismiss"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}

            {!showChallenge ? (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* Email */}
                <FormField
                  label="Institutional Email"
                  type="text"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="qa@example.com"
                  required
                  isRequired
                  icon={Mail}
                  error={
                    emailTouched &&
                      email &&
                      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
                      ? "Please enter a valid email address."
                      : undefined
                  }
                  isValid={emailTouched && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
                />

                {/* Password */}
                <FormField
                  label="Password"
                  isPassword
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  isRequired
                  icon={Lock}
                  hint="Use your institutional account password."
                />

                <div className="flex justify-end">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-medium text-brand-400 hover:text-brand-500 dark:text-brand-300 dark:hover:text-brand-200 transition"
                  >
                    Forgot password?
                  </Link>
                </div>

                {error && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 px-4 py-3 text-xs text-rose-700 dark:text-rose-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700 text-sm font-semibold text-white  shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleChallengeSubmit} className="mt-8 space-y-6">
                 <FormField
                    label={isRecovery ? "Recovery Code" : "Verification Code"}
                    type="text"
                    placeholder={isRecovery ? "XXXXX-XXXXX" : "000 000"}
                    value={code}
                    onChange={e => setCode(e.target.value)}
                    required
                    isRequired
                    icon={isRecovery ? Lock : CheckCircle2}
                    maxLength={isRecovery ? 21 : 6}
                 />

                 <div className="flex flex-col gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-2.5 rounded-md bg-brand-500 hover:bg-brand-600 dark:bg-brand-600 dark:hover:bg-brand-700 text-sm font-semibold text-white  shadow-brand-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                      {loading ? "Verifying..." : "Verify Code"}
                    </button>

                    {!isRecovery && (
                      <div className="flex flex-col items-center mt-3">
                         <button
                            type="button"
                            disabled={loading || isResendingEmail || resendCooldown > 0}
                            onClick={async () => {
                              setIsResendingEmail(true);
                              try {
                                await api.post("/login/two-factor/email", { challenge_id: challengeId });
                                setSuccessMessage("Verification code sent to your email.");
                                setError(null);
                                
                                // Set 5 minute cooldown
                                const until = Date.now() + (5 * 60 * 1000);
                                localStorage.setItem("fildocs_resend_2fa_until", String(until));
                                setResendCooldown(5 * 60);
                              } catch (err: any) {
                                setError(err?.response?.data?.message || "Failed to send email.");
                                setSuccessMessage(null);
                              } finally {
                                setIsResendingEmail(false);
                              }
                            }}
                            className="text-xs font-semibold text-slate-500 hover:text-brand-500 dark:text-slate-400 dark:hover:text-brand-300 transition text-center py-1 disabled:opacity-50 disabled:cursor-not-allowed group"
                          >
                            <div className="flex items-center gap-2">
                              {isResendingEmail && <div className="h-3 w-3 rounded-full border border-slate-300 border-t-brand-500 animate-spin" />}
                              <span>
                                {resendCooldown > 0 
                                  ? `Resend available in ${Math.floor(resendCooldown / 60)}:${(resendCooldown % 60).toString().padStart(2, "0")}`
                                  : "Can't access your app? Send code to email"}
                              </span>
                            </div>
                         </button>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => {
                          setIsRecovery(!isRecovery);
                          setCode("");
                          setError(null);
                      }}
                      className="mt-3 text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 transition text-center"
                    >
                      {isRecovery ? "Use authenticator app" : "Can't access your app? Use a recovery code"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                          setShowChallenge(false);
                          setCode("");
                          setError(null);
                      }}
                      className="text-xs font-medium text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 transition text-center"
                    >
                      Back to login
                    </button>
                 </div>

                 {(error || successMessage) && (
                  <div className={`rounded-md border px-4 py-3 text-xs transition-colors ${
                    successMessage 
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400"
                      : "border-rose-200 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400"
                  }`}>
                    {successMessage || error}
                  </div>
                )}
              </form>
            )}

            <p className="mt-6 text-center text-xs text-slate-400 dark:text-slate-500">
              New to FilDOCS?{" "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                Contact System Administrator
              </span>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
