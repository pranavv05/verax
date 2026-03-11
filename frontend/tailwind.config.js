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
          700: "#263245"
        },
        sand: {
          50: "#FFFDF8",
          100: "#FFF5E5",
          200: "#FCE5B9"
        },
        mint: {
          500: "#2AA876",
          600: "#1F8A61"
        },
        ember: {
          500: "#D97706",
          600: "#B45309"
        }
      },
      boxShadow: {
        soft: "0 12px 35px -18px rgba(16, 21, 31, 0.42)"
      }
    }
  },
  plugins: []
};
