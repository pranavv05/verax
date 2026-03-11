import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/clients", label: "Clients" },
  { to: "/export", label: "Export" }
];

const AppShell = ({ title, subtitle, children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#e7dcc8] bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-ink-900 px-3 py-2 text-xs font-bold uppercase tracking-widest text-sand-50">
              CA Suite
            </div>
            <nav className="hidden gap-2 md:flex">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    cn(
                      "rounded-md px-3 py-2 text-sm font-semibold transition",
                      isActive
                        ? "bg-ink-900 text-white"
                        : "text-ink-700 hover:bg-sand-100 hover:text-ink-900"
                    )
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <div className="text-sm font-bold text-ink-900">{user?.name || "User"}</div>
              <div className="text-xs font-medium text-[#5f6f84]">{user?.email || ""}</div>
            </div>
            <button type="button" className="btn-secondary text-sm" disabled={loggingOut} onClick={onLogout}>
              {loggingOut ? "Signing out..." : "Logout"}
            </button>
          </div>
        </div>
        <div className="border-t border-[#eee3d2] md:hidden">
          <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 sm:px-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "whitespace-nowrap rounded-md px-3 py-2 text-xs font-semibold transition",
                    isActive
                      ? "bg-ink-900 text-white"
                      : "bg-sand-50 text-ink-700 hover:bg-sand-100"
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {(title || subtitle) && (
          <section className="mb-6">
            {title && <h1 className="text-2xl font-extrabold tracking-tight text-ink-900">{title}</h1>}
            {subtitle && <p className="mt-1 text-sm text-[#607086]">{subtitle}</p>}
          </section>
        )}
        {children}
      </main>
    </div>
  );
};

export default AppShell;
