import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError } from "../lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validation = loginSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid login details");
      return;
    }

    setLoading(true);
    try {
      await login(validation.data);
      const nextPath = location.state?.from || "/dashboard";
      navigate(nextPath, { replace: true });
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to login"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Brand Panel */}
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-ink-900 via-ink-800 to-ink-700 text-white shadow-elevated">
          <div className="relative h-full p-8 sm:p-10">
            {/* Animated Orbs */}
            <div className="absolute -left-10 top-12 h-40 w-40 rounded-full bg-mint-500/25 blur-2xl animate-float" />
            <div className="absolute right-0 top-1/2 h-36 w-36 rounded-full bg-indigo-400/20 blur-2xl animate-float-delayed" />
            <div className="absolute bottom-10 left-1/3 h-28 w-28 rounded-full bg-ember-500/15 blur-2xl animate-float" />

            <Link to="/" className="relative inline-block">
              <div className="rounded-xl bg-white/10 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sand-100 backdrop-blur-sm border border-white/10 transition hover:bg-white/20">
                Verax
              </div>
            </Link>

            <h1 className="relative mt-6 max-w-lg text-3xl font-extrabold leading-tight sm:text-4xl">
              Keep client books, OCR reviews, and Tally exports in{" "}
              <span className="text-mint-400">one secure platform</span>.
            </h1>

            <ul className="relative mt-8 space-y-4 text-sm text-sand-100/90">
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Firm-isolated data with strict multi-tenant controls
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Document OCR and accountant review workflow
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                TallyPrime XML export with audit tracking
              </li>
            </ul>
          </div>
        </section>

        {/* Login Form */}
        <section className="panel p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-ink-900">Sign in</h2>
          <p className="mt-1 text-sm text-ink-500">Use your firm credentials to continue.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="field"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="owner@firm.in"
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="label" htmlFor="password">
                  Password
                </label>
                <Link className="text-xs font-semibold text-mint-500 underline transition hover:text-mint-600" to="/forgot-password">
                  Forgot password?
                </Link>
              </div>
              <input
                id="password"
                className="field"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Enter password"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <hr className="flex-1 border-[#e7dcc8]" />
            <span className="text-xs font-medium text-[#7f8a99]">or</span>
            <hr className="flex-1 border-[#e7dcc8]" />
          </div>

          <p className="mt-5 text-center text-sm text-ink-500">
            Don't have an account?{" "}
            <Link className="font-semibold text-mint-500 underline transition hover:text-mint-600" to="/signup">
              Create one
            </Link>
          </p>

          <p className="mt-3 text-center text-xs text-[#9aa5b4]">
            Public client upload is available via magic link at
            <span className="font-mono"> /upload/:token</span>.{" "}
            <Link className="font-semibold text-ink-900 underline" to="/upload/sample-token">
              Preview route
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
