import { useId } from "react";

/**
 * Verax mark: two overlapping angular chevrons pointing right.
 *
 * The chevron is forward movement — a document advancing through the pipeline —
 * and simultaneously a tick rotated onto its side, which is verification, which
 * is what "verax" means. Two of them, offset and overlapping, say "stage after
 * stage": upload, understand, verify, reconcile, export.
 *
 * Left chevron is always the brand violet accent. The right chevron and the
 * overlap wash flip with `tone` so the mark stays legible on both surfaces the
 * V1 system uses: the ivory/white canvas (`tone="dark"`, default — a dark
 * navy right chevron) and the deep-navy contrast sections (`tone="light"` — a
 * light right chevron, as the mark originally shipped). The layering is drawn
 * as an explicit clipped path rather than a blend mode so it survives
 * anywhere blend modes get stripped (favicons, email, older Safari).
 *
 * The geometry here is identical to public/verax-icon.svg — the static SVG
 * still encodes the pre-V1 dark-canvas coloring and should be regenerated to
 * match `tone="dark"` before it ships anywhere on the light surface (og:image,
 * favicon chrome is browser-drawn so it's lower priority).
 */
const markTone = {
  dark: "#111827", // right chevron on the ivory/white canvas (default, V1)
  light: "#F7F6F2" // right chevron on a deep-navy contrast section
};

export const VeraxMark = ({ size = 32, tone = "dark", className = "" }) => {
  const clipId = useId();
  const rightFill = markTone[tone] || markTone.dark;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={clipId}>
          <path d="M10 5 19.5 16 10 27 4 27 13.5 16 4 5Z" />
        </clipPath>
      </defs>

      <path d="M10 5 19.5 16 10 27 4 27 13.5 16 4 5Z" fill="#6657D9" />
      <path d="M18.5 5 28 16 18.5 27 12.5 27 22 16 12.5 5Z" fill={rightFill} />

      <g clipPath={`url(#${clipId})`}>
        <path
          d="M18.5 5 28 16 18.5 27 12.5 27 22 16 12.5 5Z"
          fill="#6657D9"
          fillOpacity="0.6"
        />
      </g>
    </svg>
  );
};

const wordmarkTone = {
  dark: "text-[#111827]",
  light: "text-[#F7F6F2]"
};

/**
 * Full lockup. `tone` controls both the mark's right chevron and the
 * wordmark colour, so a single prop keeps them in sync:
 *   dark  -> for light backgrounds (default — every public page is
 *            light-first under V1)
 *   light -> for the deep-navy contrast sections (e.g. AuthSplitLayout's
 *            brand panel)
 *
 * `size` is the mark's box height; at the intended size of 32 the lockup is
 * 32px tall overall.
 */
const VeraxLogo = ({ size = 32, tone = "dark", className = "", showWordmark = true }) => (
  <span
    className={`inline-flex items-center ${className}`}
    style={{ gap: `${Math.round(size * 0.28)}px` }}
  >
    <VeraxMark size={size} tone={tone} />
    {showWordmark ? (
      <span
        className={`font-inter font-bold tracking-[-0.02em] ${
          wordmarkTone[tone] || wordmarkTone.dark
        }`}
        style={{ fontSize: `${Math.round(size * 0.69)}px`, lineHeight: 1 }}
      >
        Verax
      </span>
    ) : null}
  </span>
);

export default VeraxLogo;
