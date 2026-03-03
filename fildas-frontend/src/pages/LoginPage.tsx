import React from "react";

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string) || "http://127.0.0.1:8000/api";

import logoUrl from "../assets/FCU Logo.png";

import { useNavigate } from "react-router-dom";
import { setAuthUser } from "../lib/auth"; // adjust path if needed

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
        setLoading(false);
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
    <main className="min-h-screen bg-linear-to-b from-slate-50 to-slate-100 p-4 sm:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-6xl items-center justify-center sm:min-h-[calc(100vh-4rem)]">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white/70 shadow-sm lg:grid lg:grid-cols-2">
          {/* Left panel (hidden on mobile) */}
          <div className="hidden lg:flex p-8">
            <div className="flex w-full flex-col justify-between rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
              <div>
                {/* Logo placeholder (empty for now) */}
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <img
                      src={logoUrl}
                      alt="FCU Logo"
                      className="h-full w-full object-contain p-1"
                    />
                  </div>

                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-slate-900">
                      FilDAS
                    </div>
                    <div className="text-[11px] text-slate-500">
                      FCU • Quality Assurance
                    </div>
                  </div>
                </div>

                <h1 className="mt-8 text-3xl font-semibold tracking-tight text-slate-900">
                  FilDAS
                </h1>
                <p className="mt-2 text-sm text-slate-600 max-w-md">
                  A centralized and secure document workflow system for Quality
                  Assurance.
                </p>

                <div className="mt-8 rounded-2xl border border-slate-200 bg-white/70 p-5">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    What you can do
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-700">
                    <li>
                      Route documents for review, approval, and distribution.
                    </li>
                    <li>Track status and assigned office in real time.</li>
                    <li>
                      Maintain accountability with logs and controlled access.
                    </li>
                  </ul>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Filamer Christian University • Quality Assurance Office
              </p>
            </div>
          </div>

          {/* Right panel (form) */}
          <div className="flex items-center justify-center p-6 sm:p-10 lg:p-12">
            <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-10">
              <div className="flex items-center justify-center">
                <div className="h-14 w-14 overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <img
                    src={logoUrl}
                    alt="FCU Logo"
                    className="h-full w-full object-contain p-2"
                  />
                </div>
              </div>

              <h2 className="mt-5 text-center text-2xl font-semibold tracking-tight text-slate-900">
                Welcome back
              </h2>
              <p className="mt-1 text-center text-sm text-slate-500">
                Please sign in to your account
              </p>

              <div className="mt-6">
                {/* Title moved above; keep spacing container */}

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Email
                    </label>
                    <input
                      type="email"
                      autoComplete="username"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Password
                    </label>
                    <input
                      type="password"
                      autoComplete="current-password"
                      className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>

                  {error && (
                    <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center rounded-md bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {loading ? "Signing in..." : "Sign in"}
                  </button>
                </form>
              </div>

              <p className="mt-6 text-center text-xs text-slate-500">
                Having trouble signing in? Contact QA/IT for account access.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default LoginPage;
