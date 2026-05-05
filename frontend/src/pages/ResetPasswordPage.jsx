import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { authApi } from "../api/auth-api";
import { parseApiError } from "../lib/utils";

const resetPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm your new password")
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });

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
          setTokenError(parseApiError(validationError, "Password reset link is invalid or expired"));
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

  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-4 py-12 sm:px-6">
      <section className="panel p-6 sm:p-8">
        <Link to="/" className="inline-block rounded-xl bg-ink-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sand-100">
          Verax
        </Link>
        <h1 className="mt-6 text-2xl font-extrabold text-ink-900">Create a new password</h1>
        <p className="mt-1 text-sm text-ink-500">
          Reset links expire in 15 minutes and become invalid after use.
        </p>

        {tokenLoading ? (
          <div className="mt-6 rounded-xl border border-[#e7dcc8] bg-sand-50 px-3 py-2 text-sm font-medium text-ink-700">
            Validating reset link...
          </div>
        ) : null}

        {tokenError ? (
          <div className="mt-6 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
            {tokenError}
          </div>
        ) : null}

        {!tokenLoading && !tokenError ? (
          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            {tokenInfo?.email ? (
              <div className="rounded-xl border border-[#e7dcc8] bg-sand-50 px-3 py-2 text-xs font-medium text-ink-600">
                Resetting password for <span className="font-semibold text-ink-900">{tokenInfo.email}</span>
              </div>
            ) : null}

            <div>
              <label className="label" htmlFor="new-password">
                New password
              </label>
              <input
                id="new-password"
                className="field"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div>
              <label className="label" htmlFor="confirm-password">
                Confirm password
              </label>
              <input
                id="confirm-password"
                className="field"
                type="password"
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))
                }
                placeholder="Re-enter password"
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-mint-500/30 bg-mint-500/10 px-3 py-2 text-sm font-medium text-mint-700">
                {success}
              </div>
            ) : null}

            <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 text-sm">
              {loading ? "Updating password..." : "Update password"}
            </button>
          </form>
        ) : null}

        <p className="mt-5 text-center text-sm text-ink-500">
          <Link className="font-semibold text-mint-500 underline transition hover:text-mint-600" to="/login">
            Back to login
          </Link>
        </p>
      </section>
    </div>
  );
};

export default ResetPasswordPage;
