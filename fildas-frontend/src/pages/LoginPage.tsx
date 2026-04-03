import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { setAuthUser } from "../lib/auth";
import logoUrl from "../assets/FCU Logo.png";
import { CheckCircle2, Sun, Moon, Mail, Lock } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import FormField from "../components/ui/FormField";
import api from "../services/api";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { theme, toggle: toggleDark } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.post("/login", { email, password });
      const data = res.data;
      localStorage.setItem("auth_token", data.token);
      setAuthUser(data.user);
      // Preload the dashboard chunk while the splash is animating
      import("./DashboardPage").catch(() => { });
      window.dispatchEvent(new Event("show_splash"));
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      const msg =
        err?.response?.data?.message || err?.message || "Login failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const features = [
    "Automated Document Routing",
    "Real-time Status Tracking",
    "Secure Controlled Access",
  ];

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
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
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-10 flex items-stretch justify-center">
        {/* ── Left panel ───────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between w-[430px] rounded-3xl rounded-r-none bg-gradient-to-br from-sky-500 via-blue-600 to-blue-700 text-white p-9 shadow-2xl">
          <div>
            {/* Institutional Header (Horizontal) */}
            <div className="flex items-start gap-4 mb-14">
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
            <div className="mb-6">
              <h1 className="text-[4.5rem] font-display font-bold tracking-tighter text-white leading-none">
                FilDAS
              </h1>
              <p className="text-xl font-display font-bold text-blue-200 mt-2">
                Filamer Digital Archiving System
              </p>
            </div>

            {/* Hero & Features */}
            <div>
              <p className="text-sm text-blue-100/90 leading-relaxed max-w-[320px] mb-8 font-medium">
                A centralized workflow system built for seamless review,
                tracking, and institutional accountability.
              </p>

              <ul className="space-y-4">
                {features.map((f) => (
                  <li key={f} className="flex items-center gap-3.5">
                    <div className="shrink-0 h-6 w-6 rounded-md bg-white/15 backdrop-blur-sm flex items-center justify-center">
                      <CheckCircle2 size={13} className="text-blue-200" />
                    </div>
                    <span className="text-[13px] font-bold tracking-tight text-white/95">
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Footer */}
          <p className="text-[9px] mt-4 font-bold text-blue-300/60 uppercase tracking-widest">
            Filamer Christian University • Quality Assurance Office
          </p>
        </div>

        {/* ── Right panel ──────────────────────────────────────────────────── */}
        <div className="w-full max-w-sm lg:max-w-none lg:w-[390px] rounded-3xl lg:rounded-l-none bg-white dark:bg-surface-500 shadow-2xl px-10 py-12 flex flex-col justify-center">
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

          <h2 className="text-[1.6rem] font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Sign In
          </h2>
          <p className="mt-1 text-sm text-slate-400 dark:text-slate-400">
            Enter your credentials to access your portal.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
              className="w-full py-2.5 rounded-md bg-brand-400 hover:bg-brand-500 dark:bg-brand-300 dark:hover:bg-brand-400 text-sm font-semibold text-white transition disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
            New to FilDAS?{" "}
            <span className="font-semibold text-slate-600 dark:text-slate-300">
              Contact System Administrator
            </span>
          </p>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
