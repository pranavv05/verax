/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "Helvetica Neue", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"],
        // Public/marketing surface only. Applied via `font-inter` on public page
        // roots so the authenticated dashboard keeps its existing Manrope type.
        inter: ["Inter", "-apple-system", "Segoe UI", "Helvetica Neue", "sans-serif"]
      },
      colors: {
        // --- Public-surface design system (V1, light-first) ------------------
        // Additive namespaces. The legacy ink/sand/mint/ember scales below are
        // still used by every authenticated dashboard page and are unchanged.
        //
        // `brand` is the V1 primary accent: indigo/violet (#6657D9 at 500),
        // reserved for CTAs and small emphasis marks — never a background wash.
        // 900/950 are kept at their original values (this scale predates the
        // V1 pass, from an earlier light-mode attempt that DemoRequestForm's
        // dormant `tone="light"` branch already depended on) since the brief
        // asked for them to be reused/extended rather than replaced.
        brand: {
          50: "#F3F1FC",
          100: "#E7E2F9",
          200: "#CFC5F2",
          300: "#B0A0E8",
          400: "#8C79E0",
          500: "#6657D9",
          600: "#5344B8",
          700: "#423593",
          800: "#332A72",
          900: "#22306E",
          950: "#161E43"
        },
        // Secondary accent: muted blue, used far more sparingly than `brand` —
        // links inside product mockups, secondary icons. Never a CTA fill.
        sky: {
          400: "#7CAEFF",
          500: "#4D8DFF",
          600: "#2E6FE0"
        },
        // --- V2 marketing surface ("The Ledger") ----------------------------
        // Near-black / deep charcoal. This is the V2 primary: it carries every
        // marketing headline (carbon-900) and every full-bleed contrast
        // section (carbon-950/900). It replaces `navy` on the marketing site —
        // `navy` stays exactly as-is because AuthSplitLayout still uses it.
        // Warm-neutral rather than blue-black so it sits correctly against the
        // ivory canvas instead of reading as a second, cooler palette.
        carbon: {
          950: "#08090B",
          900: "#0E1013",
          800: "#16181D",
          700: "#1F2229",
          600: "#2B2F38",
          500: "#3E434E",
          400: "#6B717D",
          300: "#9AA0AB",
          200: "#C8CCD3",
          100: "#E4E6EA"
        },
        // Deep navy, used ONLY as a full-bleed background for contrast
        // sections (e.g. the auth split panel) — never for text or borders on
        // the ivory canvas, and never a card fill on a light surface.
        navy: {
          950: "#0A0E1C",
          900: "#0D1224",
          800: "#11182D",
          700: "#182140",
          600: "#232C52"
        },
        // Neutral ramp for the V1 light system. Currently only consumed by
        // DemoRequestForm's `tone="light"` branch and the new marketing
        // primitives — `zinc` (below) remains the ramp the existing vx-*
        // component tree is wired to, retuned to the same values so both
        // read as one system without a mass rename of call sites.
        graphite: {
          25: "#FFFFFF",
          50: "#FBFAF7",
          100: "#F3F1EA",
          200: "#E5E3DD",
          300: "#C9C6BC",
          400: "#8D93A1",
          500: "#5F6675",
          600: "#454B59",
          700: "#333A47",
          800: "#1C2333",
          900: "#111827",
          950: "#0B0F19"
        },
        // Secondary / "verified, done, client-side". Retuned from emerald to the
        // design system's teal (#14B8A6) — `verify-*` is used only by the public
        // surface, never by the dashboard, so this shifts the whole marketing +
        // auth surface to the spec palette in one place.
        verify: {
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E"
        },
        ink: {
          900: "#10151F",
          800: "#1A2333",
          700: "#263245",
          600: "#354764",
          500: "#48607F"
        },
        sand: {
          50: "#FFFDF8",
          100: "#FFF5E5",
          200: "#FCE5B9",
          300: "#F5D08A"
        },
        mint: {
          400: "#34D399",
          500: "#2AA876",
          600: "#1F8A61"
        },
        ember: {
          400: "#F59E0B",
          500: "#D97706",
          600: "#B45309"
        },
        indigo: {
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5"
        },
        // Light public-surface tokens (V1). Additive — the dashboard's
        // `ink`/`sand`/`mint`/`ember` scale is untouched either way.
        // `canvas`/`surface`/`well`/`hairline*` have zero call sites outside
        // the public surface (verified by grep), so they're retuned in place
        // rather than renamed: canvas = warm ivory page background, surface =
        // white raised cards/mockups, well = recessed mockup chrome.
        canvas: "#F7F6F2",
        surface: "#FFFFFF",
        well: "#F0EEE7",
        hairline: "#E5E3DD",
        "hairline-strong": "#D6D2C6",

        // Text scale. `zinc-*` is used exclusively by the public surface (the
        // dashboard is on ink/graphite), so the ramp is retuned in place —
        // same three semantic roles as before, now for a light background:
        //   zinc-100 = Text/1 headlines (#111827), zinc-400 = Text/2 body
        //   (#5F6675), zinc-600 = Text/3 labels & muted (lightest of the three).
        // Values mirror the `graphite` ramp above so components on either
        // scale read as one system.
        zinc: {
          50: "#FFFFFF",
          100: "#111827",
          200: "#1F2937",
          300: "#3D4451",
          400: "#5F6675",
          500: "#7C8291",
          600: "#9BA0AB",
          700: "#C3C6CD",
          800: "#DEDFE3",
          900: "#EFEFF1",
          950: "#F7F7F8"
        }
      },
      spacing: {
        // The three long ends of the spacing scale that Tailwind lacks.
        30: "120px",
        50: "200px"
      },
      boxShadow: {
        soft: "0 12px 35px -18px rgba(16, 21, 31, 0.42)",
        glow: "0 0 20px -5px rgba(42, 168, 118, 0.3)",
        elevated: "0 20px 60px -20px rgba(16, 21, 31, 0.25), 0 8px 20px -10px rgba(16, 21, 31, 0.12)",
        glass: "0 8px 32px rgba(16, 21, 31, 0.08)",
        // Public-surface elevation: tight contact shadow + wide ambient falloff.
        card: "0 1px 2px rgba(10, 15, 26, 0.04), 0 8px 24px -12px rgba(10, 15, 26, 0.12)",
        lift: "0 2px 4px rgba(10, 15, 26, 0.04), 0 24px 48px -20px rgba(10, 15, 26, 0.22)",
        // Restrained CTA shadow, retuned to the V1 violet accent. Deliberately
        // a tight contact shadow rather than a diffuse bloom — a "glow" here
        // is exactly the AI-flashy effect the V1 brief rules out.
        brandGlow: "0 8px 20px -10px rgba(102, 87, 217, 0.38)"
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-20px)" }
        },
        "float-delayed": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-15px)" }
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        fadeInLeft: {
          "0%": { opacity: "0", transform: "translateX(-30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        fadeInRight: {
          "0%": { opacity: "0", transform: "translateX(30px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 20px -5px rgba(42, 168, 118, 0.3)" },
          "50%": { boxShadow: "0 0 30px -5px rgba(42, 168, 118, 0.5)" }
        },
        "gradient-shift": {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" }
        },
        "spin-slow": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" }
        }
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "float-delayed": "float-delayed 8s ease-in-out infinite",
        "fade-in-up": "fadeInUp 0.6s ease-out forwards",
        "fade-in-up-delay-1": "fadeInUp 0.6s ease-out 0.1s forwards",
        "fade-in-up-delay-2": "fadeInUp 0.6s ease-out 0.2s forwards",
        "fade-in-up-delay-3": "fadeInUp 0.6s ease-out 0.3s forwards",
        "fade-in-up-delay-4": "fadeInUp 0.6s ease-out 0.4s forwards",
        "fade-in-left": "fadeInLeft 0.6s ease-out forwards",
        "fade-in-right": "fadeInRight 0.6s ease-out forwards",
        "scale-in": "scaleIn 0.5s ease-out forwards",
        shimmer: "shimmer 2s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "gradient-shift": "gradient-shift 8s ease infinite",
        "spin-slow": "spin-slow 12s linear infinite"
      },
      backdropBlur: {
        xs: "2px"
      }
    }
  },
  plugins: []
};
