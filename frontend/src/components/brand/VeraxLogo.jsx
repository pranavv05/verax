/**
 * Verax wordmark — V3 rebrand (2026-09-22, Stripe/Mercury-inspired).
 *
 * No icon mark. The V1/V2 chevron pair is retired: Instrument Serif italic
 * set as a confident, editorial wordmark IS the brand — the same move
 * Mercury, Ramp and most premium 2024-25 fintech SaaS brands make, rather
 * than pairing a wordmark with a separate abstract glyph that has to be
 * explained. One less thing to render small and blurry in a nav bar.
 *
 * `tone="dark"` (default) is near-black text for the white/light canvas
 * every public page uses. `tone="light"` is for the rare full-bleed dark
 * section (e.g. AuthSplitLayout's brand panel).
 */
const wordmarkTone = {
  dark: "text-carbon-900",
  light: "text-white"
};

const VeraxLogo = ({ size = 32, tone = "dark", className = "" }) => (
  <span
    className={`inline-flex items-center font-serif italic ${wordmarkTone[tone] || wordmarkTone.dark} ${className}`}
    style={{ fontSize: `${Math.round(size * 1.05)}px`, lineHeight: 1, letterSpacing: "-0.01em" }}
  >
    Verax
  </span>
);

export default VeraxLogo;
