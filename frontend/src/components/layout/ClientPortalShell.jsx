import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useClientPortalAuth } from "../../contexts/ClientPortalAuthContext";

const navItems = [
  ["/client-portal/dashboard", "Home"],
  ["/client-portal/documents", "Documents"],
  ["/client-portal/reconciliation", "GST Summary"],
  ["/client-portal/settings", "Settings"]
];

const navLinkClass = ({ isActive }) =>
  `rounded-lg px-3 py-2 text-base font-semibold transition ${
    isActive ? "bg-ink-900 text-white" : "text-ink-700 hover:bg-sand-100"
  }`;

const ClientPortalShell = ({ title, subtitle, children }) => {
  const { clientName, firmName, logout } = useClientPortalAuth();
  const navigate = useNavigate();
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
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-40 border-b border-[#e7dcc8] bg-white">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <p className="text-sm font-extrabold uppercase tracking-widest text-ink-900">Verax</p>
            <p className="truncate text-sm text-[#607086]">
              {clientName}
              {firmName ? ` · ${firmName}` : ""}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary px-3 py-2 text-sm"
            onClick={onLogout}
            disabled={loggingOut}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </button>
        </div>

        <nav className="mx-auto max-w-4xl overflow-x-auto px-4 pb-3 sm:px-6">
          <div className="flex gap-2">
            {navItems.map(([to, label]) => (
              <NavLink key={to} to={to} className={navLinkClass}>
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        {title ? (
          <div className="mb-6">
            <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-base text-[#607086]">{subtitle}</p> : null}
          </div>
        ) : null}
        {children}
      </main>

      <footer className="mx-auto max-w-4xl px-4 pb-10 text-sm text-[#7f8a99] sm:px-6">
        Questions about your documents? Contact {firmName || "your CA firm"} directly.
      </footer>
    </div>
  );
};

export default ClientPortalShell;
