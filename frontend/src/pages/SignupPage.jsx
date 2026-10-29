import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { useAuth } from "../contexts/AuthContext";
import { parseApiError } from "../lib/utils";
import { normalizeGstin, validateGstin } from "../lib/gstin";
import AuthLayout, { AuthButton, AuthCard, AuthError, AuthHeading, AuthLink } from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
import { collectFieldErrors } from "../components/auth/validation";
import { Tick } from "../components/marketing/ledger";
import { EASE } from "../components/public/motion";

/**
 * Firm signup — Mercury-style single card (see components/auth/AuthLayout).
 * The optional GSTIN sits behind an "Add" link so the required path is four
 * fields long.
 *
 * The fields are exactly the four the backend accepts — `auth.routes.js`'s
 * `signupSchema` is `{ name, firmName, email, password (min 8) }` — plus the
 * pre-existing optional GSTIN, which is validated locally and stripped server
 * side by the Joi `stripUnknown: true` in `validate.middleware.js`. Nothing was
 * added, nothing was made required. Submit goes through AuthContext's
 * signup() so the session is live before navigating to /dashboard.
 */

const legalLinkClass =
  "rounded font-medium text-carbon-900 underline decoration-carbon-300 underline-offset-[3px] transition-colors hover:decoration-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";

const signupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  firmName: z.string().min(2, "Firm name must be at least 2 characters"),
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters")
});

const SignupPage = () => {
  const { isAuthenticated, signup } = useAuth();
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
  const [showGstin, setShowGstin] = useState(false);
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
      await signup({
        ...validation.data,
        ...(gstinCheck.state === "valid" ? { gstin: normalizeGstin(form.gstin) } : {})
      });
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
          tone: gstinCheck.state === "valid" ? "valid" : gstinCheck.state === "incomplete" ? "neutral" : "invalid",
          message: gstinCheck.state === "valid" ? "Valid GSTIN" : gstinCheck.message
        };

  const passwordLongEnough = form.password.length >= 8;

  return (
    <AuthLayout topLink={{ to: "/login", label: "Log in" }} width="max-w-[480px]">
      <AuthCard
        footer={
          <p className="text-[13px] text-carbon-500">
            Already have an account? <AuthLink to="/login">Log in</AuthLink>
          </p>
        }
      >
        <AuthHeading
          title="Set up your firm"
          subtitle="A few details and you're in. No card needed while we're onboarding founding firms."
        />

        <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
          <AuthField
            id="signup-firm"
            label="Firm name"
            autoComplete="organization"
            autoFocus
            value={form.firmName}
            onChange={setField("firmName")}
            error={fieldErrors.firmName}
          />

          <div className="grid gap-4 sm:grid-cols-2">
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
          </div>

          <div>
            <AuthField
              id="signup-password"
              label="Password"
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={setField("password")}
              error={fieldErrors.password}
            />
            {!fieldErrors.password ? (
              <p
                className={`mt-1.5 flex items-center gap-1.5 text-[12.5px] transition-colors duration-200 ${
                  passwordLongEnough ? "text-verify-600" : "text-carbon-400"
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors duration-200 ${
                    passwordLongEnough ? "bg-verify-500 text-white" : "border border-carbon-300"
                  }`}
                >
                  {passwordLongEnough ? <Tick size={8} /> : null}
                </span>
                At least 8 characters
              </p>
            ) : null}
          </div>

          {/* Optional GSTIN, tucked away so the required path stays short */}
          <AnimatePresence initial={false} mode="wait">
            {showGstin || form.gstin || fieldErrors.gstin ? (
              <motion.div
                key="gstin"
                initial={reduced ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: EASE }}
                className="overflow-hidden"
              >
                <AuthField
                  id="signup-gstin"
                  label="Firm GSTIN · optional"
                  value={form.gstin}
                  maxLength={15}
                  mono
                  onChange={(event) => {
                    setForm((prev) => ({ ...prev, gstin: normalizeGstin(event.target.value) }));
                    setFieldErrors((prev) => (prev.gstin ? { ...prev, gstin: undefined } : prev));
                  }}
                  error={fieldErrors.gstin}
                  status={gstinStatus}
                  hint="Checked against the GSTIN checksum as you type."
                />
              </motion.div>
            ) : (
              <motion.button
                key="add-gstin"
                type="button"
                initial={false}
                exit={{ opacity: 0 }}
                onClick={() => setShowGstin(true)}
                className="inline-flex items-center gap-1.5 rounded text-[13px] font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
                Add your firm&apos;s GSTIN (optional)
              </motion.button>
            )}
          </AnimatePresence>

          <label className="flex cursor-pointer items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => {
                setAcceptedTerms(event.target.checked);
                if (event.target.checked) setError("");
              }}
              className="mt-[2px] h-4 w-4 flex-none cursor-pointer rounded-[4px] border-[#D6D5DE] text-brand-500 focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
            />
            <span className="text-[12.5px] leading-[1.55] text-carbon-500">
              {/* New tab, so opening the terms never throws away a half-filled form */}I agree to the{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className={legalLinkClass}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className={legalLinkClass}>
                Privacy Policy
              </a>
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
                <AuthError>{error}</AuthError>
              </motion.div>
            ) : null}
          </AnimatePresence>

          <div className="pt-2">
            <AuthButton loading={loading} loadingLabel="Creating account…">
              Create firm account
            </AuthButton>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

export default SignupPage;
