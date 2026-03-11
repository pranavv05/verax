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
        <section className="panel overflow-hidden bg-ink-900 text-white">
          <div className="relative h-full p-8 sm:p-10">
            <div className="absolute -left-10 top-12 h-40 w-40 rounded-full bg-mint-500/25 blur-2xl" />
            <div className="absolute right-0 top-1/2 h-36 w-36 rounded-full bg-amber-400/20 blur-2xl" />
            <p className="relative text-xs font-bold uppercase tracking-[0.24em] text-sand-200">
              Chartered Accountant Workspace
            </p>
            <h1 className="relative mt-4 max-w-lg text-3xl font-extrabold leading-tight sm:text-4xl">
              Keep client books, OCR reviews, and Tally exports in one secure tenant platform.
            </h1>
            <ul className="relative mt-8 space-y-3 text-sm text-sand-100/95">
              <li>Firm-isolated data with strict multi-tenant controls</li>
              <li>Document OCR and accountant review workflow</li>
              <li>TallyPrime XML export with audit tracking</li>
            </ul>
          </div>
        </section>

        <section className="panel p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-ink-900">Sign in</h2>
          <p className="mt-1 text-sm text-[#607086]">Use your firm credentials to continue.</p>

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
              <label className="label" htmlFor="password">
                Password
              </label>
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
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
              {loading ? "Signing in..." : "Login"}
            </button>
          </form>

          <p className="mt-5 text-xs text-[#72829a]">
            Public client upload is available via magic link at
            <span className="font-mono"> /upload/:token</span>.
            <Link className="ml-1 font-semibold text-ink-900 underline" to="/upload/sample-token">
              Preview route
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
};

export default LoginPage;
