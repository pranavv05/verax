import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useClientPortalAuth } from "../contexts/ClientPortalAuthContext";
import { parseApiError } from "../lib/utils";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const ClientPortalLoginPage = () => {
  const { isAuthenticated, isLoading, login } = useClientPortalAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-4">
        <p className="text-base font-semibold text-ink-700">Loading...</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/client-portal/dashboard" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");

    const validation = loginSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Enter your email and password");
      return;
    }

    setSubmitting(true);
    try {
      await login(validation.data);
      navigate(location.state?.from || "/client-portal/dashboard", { replace: true });
    } catch (submitError) {
      setError(parseApiError(submitError, "We couldn't sign you in. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-4 py-10 sm:px-6">
      <div className="mx-auto w-full max-w-md">
        <p className="text-sm font-extrabold uppercase tracking-widest text-ink-900">Verax</p>
        <h1 className="mt-3 text-3xl font-extrabold text-ink-900">Sign in</h1>
        <p className="mt-2 text-base text-[#607086]">
          See the documents your accountant holds for you and how they're getting on.
        </p>

        <form className="mt-8 space-y-5" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="client-email">
              Email
            </label>
            <input
              id="client-email"
              className="field py-3 text-base"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="you@yourbusiness.in"
            />
          </div>

          <div>
            <label className="label" htmlFor="client-password">
              Password
            </label>
            <input
              id="client-password"
              className="field py-3 text-base"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder="Enter your password"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-base font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            className="btn-primary w-full py-3 text-base"
            disabled={submitting}
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-6">
          <button
            type="button"
            className="text-base font-semibold text-ink-700 underline"
            onClick={() => setShowForgot((previous) => !previous)}
          >
            Forgot your password?
          </button>
          {showForgot ? (
            <p className="mt-2 rounded-xl border border-[#e7dcc8] bg-sand-50 px-4 py-3 text-base text-[#607086]">
              Contact your CA firm to reset your password. They can issue you a new one.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ClientPortalLoginPage;
