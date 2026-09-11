import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { z } from "zod";
import { useClientPortalAuth } from "../contexts/ClientPortalAuthContext";
import { parseApiError } from "../lib/utils";
import VeraxLogo, { VeraxMark } from "../components/brand/VeraxLogo";
import FloatingField from "../components/public/FloatingField";
import { EASE } from "../components/public/motion";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

/**
 * Deliberately a different world from the firm login: teal instead of blue, a
 * single centred card instead of the split layout, larger type, and no signup
 * path — clients are invited by their CA firm, never self-serve.
 */
const PortalFrame = ({ children }) => (
  <div className="vx-page relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 py-10">
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {/* Teal counterpart to the landing page's indigo hero glow. */}
      <div className="absolute left-1/2 top-[-30rem] h-[46rem] w-[46rem] max-w-[160vw] -translate-x-1/2 rounded-full bg-verify-500/10 blur-[100px]" />
      <div className="absolute -right-16 bottom-[-14rem] h-[28rem] w-[28rem] rounded-full bg-indigo-500/[0.07] blur-[100px]" />
    </div>
    <div className="relative w-full max-w-[26rem]">{children}</div>
  </div>
);

const ClientPortalLoginPage = () => {
  const { isAuthenticated, isLoading, login } = useClientPortalAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (isLoading) {
    return (
      <PortalFrame>
        <div className="rounded-2xl border border-hairline bg-surface p-8">
          <div className="flex items-center gap-3">
            <VeraxMark size={34} />
            <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
          </div>
          <div className="mt-8 space-y-3">
            <div className="h-7 w-2/3 animate-pulse rounded-lg bg-white/10" />
            <div className="h-4 w-full animate-pulse rounded-lg bg-white/5" />
          </div>
          <div className="mt-8 space-y-3">
            <div className="h-[3.4rem] w-full animate-pulse rounded-xl bg-white/5" />
            <div className="h-[3.4rem] w-full animate-pulse rounded-xl bg-white/5" />
            <div className="h-[3.1rem] w-full animate-pulse rounded-xl bg-white/10" />
          </div>
          <span className="sr-only">Loading your session…</span>
        </div>
      </PortalFrame>
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

  const setField = (key) => (event) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  return (
    <PortalFrame>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE }}
      >
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
          {/* Teal band is the one strong signal that this is not the firm login */}
          <div className="h-1.5 w-full bg-gradient-to-r from-teal-400 via-teal-500 to-indigo-500" />

          <div className="p-7 sm:p-9">
            <span className="inline-flex items-center gap-2 rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-teal-300">
              Client Portal
            </span>

            <h1 className="mt-4 text-[1.7rem] font-bold leading-tight tracking-[-0.03em] text-zinc-100">
              Sign in
            </h1>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-zinc-400">
              Access your document status and reports.
            </p>

            <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
              <FloatingField
                id="client-email"
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                accent="teal"
                value={form.email}
                onChange={setField("email")}
              />

              <FloatingField
                id="client-password"
                label="Password"
                type="password"
                autoComplete="current-password"
                accent="teal"
                value={form.password}
                onChange={setField("password")}
              />

              <AnimatePresence>
                {error ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    role="alert"
                    className="overflow-hidden"
                  >
                    <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[0.95rem] font-medium text-red-300">
                      {error}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={submitting ? undefined : { opacity: 0.82 }}
                transition={{ duration: 0.15, ease: EASE }}
                className="vx-btn w-full bg-teal-500 py-3.5 text-base text-white hover:bg-teal-400 focus-visible:ring-teal-500 focus-visible:ring-offset-canvas"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Signing in…
                  </>
                ) : (
                  "Login"
                )}
              </motion.button>
            </form>

            <p className="mt-6 rounded-xl bg-white/[0.04] px-4 py-3.5 text-sm leading-relaxed text-zinc-400">
              <span className="font-semibold text-zinc-200">Forgot your password?</span>{" "}
              Contact your CA firm — they can issue you a new one.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <VeraxLogo size={22} showWordmark={false} />
          <span className="text-xs font-medium text-zinc-500">Powered by Verax</span>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-500">
          Are you a CA firm?{" "}
          <Link to="/login" className="font-semibold text-zinc-300 underline-offset-4 hover:underline">
            Sign in here →
          </Link>
        </p>
      </motion.div>
    </PortalFrame>
  );
};

export default ClientPortalLoginPage;
