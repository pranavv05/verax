import { useState } from "react";
import { Caret, Tick } from "../marketing/ledger";

/**
 * The auth surface's text input, after Mercury's sign-in fields: a small
 * regular-weight label above; a soft grey-filled input that turns white with
 * a crisp violet ring on focus; the password reveal as its own segment at the
 * right edge of the field.
 *
 * - `mono` renders the value in IBM Plex Mono — on this site mono means "a
 *   machine reads this string", which is exactly true of a GSTIN.
 * - Validity uses the product's Tick/Caret marks, so a valid GSTIN here looks
 *   like a valid GSTIN on a reviewed document.
 * - `status.tone === "neutral"` is the still-typing state: message, no colour.
 */

const EyeIcon = ({ off }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
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
        <path strokeLinecap="round" strokeLinejoin="round" d="M2 12s3.6-6.9 10-6.9S22 12 22 12s-3.6 6.9-10 6.9S2 12 2 12z" />
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
  required = false,
  autoFocus = false
}) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  const describedBy = error ? `${id}-error` : status?.message || hint ? `${id}-hint` : undefined;
  const marked = status?.tone === "valid" || status?.tone === "invalid";

  const frame = error
    ? "border-red-300 bg-white focus-within:border-red-500 focus-within:ring-red-500/15"
    : status?.tone === "valid"
      ? "border-verify-400 bg-white focus-within:ring-verify-500/15"
      : "border-[#E4E3EA] bg-[#F7F7FA] hover:border-[#D6D5DE] focus-within:border-brand-500 focus-within:bg-white focus-within:ring-brand-500/15";

  const statusToneClass =
    { valid: "text-verify-600", invalid: "text-amber-600", neutral: "text-carbon-400" }[status?.tone] ||
    "text-carbon-400";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-[13px] font-medium text-carbon-700">
          {label}
        </label>
        {action}
      </div>

      <div
        className={`mt-1.5 flex h-10 items-stretch overflow-hidden rounded-lg border transition-[border-color,background-color,box-shadow] duration-150 focus-within:ring-[3px] ${frame}`}
      >
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
          autoFocus={autoFocus}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={`min-w-0 flex-1 bg-transparent px-3 text-[14px] text-carbon-900 outline-none placeholder:text-carbon-300 disabled:cursor-not-allowed disabled:text-carbon-400 ${
            mono ? "vx-mono tracking-[0.02em]" : ""
          }`}
        />

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="flex w-10 flex-none items-center justify-center border-l border-[#E4E3EA] text-carbon-400 transition-colors hover:bg-carbon-900/[0.03] hover:text-carbon-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500"
            aria-label={revealed ? "Hide password" : "Show password"}
          >
            <EyeIcon off={revealed} />
          </button>
        ) : marked ? (
          <span aria-hidden="true" className={`flex w-10 flex-none items-center justify-center ${statusToneClass}`}>
            {status.tone === "valid" ? <Tick size={14} /> : <Caret size={14} />}
          </span>
        ) : null}
      </div>

      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[12.5px] text-red-600">
          {error}
        </p>
      ) : status?.message ? (
        <p id={`${id}-hint`} className={`mt-1.5 text-[12.5px] ${statusToneClass}`}>
          {status.message}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-[12.5px] leading-[1.5] text-carbon-400">
          {hint}
        </p>
      ) : null}
    </div>
  );
};

export default AuthField;
