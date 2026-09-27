import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";

/**
 * Light / dark theme for the signed-in app (firm dashboard + client portal).
 *
 * The preference is "system", "light" or "dark" and is remembered per browser.
 * It is a convenience only, so storage failures (private windows, blocked site
 * data) fall back to following the OS. The public site never reads this.
 */

const STORAGE_KEY = "verax.app-theme";
const PREFERENCES = ["system", "light", "dark"];

const readPreference = () => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return PREFERENCES.includes(stored) ? stored : "system";
  } catch {
    return "system";
  }
};

const systemPrefersDark = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: dark)").matches;

const ThemeContext = createContext({
  preference: "system",
  resolved: "light",
  setPreference: () => {}
});

export const ThemeProvider = ({ children }) => {
  const [preference, setPreferenceState] = useState(readPreference);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event) => setSystemDark(event.matches);
    query.addEventListener?.("change", onChange);
    return () => query.removeEventListener?.("change", onChange);
  }, []);

  const setPreference = useCallback((next) => {
    if (!PREFERENCES.includes(next)) return;
    setPreferenceState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Remembering the choice is a nicety; the theme still applies this session.
    }
  }, []);

  const resolved = preference === "system" ? (systemDark ? "dark" : "light") : preference;

  const value = useMemo(
    () => ({ preference, resolved, setPreference }),
    [preference, resolved, setPreference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useAppTheme = () => useContext(ThemeContext);

/**
 * Root of every signed-in screen. Carries the theme tokens (`.vx-app`) and
 * mirrors the theme onto <html> so the page background, overscroll and native
 * controls match. Layout effect, so switching between two app pages never
 * paints a frame without it.
 */
export const AppThemeRoot = ({ className = "", children }) => {
  const { resolved } = useAppTheme();

  useLayoutEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-app-theme", resolved);
    return () => root.removeAttribute("data-app-theme");
  }, [resolved]);

  return (
    <div className={`vx-app min-h-screen ${className}`} data-theme={resolved}>
      {children}
    </div>
  );
};
