import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../lib/auth";
import logoUrl from "../assets/FCU Logo.png";
import { CheckCircle2, Sun, Moon, Mail, Lock } from "lucide-react";
import { useTheme } from "../hooks/useTheme";
import FormField from "../components/ui/FormField";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000/api";

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
      const res = await fetch(`${API_BASE}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Login failed");
        return;
      }
      const data = await res.json();
      localStorage.setItem("auth_token", data.token);
      setAuthUser(data.user);
      // Preload the dashboard chunk while the splash is animating
      import("./DashboardPage").catch(() => {});
      window.dispatchEvent(new Event("show_splash"));
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Network error");
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
            {/* Logo + name */}
            <div className="flex items-center gap-3 mb-10">
              <div className="h-11 w-11 overflow-hidden rounded-md border border-white/25 bg-white/15 backdrop-blur-sm shrink-0">
                <img
                  src={logoUrl}
                  alt="FCU Logo"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold tracking-tight">FilDAS</div>
                <div className="text-[11px] uppercase tracking-wide text-blue-200 font-medium">
                  Quality Assurance
                </div>
              </div>
            </div>

            {/* Hero text */}
            <h1 className="text-[2.1rem] font-extrabold leading-[1.15] tracking-tight">
              Empowering
              <br />
              Document
              <br />
              Excellence.
            </h1>
            <p className="mt-4 text-sm text-blue-100/80 leading-relaxed max-w-[260px]">
              A centralized workflow system built for seamless review, tracking,
              and institutional accountability.
            </p>

            {/* Divider */}
            <div className="mt-8 mb-6 border-t border-white/15" />

            {/* Feature list */}
            <ul className="space-y-3.5">
              {features.map((f) => (
                <li key={f} className="flex items-center gap-3">
                  <div className="shrink-0 h-6 w-6 rounded bg-white/15 flex items-center justify-center">
                    <CheckCircle2 size={13} className="text-blue-200" />
                  </div>
                  <span className="text-sm font-medium text-white/90">{f}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Footer */}
          <p className="text-[11px] text-blue-300/70 mt-8">
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

          <h2 className="text-[1.6rem] font-bold tracking-tight text-slate-900 dark:text-slate-100">
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
