import { useState } from "react";
import { Link } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { parseApiError } from "../lib/utils";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address")
});

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [devResetLink, setDevResetLink] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event) => {
    event.preventDefault();
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
        result?.message ||
          "If an account exists for that email, a password reset link will be available shortly."
      );
      if (result?.devResetLink) {
        setDevResetLink(result.devResetLink);
      }
    } catch (submitError) {
      setError(parseApiError(submitError, "Unable to request password reset"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="panel p-6 sm:p-8">
        <Link to="/" className="inline-block rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sand-100">
          Verax
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold text-ink-900">Reset your password</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter your account email. Reset links expire in 15 minutes and can be used once.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="label" htmlFor="reset-email">
              Email
            </label>
            <input
              id="reset-email"
              className="field"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="owner@firm.in"
            />
          </div>

          {error ? (
            <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-sm font-medium text-mint-700">
              {message}
            </div>
          ) : null}

          {devResetLink ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Development reset link:{" "}
              <a className="underline" href={devResetLink}>
                {devResetLink}
              </a>
            </div>
          ) : null}

          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
            {loading ? "Sending reset link..." : "Send reset link"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-500">
          Remembered your password?{" "}
          <Link className="font-semibold text-mint-500 underline transition hover:text-mint-600" to="/login">
            Back to login
          </Link>
        </p>
      </section>
    </div>
  );
};

export default ForgotPasswordPage;
