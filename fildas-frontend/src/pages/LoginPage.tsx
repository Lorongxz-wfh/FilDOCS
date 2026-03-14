import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../lib/auth";
import logoUrl from "../assets/FCU Logo.png";
import { Eye, EyeOff, CheckCircle2, Sun, Moon } from "lucide-react";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000/api";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains("dark"),
  );

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

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
        className="absolute top-4 right-4 z-20 flex items-center justify-center h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/20 text-white backdrop-blur-sm transition"
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>

      {/* Card container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-4 py-10 flex items-stretch justify-center">
        {/* ── Left panel ───────────────────────────────────────────────────── */}
        <div className="hidden lg:flex flex-col justify-between w-[430px] rounded-3xl rounded-r-none bg-gradient-to-br from-sky-500 via-blue-600 to-blue-700 text-white p-9 shadow-2xl">
          <div>
            {/* Logo + name */}
            <div className="flex items-center gap-3 mb-10">
              <div className="h-11 w-11 overflow-hidden rounded-xl border border-white/25 bg-white/15 backdrop-blur-sm shrink-0">
                <img
                  src={logoUrl}
                  alt="FCU Logo"
                  className="h-full w-full object-contain p-1"
                />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold tracking-tight">FilDAS</div>
                <div className="text-[11px] uppercase tracking-widest text-blue-200 font-medium">
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
                  <div className="shrink-0 h-6 w-6 rounded-full bg-white/15 flex items-center justify-center">
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
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
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
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Institutional Email
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="qa@example.com"
                required
                className="w-full rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-surface-600 focus:ring-2 focus:ring-sky-400/20 transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 dark:border-surface-400 bg-slate-50 dark:bg-surface-600 px-4 py-3 pr-16 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-400 focus:bg-white dark:focus:bg-surface-600 focus:ring-2 focus:ring-sky-400/20 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <>
                      <EyeOff size={13} /> HIDE
                    </>
                  ) : (
                    <>
                      <Eye size={13} /> SHOW
                    </>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl bg-sky-500 hover:bg-sky-600 dark:bg-sky-500 dark:hover:bg-sky-600 text-sm font-bold text-white tracking-wide transition disabled:opacity-60 active:scale-[0.99]"
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
