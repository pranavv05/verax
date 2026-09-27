import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useClientPortalAuth } from "../../contexts/ClientPortalAuthContext";
import { AppThemeRoot, useAppTheme } from "../../contexts/ThemeContext";
import VeraxLogo from "../brand/VeraxLogo";
import { Avatar, PageHeader } from "../app/primitives";
import { IconFiles, IconHome, IconLogout, IconScale, IconSettings } from "../app/icons";
import { ThemeToggle } from "./AppShell";
import { cn } from "../../lib/utils";

/**
 * The client portal's frame. Same visual system as the firm app, but calmer:
 * a narrower column, larger type, four destinations, and the firm's name up
 * front so the client always knows whose portal this is.
 */

const navItems = [
  { to: "/client-portal/dashboard", label: "Home", icon: IconHome },
  { to: "/client-portal/documents", label: "Documents", icon: IconFiles },
  { to: "/client-portal/reconciliation", label: "GST summary", icon: IconScale },
  { to: "/client-portal/settings", label: "Settings", icon: IconSettings }
];

const ClientPortalShell = ({ title, subtitle, children }) => {
  const { clientName, firmName, logout } = useClientPortalAuth();
  const { resolved } = useAppTheme();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      navigate("/client-portal/login", { replace: true });
    }
  };

  return (
    <AppThemeRoot className="relative isolate flex flex-col">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[360px]"
        style={{
          background: [
            "radial-gradient(40% 60% at 15% 0%, rgb(102 87 217 / 0.09), transparent 70%)",
            "radial-gradient(35% 55% at 85% 0%, rgb(20 184 166 / 0.07), transparent 70%)"
          ].join(","),
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)"
        }}
      />

      <header className="sticky top-0 z-40 border-b border-ui-line/80 bg-ui-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/client-portal/dashboard" className="flex min-w-0 items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ui-accent">
            <VeraxLogo size={24} tone={resolved === "dark" ? "light" : "dark"} showWordmark={false} />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[0.9375rem] font-semibold text-ui-fg">{firmName || "Your accountant"}</span>
              <span className="block truncate text-xs text-ui-fg-3">Client portal{clientName ? ` · ${clientName}` : ""}</span>
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1.5">
            <ThemeToggle />
            <span className="hidden sm:block">
              <Avatar name={clientName} size={30} />
            </span>
            <button type="button" className="btn-ghost" onClick={onLogout} disabled={loggingOut}>
              <IconLogout size={15} />
              <span className="hidden sm:inline">{loggingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </div>

        <nav aria-label="Portal" className="mx-auto max-w-4xl overflow-x-auto px-4 sm:px-6">
          <div className="flex gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "relative flex shrink-0 items-center gap-2 px-3 pb-3 pt-1 text-[0.9375rem] font-medium outline-none transition-colors focus-visible:text-ui-fg",
                    isActive ? "text-ui-fg" : "text-ui-fg-3 hover:text-ui-fg"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} className={isActive ? "text-ui-accent-text" : ""} />
                    {label}
                    {isActive ? (
                      <motion.span
                        layoutId="vx-portal-nav-active"
                        aria-hidden="true"
                        className="absolute inset-x-2 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-brand-500 via-sky-500 to-verify-500"
                        transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                      />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="relative mx-auto w-full max-w-4xl flex-1 px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        {title ? <PageHeader title={title} description={subtitle} /> : null}
        {children}
      </main>

      <footer className="relative mx-auto w-full max-w-4xl border-t border-ui-line px-4 py-6 text-sm text-ui-fg-3 sm:px-6">
        Questions about your documents? Contact {firmName || "your CA firm"} directly.
        <span className="float-right hidden text-xs text-ui-fg-4 sm:inline">Secured by Verax</span>
      </footer>
    </AppThemeRoot>
  );
};

export default ClientPortalShell;
