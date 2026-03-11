/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "Helvetica Neue", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "monospace"]
      },
      colors: {
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
        }
      },
      boxShadow: {
        soft: "0 12px 35px -18px rgba(16, 21, 31, 0.42)",
        glow: "0 0 20px -5px rgba(42, 168, 118, 0.3)",
        elevated: "0 20px 60px -20px rgba(16, 21, 31, 0.25), 0 8px 20px -10px rgba(16, 21, 31, 0.12)",
        glass: "0 8px 32px rgba(16, 21, 31, 0.08)"
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
