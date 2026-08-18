import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError } from "../lib/utils";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import { LoginPanel } from "../components/auth/AuthPanel";
import { collectFieldErrors } from "../components/auth/validation";
import { Caret, Eyebrow } from "../components/marketing/ledger";
import { EASE } from "../components/public/motion";

/**
 * Firm login.
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

  const enter = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <AuthShell panel={<LoginPanel />}>
      <motion.div {...enter(0)}>
        <Eyebrow>Firm workspace</Eyebrow>
      </motion.div>

      <motion.h1
        {...enter(0.06)}
        className="mt-7 text-[2.25rem] font-bold leading-[1.05] tracking-[-0.04em] text-carbon-900 sm:text-[2.5rem]"
      >
        Welcome back.
      </motion.h1>

      <motion.p {...enter(0.12)} className="mt-4 text-[1rem] leading-[1.65] text-carbon-500">
        Continue to your firm&apos;s financial workspace.
      </motion.p>

      <motion.form {...enter(0.18)} className="mt-10 space-y-5" onSubmit={onSubmit} noValidate>
        <AuthField
          id="email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={setField("email")}
          error={fieldErrors.email}
        />

        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={form.password}
          onChange={setField("password")}
          error={fieldErrors.password}
          action={
            <Link
              to="/forgot-password"
              className="rounded text-[0.8125rem] font-medium text-carbon-500 underline
                         decoration-carbon-200 underline-offset-4 transition-colors
                         hover:text-carbon-900 hover:decoration-carbon-400 focus-visible:outline-none
                         focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4
                         focus-visible:ring-offset-canvas"
            >
              Forgot password?
            </Link>
          }
        />

        <AnimatePresence initial={false}>
          {error ? (
            <motion.div
              initial={reduced ? false : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden"
            >
              <p
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3
                           text-[0.875rem] font-medium leading-[1.5] text-red-700"
              >
                <span className="mt-[3px] text-red-600">
                  <Caret size={13} />
                </span>
                {error}
              </p>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <button type="submit" disabled={loading} className="vx-cta w-full disabled:opacity-60">
          {loading ? (
            <>
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
              />
              Logging in…
            </>
          ) : (
            "Log in"
          )}
        </button>
      </motion.form>

      <motion.div {...enter(0.26)} className="mt-10 border-t border-hairline pt-7">
        <p className="text-[0.875rem] text-carbon-500">
          New to Verax?{" "}
          <Link
            to="/signup"
            className="rounded font-medium text-carbon-900 underline decoration-carbon-300
                       underline-offset-4 transition-colors hover:decoration-carbon-900
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                       focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
          >
            Set up your firm
          </Link>
        </p>

        <p className="mt-3 text-[0.8125rem] text-carbon-400">
          Are you a client of a CA firm?{" "}
          <Link
            to="/client-portal/login"
            className="rounded underline decoration-carbon-200 underline-offset-4 transition-colors
                       hover:text-carbon-900 hover:decoration-carbon-400 focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-4
                       focus-visible:ring-offset-canvas"
          >
            Use the client portal
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
};

export default LoginPage;
