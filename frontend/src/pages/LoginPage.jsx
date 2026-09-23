import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError } from "../lib/utils";
import AuthLayout, { AuthButton, AuthCard, AuthError, AuthHeading, AuthLink } from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
import { collectFieldErrors } from "../components/auth/validation";
import { EASE } from "../components/public/motion";

/**
 * Firm login — Mercury-style single card (see components/auth/AuthLayout).
 *
 * Visual layer only — the schema, the `useAuth().login` call, the
 * `location.state.from` redirect and the already-authenticated guard are all
 * exactly as they were. There is no social/OAuth sign-in here because the
 * backend exposes none: `auth.routes.js` has email+password, refresh, logout
 * and password reset, and nothing else. Adding a "Continue with Google" button
 * would have been inventing an authentication provider.
 */

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const LoginPage = () => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const [form, setForm] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return; // belt-and-braces against a double submit
    setError("");
    setFieldErrors({});

    const validation = loginSchema.safeParse(form);
    if (!validation.success) {
      setFieldErrors(collectFieldErrors(validation.error));
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

  const setField = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear a field's error as soon as the user starts fixing it; keeping it on
    // screen while they type reads as the form arguing with them.
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  return (
    <AuthLayout topLink={{ to: "/signup", label: "Set up your firm" }}>
      <AuthCard
        footer={
          <div className="space-y-2 text-[13px] text-carbon-500">
            <p>
              New to Verax? <AuthLink to="/signup">Set up your firm</AuthLink>
            </p>
            <p>
              A client of a CA firm? <AuthLink to="/client-portal/login">Use the client portal</AuthLink>
            </p>
          </div>
        }
      >
        <AuthHeading title="Log in to Verax" subtitle="Your firm's documents, reviews and exports." />

        <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
          <AuthField
            id="email"
            label="Work email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={form.email}
            onChange={setField("email")}
            error={fieldErrors.email}
          />

          <div>
            <AuthField
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={setField("password")}
              error={fieldErrors.password}
            />
            <Link
              to="/forgot-password"
              className="mt-2 inline-block rounded text-[12.5px] text-carbon-500 transition-colors hover:text-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              Forgot password?
            </Link>
          </div>

          <AnimatePresence initial={false}>
            {error ? (
              <motion.div
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <AuthError>{error}</AuthError>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="pt-2">
            <AuthButton loading={loading} loadingLabel="Logging in…">
              Log in
            </AuthButton>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

export default LoginPage;
