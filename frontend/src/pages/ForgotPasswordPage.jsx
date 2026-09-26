import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { parseApiError } from "../lib/utils";
import AuthLayout, {
  AuthButton,
  AuthCard,
  AuthError,
  AuthHeading,
  AuthLink,
  AuthNotice
} from "../components/auth/AuthLayout";
import AuthField from "../components/auth/AuthField";
import { EASE } from "../components/public/motion";

/**
 * Forgot password — on the shared auth card (components/auth/AuthLayout).
 *
 * Visual layer only: the schema, `authApi.forgotPassword`, the server's
 * message and the development-only reset link are exactly as before. The
 * 15-minute, single-use expiry in the subtitle matches
 * PASSWORD_RESET_TOKEN_TTL_MINUTES and the `used_at` check in auth.service.js.
 */

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address")
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

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;
    setError("");
    setMessage("");
    setDevResetLink("");

    const validation = forgotPasswordSchema.safeParse({ email });
    if (!validation.success) {
      setError(validation.error.issues[0]?.message || "Enter a valid email address");
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.forgotPassword(validation.data);
      setMessage(
        result?.message || "If an account exists for that email, a password reset link will be available shortly."
      );
      if (import.meta.env.DEV && result?.devResetLink) {
        setDevResetLink(result.devResetLink);
      }
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to request password reset"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout topLink={{ to: "/login", label: "Log in" }}>
      <AuthCard
        footer={
          <p className="text-[13px] text-carbon-500">
            Remembered it? <AuthLink to="/login">Back to log in</AuthLink>
          </p>
        }
      >
        <AuthHeading
          title="Reset your password"
          subtitle="Enter your account email. Reset links expire in 15 minutes and can be used once."
        />

        <form className="mt-7 space-y-4" onSubmit={onSubmit} noValidate>
          <AuthField
            id="reset-email"
            label="Work email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              if (error) setError("");
            }}
          />

          <Reveal show={Boolean(error)}>
            <AuthError>{error}</AuthError>
          </Reveal>

          <Reveal show={Boolean(message)}>
            <AuthNotice tone="success">{message}</AuthNotice>
          </Reveal>

          <Reveal show={Boolean(devResetLink)}>
            <AuthNotice tone="dev">
              Development reset link:{" "}
              <a className="underline underline-offset-2" href={devResetLink}>
                {devResetLink}
              </a>
            </AuthNotice>
          </Reveal>

          <div className="pt-2">
            <AuthButton loading={loading} loadingLabel="Sending reset link…">
              Send reset link
            </AuthButton>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
};

export default ForgotPasswordPage;
