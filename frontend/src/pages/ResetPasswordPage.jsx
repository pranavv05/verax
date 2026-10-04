import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { linkErrorMessage, parseApiError } from "../lib/utils";
import AuthLayout, {
  AuthButton,
  AuthCard,
  AuthError,
  AuthHeading,
  AuthLink,
  AuthNotice
} from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
import { Tick } from "../components/marketing/ledger";
import { EASE } from "../components/public/motion";

/**
 * Reset password — on the shared auth card (components/auth/AuthLayout).
 *
 * Visual layer only: token validation on mount, the schema (min 8, must
 * match), `authApi.resetPassword` and the redirect to /login after success are
 * exactly as before.
 */

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your new password")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

const Reveal = ({ show, children }) => {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          initial={reduced ? false : { opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="overflow-hidden"
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

const ResetPasswordPage = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [tokenLoading, setTokenLoading] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;

    (async () => {
      setTokenLoading(true);
      setTokenError("");
      try {
        const result = await authApi.validatePasswordResetToken(token);
        if (active) {
          setTokenInfo(result);
        }
      } catch (validationError) {
        if (active) {
          setTokenError(linkErrorMessage(validationError, "This password reset link is invalid or has expired."));
        }
      } finally {
        if (active) {
          setTokenLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [token]);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setSuccess("");

    const validation = resetPasswordSchema.safeParse(form);
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Enter a valid new password");
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword({
        token,
        password: validation.data.password
      });
      setSuccess("Password updated. You can sign in with your new password.");
      window.setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to reset password"));
    } finally {
      setLoading(false);
    }
  };

  const setField = (key) => (event) => {
    const { value } = event.target;
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError("");
  };

  const longEnough = form.password.length >= 8;

  return (
    <AuthLayout topLink={{ to: "/login", label: "Log in" }}>
      <AuthCard
        footer={
          <p className="text-[13px] text-carbon-500">
            Link not working? <AuthLink to="/forgot-password">Request a new one</AuthLink>
          </p>
        }
      >
        <AuthHeading
          title="Create a new password"
          subtitle="Reset links expire in 15 minutes and stop working once used."
        />

        {tokenLoading ? (
          <div className="mt-7 space-y-4" role="status" aria-live="polite">
            <div className="h-10 w-full animate-pulse rounded-lg bg-carbon-900/[0.04]" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-carbon-900/[0.04]" />
            <div className="h-10 w-36 animate-pulse rounded-full bg-carbon-900/[0.06]" />
            <span className="sr-only">Validating reset link…</span>
          </div>
        ) : null}

        {tokenError ? (
          <div className="mt-7">
            <AuthError>{tokenError}</AuthError>
          </div>
        ) : null}

        {!tokenLoading && !tokenError ? (
          <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
            {tokenInfo?.email ? (
              <AuthNotice>
                Resetting the password for <span className="font-medium text-carbon-900">{tokenInfo.email}</span>
              </AuthNotice>
            ) : null}

            <div>
              <AuthField
                id="new-password"
                label="New password"
                type="password"
                autoComplete="new-password"
                autoFocus
                value={form.password}
                onChange={setField("password")}
              />
              <p
                className={`mt-1.5 flex items-center gap-1.5 text-[12.5px] transition-colors duration-200 ${
                  longEnough ? "text-verify-600" : "text-carbon-400"
                }`}
              >
                <span
                  className={`flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors duration-200 ${
                    longEnough ? "bg-verify-500 text-white" : "border border-carbon-300"
                  }`}
                >
                  {longEnough ? <Tick size={8} /> : null}
                </span>
                At least 8 characters
              </p>
            </div>

            <AuthField
              id="confirm-password"
              label="Confirm new password"
              type="password"
              autoComplete="new-password"
              value={form.confirmPassword}
              onChange={setField("confirmPassword")}
            />

            <Reveal show={Boolean(error)}>
              <AuthError>{error}</AuthError>
            </Reveal>

            <Reveal show={Boolean(success)}>
              <AuthNotice tone="success">{success}</AuthNotice>
            </Reveal>

            <div className="pt-2">
              <AuthButton loading={loading} loadingLabel="Updating password…">
                Update password
              </AuthButton>
            </div>
          </form>
        ) : null}
      </AuthCard>
    </AuthLayout>
  );
};

export default ResetPasswordPage;
