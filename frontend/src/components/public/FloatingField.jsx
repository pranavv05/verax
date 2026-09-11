import { useState } from "react";

const EyeIcon = ({ off }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
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

/**
 * Text input with a floating label.
 *
 * The label animates purely with `peer-placeholder-shown` / `peer-focus`, which
 * means it stays correct for browser autofill and for values restored from
 * bfcache — no JS "has value" state to drift out of sync.
 */
const FloatingField = ({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  inputMode,
  hint,
  status,
  disabled = false,
  required = false,
  accent = "brand",
  maxLength
}) => {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  const focusRing =
    accent === "teal"
      ? "focus:border-teal-500 focus:ring-teal-500/10"
      : "focus:border-indigo-500 focus:ring-indigo-500/10";
  const focusLabel = accent === "teal" ? "peer-focus:text-teal-400" : "peer-focus:text-indigo-400";

  const statusTone = {
    valid: "text-verify-400",
    invalid: "text-red-400",
    neutral: "text-zinc-500"
  };

  return (
    <div>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={resolvedType}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          maxLength={maxLength}
          autoComplete={autoComplete}
          inputMode={inputMode}
          placeholder=" "
          className={`vx-field peer ${focusRing} ${isPassword ? "pr-12" : ""} ${
            disabled ? "cursor-not-allowed bg-black/[0.03] text-zinc-600" : ""
          }`}
        />
        <label htmlFor={id} className={`vx-field-label ${focusLabel}`}>
          {label}
        </label>

        {isPassword ? (
          <button
            type="button"
            onClick={() => setRevealed((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 transition hover:bg-black/5 hover:text-zinc-200"
            aria-label={revealed ? "Hide password" : "Show password"}
            tabIndex={-1}
          >
            <EyeIcon off={revealed} />
          </button>
        ) : null}
      </div>

      {status?.message ? (
        <p className={`mt-1.5 text-xs font-medium ${statusTone[status.tone] || statusTone.neutral}`}>
          {status.message}
        </p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-zinc-500">{hint}</p>
      ) : null}
    </div>
  );
};

export default FloatingField;
