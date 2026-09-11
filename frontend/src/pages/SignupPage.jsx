import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { authApi } from "../api/auth-api";
import { tokenStore, userStore } from "../lib/token-store";
import { parseApiError } from "../lib/utils";
import { normalizeGstin, validateGstin } from "../lib/gstin";
import AuthShell from "../components/auth/AuthShell";
import AuthField from "../components/auth/AuthField";
import { SignupPanel } from "../components/auth/AuthPanel";
import { collectFieldErrors } from "../components/auth/validation";
import { Caret, Eyebrow, Tick } from "../components/marketing/ledger";
import { EASE } from "../components/public/motion";

/**
 * Firm signup.
 *
 * The fields are exactly the four the backend accepts — `auth.routes.js`'s
 * `signupSchema` is `{ name, firmName, email, password (min 8) }` — plus the
 * pre-existing optional GSTIN, which is validated locally and stripped server
 * side by the Joi `stripUnknown: true` in `validate.middleware.js`. Nothing was
 * added, nothing was made required, and the submit path (authApi.signup →
 * tokenStore → userStore → /dashboard) is unchanged.
 */

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  firmName: z.string().min(2, "Firm name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const SignupPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();

  const [form, setForm] = useState({
    name: "",
    firmName: "",
    email: "",
    password: "",
    gstin: ""
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const gstinCheck = useMemo(() => validateGstin(form.gstin), [form.gstin]);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return; // belt-and-braces against a double submit
    setError("");
    setFieldErrors({});

    const validation = signupSchema.safeParse({
      name: form.name,
      firmName: form.firmName,
      email: form.email,
      password: form.password
    });
    if (!validation.success) {
      setFieldErrors(collectFieldErrors(validation.error));
      return;
    }

    // GSTIN is optional, but if one was typed it has to be a real one.
    if (gstinCheck.state === "invalid" || gstinCheck.state === "incomplete") {
      setFieldErrors({
        gstin: `${gstinCheck.message}. Clear the field to skip it.`
      });
      return;
    }

    if (!acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy to continue.");
      return;
    }

    setLoading(true);
    try {
      // `gstin` is sent for forward-compatibility. The backend's Joi signup
      // schema runs with `stripUnknown: true`, so today it is discarded server
      // side and the firm's GSTIN still has to be set from Settings.
      const result = await authApi.signup({
        ...validation.data,
        ...(gstinCheck.state === "valid" ? { gstin: normalizeGstin(form.gstin) } : {})
      });
      tokenStore.setAccessToken(result.accessToken);
      if (result.user) userStore.setUser(result.user);
      navigate("/dashboard", { replace: true });
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to create account"));
    } finally {
      setLoading(false);
    }
  };

  const setField = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const gstinStatus =
    gstinCheck.state === "empty" || fieldErrors.gstin
      ? null
      : {
          tone:
            gstinCheck.state === "valid"
              ? "valid"
              : gstinCheck.state === "incomplete"
                ? "neutral"
                : "invalid",
          message: gstinCheck.state === "valid" ? "Valid GSTIN" : gstinCheck.message
        };

  const enter = (delay) => ({
    initial: reduced ? false : { opacity: 0, y: 14 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, ease: EASE, delay: reduced ? 0 : delay }
  });

  return (
    <AuthShell panel={<SignupPanel />}>
      <motion.div {...enter(0)}>
        <Eyebrow>Founding customer plan</Eyebrow>
      </motion.div>

      <motion.h1
        {...enter(0.06)}
        className="mt-7 text-[2.25rem] font-bold leading-[1.05] tracking-[-0.04em] text-carbon-900 sm:text-[2.5rem]"
      >
        Set up your firm.
      </motion.h1>

      <motion.p {...enter(0.12)} className="mt-4 text-[1rem] leading-[1.65] text-carbon-500">
        Start turning financial documents into structured, review-ready data.
      </motion.p>

      <motion.form {...enter(0.18)} className="mt-10 space-y-5" onSubmit={onSubmit} noValidate>
        <AuthField
          id="signup-firm"
          label="Firm name"
          autoComplete="organization"
          value={form.firmName}
          onChange={setField("firmName")}
          error={fieldErrors.firmName}
        />

        <AuthField
          id="signup-name"
          label="Your full name"
          autoComplete="name"
          value={form.name}
          onChange={setField("name")}
          error={fieldErrors.name}
        />

        <AuthField
          id="signup-email"
          label="Work email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={form.email}
          onChange={setField("email")}
          error={fieldErrors.email}
        />

        <AuthField
          id="signup-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={setField("password")}
          error={fieldErrors.password}
          hint="Minimum 8 characters."
        />

        <AuthField
          id="signup-gstin"
          label="Firm GSTIN — optional"
          value={form.gstin}
          maxLength={15}
          mono
          onChange={(event) => {
            setForm((prev) => ({ ...prev, gstin: normalizeGstin(event.target.value) }));
            setFieldErrors((prev) => (prev.gstin ? { ...prev, gstin: undefined } : prev));
          }}
          error={fieldErrors.gstin}
          status={gstinStatus}
          hint="Checked locally against the GSTIN checksum — nothing is sent until you submit."
        />

        <label className="flex cursor-pointer items-start gap-3 pt-1">
          <input
            type="checkbox"
            checked={acceptedTerms}
            onChange={(event) => {
              setAcceptedTerms(event.target.checked);
              if (event.target.checked) setError("");
            }}
            className="mt-[3px] h-[17px] w-[17px] flex-none cursor-pointer rounded-[4px] border-hairline-strong
                       bg-surface text-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-offset-2
                       focus:ring-offset-canvas"
          />
          <span className="text-[0.8125rem] leading-[1.6] text-carbon-500">
            I agree to the{" "}
            <Link
              to="/security"
              className="rounded font-medium text-carbon-900 underline decoration-carbon-300 underline-offset-4 hover:decoration-carbon-900"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              to="/security"
              className="rounded font-medium text-carbon-900 underline decoration-carbon-300 underline-offset-4 hover:decoration-carbon-900"
            >
              Privacy Policy
            </Link>
            .
          </span>
        </label>

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
              Creating account…
            </>
          ) : (
            "Create firm account"
          )}
        </button>

        <p className="flex items-center justify-center gap-2 text-[0.75rem] text-carbon-400">
          <span className="text-verify-600">
            <Tick size={11} />
          </span>
          No card required while we&apos;re in the founding-customer phase.
        </p>
      </motion.form>

      <motion.div {...enter(0.26)} className="mt-10 border-t border-hairline pt-7">
        <p className="text-[0.875rem] text-carbon-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="rounded font-medium text-carbon-900 underline decoration-carbon-300
                       underline-offset-4 transition-colors hover:decoration-carbon-900
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                       focus-visible:ring-offset-4 focus-visible:ring-offset-canvas"
          >
            Log in
          </Link>
        </p>
      </motion.div>
    </AuthShell>
  );
};

export default SignupPage;
