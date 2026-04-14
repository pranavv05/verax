import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth-api";
import { tokenStore, userStore } from "../lib/token-store";
import { parseApiError } from "../lib/utils";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  firmName: z.string().min(2, "Firm name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const SignupPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: "", firmName: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validation = signupSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Invalid details");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.signup(validation.data);
      tokenStore.setAccessToken(result.accessToken);
      if (result.user) userStore.setUser(result.user);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to create account"));
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
              Start managing your practice{" "}
              <span className="text-mint-400">smarter</span> today
            </h1>

            <p className="relative mt-4 max-w-md text-base text-sand-100/70">
              Join hundreds of CA firms using Verax to streamline their document workflows and Tally exports.
            </p>

            <ul className="relative mt-8 space-y-4 text-sm text-sand-100/90">
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Free 14-day trial, no credit card required
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                AI-powered OCR document extraction
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Secure multi-tenant data isolation
              </li>
              <li className="flex items-start gap-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-mint-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                One-click TallyPrime XML export
              </li>
            </ul>
          </div>
        </section>

        {/* Signup Form */}
        <section className="panel p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold text-ink-900">Create your account</h2>
          <p className="mt-1 text-sm text-[#607086]">Get started with Verax in minutes.</p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="signup-name">
                  Full Name
                </label>
                <input
                  id="signup-name"
                  className="field"
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Rajesh Patel"
                />
              </div>
              <div>
                <label className="label" htmlFor="signup-firm">
                  Firm Name
                </label>
                <input
                  id="signup-firm"
                  className="field"
                  type="text"
                  value={form.firmName}
                  onChange={(event) => setForm((prev) => ({ ...prev, firmName: event.target.value }))}
                  placeholder="Patel & Associates"
                />
              </div>
            </div>

            <div>
              <label className="label" htmlFor="signup-email">
                Work Email
              </label>
              <input
                id="signup-email"
                className="field"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="rajesh@firm.in"
              />
            </div>

            <div>
              <label className="label" htmlFor="signup-password">
                Password
              </label>
              <input
                id="signup-password"
                className="field"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Minimum 8 characters"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className="btn-accent w-full py-3 text-sm">
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <div className="mt-6 flex items-center gap-3">
            <hr className="flex-1 border-[#e7dcc8]" />
            <span className="text-xs font-medium text-[#7f8a99]">or</span>
            <hr className="flex-1 border-[#e7dcc8]" />
          </div>

          <p className="mt-5 text-center text-sm text-[#72829a]">
            Already have an account?{" "}
            <Link className="font-semibold text-ink-900 underline transition hover:text-mint-600" to="/login">
              Sign in
            </Link>
          </p>

          <p className="mt-4 text-center text-xs text-[#9aa5b4]">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </section>
      </div>
    </div>
  );
};

export default SignupPage;
