import { useState } from "react";
import { Caret, Tick } from "../marketing/ledger";

/**
 * The auth surface's text input, in the landing page's visual language.
 *
 * Deliberately *not* `components/public/FloatingField` — that component is
 * shared with the client-portal login, which is out of scope for this pass, so
 * restyling it would have redesigned a page nobody asked me to touch.
 *
 * Design notes:
 * - The label sits above the field as a small mono index, the same treatment
 *   section labels get on the marketing site. A floating label is a nice
 *   trick, but it hides the label the moment the field has content — on a form
 *   somebody fills once, legibility beats the trick.
 * - `mono` renders the *value* in IBM Plex Mono. On this site mono means "a
 *   machine reads this string", which is exactly true of a GSTIN.
 * - Validity is shown with the same Tick/Caret marks the product uses, so a
 *   valid GSTIN here looks like a valid GSTIN on a reviewed document.
 */

const EyeIcon = ({ off }) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    aria-hidden="true"
  >
    {off ? (
      <>
        <path strokeLinecap="round" d="M3 3l18 18" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.6 5.2A9.7 9.7 0 0112 5.1c5 0 9 4.4 10 6.9a14 14 0 01-2.8 3.9M6.4 6.9C4.4 8.3 2.7 10.3 2 12c1 2.5 5 6.9 10 6.9 1.6 0 3-.4 4.3-1.1"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.9 9.9a3 3 0 004.2 4.2" />
      </>
    ) : (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M2 12s3.6-6.9 10-6.9S22 12 22 12s-3.6 6.9-10 6.9S2 12 2 12z"
        />
        <circle cx="12" cy="12" r="3" />
      </>
    )}
  </svg>
);

const AuthField = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  autoComplete,
  inputMode,
  hint,
  error,
  status,
  action,
  mono = false,
  maxLength,
  disabled = false,
  required = false
}) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  const describedBy = error ? `${id}-error` : status?.message || hint ? `${id}-hint` : undefined;

  // "neutral" is the still-typing state (e.g. "7/15 characters") — it gets the
  // message but deliberately no border colour and no mark, so a field doesn't
  // flash a warning at somebody halfway through entering a GSTIN.
  const marked = status?.tone === "valid" || status?.tone === "invalid";

  const borderState = error
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/10"
    : status?.tone === "valid"
      ? "border-verify-400 focus:border-verify-500 focus:ring-verify-500/10"
      : "border-hairline focus:border-carbon-900 focus:ring-brand-500/12";

  const statusToneClass = {
    valid: "text-verify-600",
    invalid: "text-amber-600",
    neutral: "text-carbon-400"
  }[status?.tone] || "text-carbon-400";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="vx-index text-carbon-500">
          {label}
        </label>
        {action}
      </div>

      <div className="relative mt-2.5">
        <input
          id={id}
          name={id}
          type={resolvedType}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={`h-[3.25rem] w-full rounded-xl border bg-surface px-4 text-[0.9375rem] font-medium
                      text-carbon-900 outline-none transition-[border-color,box-shadow] duration-200
                      placeholder:text-carbon-300 focus:ring-4
                      disabled:cursor-not-allowed disabled:bg-well disabled:text-carbon-400
                      ${mono ? "vx-mono tracking-[0.02em]" : ""}
                      ${isPassword || marked ? "pr-12" : ""}
                      ${borderState}`}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-carbon-400
                       transition-colors hover:text-carbon-900 focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-brand-500"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            <EyeIcon off={revealed} />
          </button>
        ) : marked ? (
          <span
            aria-hidden="true"
            className={`absolute right-4 top-1/2 -translate-y-1/2 ${statusToneClass}`}
          >
            {status.tone === "valid" ? <Tick size={14} /> : <Caret size={14} />}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-2 text-[0.8125rem] font-medium text-red-600">
          {error}
        </p>
      ) : status?.message ? (
        <p id={`${id}-hint`} className={`mt-2 text-[0.8125rem] font-medium ${statusToneClass}`}>
          {status.message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-2 text-[0.8125rem] leading-[1.55] text-carbon-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default AuthField;
