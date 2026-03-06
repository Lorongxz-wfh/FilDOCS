import React from "react";
import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../lib/auth";
import logoUrl from "../assets/FCU Logo.png";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000/api";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

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
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url(/login_bg.png)" }}
      />
      {/* Overlay */}
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" />

      {/* Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 py-10 flex items-center justify-center gap-0 lg:gap-0">
        {/* Left info card */}
        <div className="hidden lg:flex flex-col justify-between w-80 min-h-[480px] rounded-3xl rounded-r-none bg-gradient-to-br from-sky-500 to-blue-700 text-white p-10 shadow-2xl">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 overflow-hidden rounded-xl border border-white/30 bg-white/20 backdrop-blur-sm">
                <img
                  src={logoUrl}
                  alt="FCU Logo"
                  className="h-full w-full object-contain p-1.5"
                />
              </div>
              <div className="leading-tight">
                <div className="text-base font-bold">FilDAS</div>
                <div className="text-[11px] text-blue-100">
                  FCU • Quality Assurance
                </div>
              </div>
            </div>

            <h1 className="mt-8 text-3xl font-bold leading-tight">
              Welcome to FilDAS
            </h1>
            <p className="mt-2 text-sm text-blue-100">
              A centralized document workflow system for Quality Assurance.
            </p>

            <div className="mt-8 rounded-2xl border border-white/20 bg-white/10 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-100">
                What you can do
              </p>
              <ul className="mt-3 space-y-2 text-sm text-white/90">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-200">•</span>
                  Route documents for review, approval, and distribution.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-200">•</span>
                  Track status and assigned office in real time.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-blue-200">•</span>
                  Maintain accountability with logs and controlled access.
                </li>
              </ul>
            </div>
          </div>

          <p className="text-[11px] text-blue-200">
            Filamer Christian University • Quality Assurance Office
          </p>
        </div>

        {/* Right login card */}
        <div className="w-full max-w-sm lg:max-w-none lg:w-96 rounded-3xl lg:rounded-l-none bg-white/95 backdrop-blur-md shadow-2xl p-10 flex flex-col justify-center min-h-[480px]">
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center mb-6">
            <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <img
                src={logoUrl}
                alt="FCU Logo"
                className="h-full w-full object-contain p-2"
              />
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-slate-900 text-center">
            Welcome back
          </h2>
          <p className="mt-1 text-sm text-slate-500 text-center">
            Please sign in to your account
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email
              </label>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-gradient-to-r from-sky-500 to-blue-600 text-sm font-semibold text-white hover:opacity-90 active:scale-[0.99] transition disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400">
            Having trouble signing in? Contact QA/IT for account access.
          </p>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
