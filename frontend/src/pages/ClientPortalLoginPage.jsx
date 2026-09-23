import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { useClientPortalAuth } from "../contexts/ClientPortalAuthContext";
import { parseApiError } from "../lib/utils";
import AuthLayout, { AuthButton, AuthCard, AuthError, AuthHeading, AuthLink } from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
import { EASE } from "../components/public/motion";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

/**
 * Client-portal sign in — the same Mercury-style card as the firm login, told
 * apart by a "Client portal" badge beside the logo and by what it leaves out:
 * no self-serve signup and no password reset, because clients are invited and
 * managed by their CA firm. Logic is unchanged: `useClientPortalAuth().login`,
 * the `location.state.from` redirect, and the loading / already-signed-in
 * guards.
 */

const ClientPortalLoginPage = () => {
  const { isAuthenticated, isLoading, login } = useClientPortalAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduced = useReducedMotion();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const layoutProps = {
    badge: "Client portal",
    topLink: { to: "/login", label: "CA firm? Log in" }
  };

  if (isLoading) {
    return (
      <AuthLayout {...layoutProps}>
        <AuthCard>
          <div className="space-y-3">
            <div className="h-5 w-2/5 animate-pulse rounded-md bg-carbon-900/[0.06]" />
            <div className="h-3.5 w-3/4 animate-pulse rounded-md bg-carbon-900/[0.04]" />
          </div>
          <div className="mt-7 space-y-4">
            <div className="h-10 w-full animate-pulse rounded-lg bg-carbon-900/[0.04]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-carbon-900/[0.04]" />
            <div className="h-10 w-28 animate-pulse rounded-full bg-carbon-900/[0.06]" />
          </div>
          <span className="sr-only">Loading your session…</span>
        </AuthCard>
      </AuthLayout>
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

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <AuthLayout {...layoutProps}>
      <AuthCard
        footer={
          <div className="space-y-2 text-[13px] text-carbon-500">
            <p>
              <span className="font-medium text-carbon-700">Forgot your password?</span> Your CA firm can
              issue you a new one.
            </p>
            <p>
              Are you a CA firm? <AuthLink to="/login">Log in here</AuthLink>
            </p>
          </div>
        }
      >
        <AuthHeading
          title="Sign in to your client portal"
          subtitle="Upload documents for your CA and see where each one stands."
        />

        <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
          <AuthField
            id="client-email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={form.email}
            onChange={setField("email")}
          />

          <AuthField
            id="client-password"
            label="Password"
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={setField("password")}
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
                <AuthError>{error}</AuthError>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="pt-2">
            <AuthButton loading={submitting} loadingLabel="Signing in…">
              Sign in
            </AuthButton>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

export default ClientPortalLoginPage;
