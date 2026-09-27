import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useAuth } from "../../contexts/AuthContext";
import { AppThemeRoot, useAppTheme } from "../../contexts/ThemeContext";
import { notificationsApi } from "../../api/notifications-api";
import { firmsApi } from "../../api/firms-api";
import { cn } from "../../lib/utils";
import { isAdmin } from "../../utils/permissions";
import VeraxLogo from "../brand/VeraxLogo";
import { Avatar, PageHeader } from "../app/primitives";
import {
  IconAudit,
  IconBell,
  IconClose,
  IconExport,
  IconHome,
  IconLogout,
  IconMenu,
  IconMonitor,
  IconMoon,
  IconSettings,
  IconSun,
  IconTools,
  IconUsers
} from "../app/icons";

/**
 * The signed-in firm app's frame. A top bar in the landing page's language —
 * the same logo, the same gliding hover pill, the same frosted canvas — at app
 * height, with the firm, notifications, theme and account on the right.
 */

const EASE = [0.16, 1, 0.3, 1];

const primaryNav = [
  { to: "/dashboard", label: "Overview", icon: IconHome, match: ["/dashboard"] },
  {
    to: "/clients",
    label: "Clients",
    icon: IconUsers,
    match: ["/clients", "/documents", "/review"]
  },
  { to: "/export", label: "Export", icon: IconExport, match: ["/export"] },
  { to: "/tools", label: "Tools", icon: IconTools, match: ["/tools"] },
  { to: "/team", label: "Team", icon: IconUsers, match: ["/team"] }
];

const accountNav = (user) =>
  [
    { to: "/settings", label: "Settings", icon: IconSettings },
    isAdmin(user) ? { to: "/audit-logs", label: "Audit log", icon: IconAudit } : null
  ].filter(Boolean);

const isActivePath = (pathname, item) =>
  item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

// The firm name only changes from Settings, so one fetch per session is
// enough; Settings dispatches `vx-firm-updated` after a rename.
let firmCache = null;

const useFirm = () => {
  const [firm, setFirm] = useState(firmCache);

  useEffect(() => {
    let active = true;
    if (!firmCache) {
      firmsApi
        .getSettings()
        .then((result) => {
          firmCache = result;
          if (active) setFirm(result);
        })
        .catch(() => {});
    }
    const onUpdated = (event) => {
      firmCache = event.detail || firmCache;
      setFirm(firmCache);
    };
    window.addEventListener("vx-firm-updated", onUpdated);
    return () => {
      active = false;
      window.removeEventListener("vx-firm-updated", onUpdated);
    };
  }, []);

  return firm;
};

/** Close a popover on outside click or Escape, returning focus to its trigger. */
const useDismiss = (open, setOpen, containerRef, triggerRef) => {
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, containerRef, triggerRef]);
};

const popoverMotion = (reduced) => ({
  initial: reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: reduced ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 },
  transition: { duration: 0.18, ease: EASE }
});

const relativeTime = (value) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const notificationPath = (notification) => {
  if (notification.entityType === "document" && notification.entityId) {
    return `/documents/${notification.entityId}/review`;
  }
  if (notification.entityType === "export") return "/export";
  if (notification.entityType === "client" && notification.entityId) {
    return `/clients/${notification.entityId}`;
  }
  return null;
};

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

const NotificationsMenu = () => {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  useDismiss(open, setOpen, containerRef, triggerRef);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await notificationsApi.list({ unreadOnly: false });
      setNotifications(result.notifications || []);
      setUnreadCount(Number(result.unreadCount || 0));
    } catch {
      setNotifications([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const intervalId = window.setInterval(load, 30000);
    return () => window.clearInterval(intervalId);
  }, [load]);

  const onSelect = async (notification) => {
    try {
      await notificationsApi.markRead(notification.id);
    } catch {
      // Navigation still happens even if marking read fails.
    }
    setOpen(false);
    load();
    const path = notificationPath(notification);
    if (path) navigate(path);
  };

  const onMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      await load();
    } catch {
      // Keep the menu usable if the refresh fails.
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="btn-icon relative h-9 w-9 rounded-full"
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <IconBell size={17} />
        {unreadCount > 0 ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ui-accent px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-ui-canvas">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            {...popoverMotion(reduced)}
            role="dialog"
            aria-label="Notifications"
            className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] origin-top-right overflow-hidden rounded-xl border border-ui-line bg-ui-raised shadow-ui-pop"
          >
            <div className="flex items-center justify-between border-b border-ui-line px-4 py-3">
              <p className="text-[0.8125rem] font-semibold text-ui-fg">Notifications</p>
              {unreadCount > 0 ? (
                <button type="button" className="link-action text-xs" onClick={onMarkAllRead}>
                  Mark all as read
                </button>
              ) : null}
            </div>

            <div className="max-h-[26rem] overflow-y-auto p-1">
              {loading && notifications.length === 0 ? (
                <p className="px-3 py-8 text-center text-[0.8125rem] text-ui-fg-3">Loading…</p>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-ui-line bg-ui-subtle text-ui-fg-3">
                    <IconBell size={16} />
                  </span>
                  <p className="text-[0.8125rem] font-medium text-ui-fg-2">You're all caught up</p>
                  <p className="text-xs text-ui-fg-3">Processing results and exports will show up here.</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => onSelect(notification)}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left outline-none transition-colors hover:bg-ui-inset focus-visible:bg-ui-inset"
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                        notification.read ? "bg-transparent" : "bg-ui-accent"
                      )}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            "truncate text-[0.8125rem]",
                            notification.read ? "font-medium text-ui-fg-2" : "font-semibold text-ui-fg"
                          )}
                        >
                          {notification.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-ui-fg-4">{relativeTime(notification.createdAt)}</span>
                      </span>
                      <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-ui-fg-3">
                        {notification.message}
                      </span>
                    </span>
                  </button>
                ))
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Theme
// ---------------------------------------------------------------------------

const THEME_OPTIONS = [
  { value: "system", label: "System", icon: IconMonitor },
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon }
];

/** Three-way theme switch, used inside the account menu and mobile sheet. */
export const ThemeSwitch = ({ className = "" }) => {
  const { preference, setPreference } = useAppTheme();
  return (
    <div role="radiogroup" aria-label="Theme" className={cn("flex items-center gap-0.5 rounded-full border border-ui-line bg-ui-inset p-0.5", className)}>
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ui-accent",
              active ? "bg-ui-surface text-ui-fg shadow-ui-card" : "text-ui-fg-3 hover:text-ui-fg-2"
            )}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
};

/** One-click light/dark flip for the top bar. */
export const ThemeToggle = () => {
  const { resolved, setPreference } = useAppTheme();
  const next = resolved === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className="btn-icon h-9 w-9 rounded-full"
      onClick={() => setPreference(next)}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
    >
      {resolved === "dark" ? <IconSun size={17} /> : <IconMoon size={16} />}
    </button>
  );
};

// ---------------------------------------------------------------------------
// Account
// ---------------------------------------------------------------------------

const AccountMenu = ({ user, firm, onLogout, loggingOut }) => {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  useDismiss(open, setOpen, containerRef, triggerRef);

  const menuItemClass =
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[0.8125rem] font-medium text-ui-fg-2 outline-none transition-colors hover:bg-ui-inset hover:text-ui-fg focus-visible:bg-ui-inset focus-visible:text-ui-fg";

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center rounded-full outline-none ring-offset-2 ring-offset-ui-canvas transition focus-visible:ring-2 focus-visible:ring-ui-accent"
      >
        <Avatar name={user?.name} size={30} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            {...popoverMotion(reduced)}
            role="menu"
            className="absolute right-0 z-50 mt-2 w-64 origin-top-right overflow-hidden rounded-xl border border-ui-line bg-ui-raised shadow-ui-pop"
          >
            <div className="flex items-center gap-3 border-b border-ui-line px-3.5 py-3">
              <Avatar name={user?.name} size={34} />
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-semibold text-ui-fg">{user?.name || "User"}</p>
                <p className="truncate text-xs text-ui-fg-3">{user?.email}</p>
              </div>
            </div>

            <div className="p-1">
              {firm?.name ? (
                <div className="flex items-center justify-between gap-2 px-2.5 py-2 text-xs text-ui-fg-3">
                  <span className="truncate">{firm.name}</span>
                  <span className="shrink-0 rounded-full border border-ui-line px-1.5 py-px text-[10px] font-medium capitalize text-ui-fg-3">
                    {user?.role || "staff"}
                  </span>
                </div>
              ) : null}
              {accountNav(user).map(({ to, label, icon: Icon }) => (
                <Link key={to} to={to} role="menuitem" className={menuItemClass} onClick={() => setOpen(false)}>
                  <Icon size={15} className="text-ui-fg-3" />
                  {label}
                </Link>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-ui-line px-3.5 py-2.5">
              <span className="text-[0.8125rem] font-medium text-ui-fg-2">Theme</span>
              <ThemeSwitch className="w-[7.5rem]" />
            </div>

            <div className="border-t border-ui-line p-1">
              <button type="button" role="menuitem" className={menuItemClass} onClick={onLogout} disabled={loggingOut}>
                <IconLogout size={15} className="text-ui-fg-3" />
                {loggingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

const AppShell = ({ title, subtitle, actions, breadcrumbs, width = "default", children }) => {
  const { user, logout } = useAuth();
  const { resolved } = useAppTheme();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const reduced = useReducedMotion();
  const firm = useFirm();
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hovered, setHovered] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const onLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  };

  const containerWidth = width === "wide" ? "max-w-[1440px]" : "max-w-[1200px]";

  return (
    <AppThemeRoot className="relative isolate">
      {/* The landing page's colour field, reduced to a faint wash behind the page head. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-80 dark:opacity-100"
        style={{
          background: [
            "radial-gradient(38% 60% at 12% 0%, rgb(102 87 217 / 0.09), transparent 70%)",
            "radial-gradient(32% 55% at 88% 0%, rgb(77 141 255 / 0.08), transparent 70%)",
            "radial-gradient(30% 45% at 55% 0%, rgb(20 184 166 / 0.05), transparent 70%)"
          ].join(","),
          maskImage: "linear-gradient(to bottom, black, transparent)",
          WebkitMaskImage: "linear-gradient(to bottom, black, transparent)"
        }}
      />

      <header
        className={cn(
          "sticky top-0 z-40 border-b backdrop-blur-xl transition-[background-color,border-color,box-shadow] duration-300",
          scrolled
            ? "border-ui-line bg-ui-canvas/80 shadow-[0_8px_24px_-20px_rgba(14,16,19,0.35)]"
            : "border-ui-line/70 bg-ui-canvas/60"
        )}
      >
        <div className={cn("mx-auto flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8", containerWidth)}>
          <div className="flex min-w-0 items-center gap-2.5">
            <Link
              to="/dashboard"
              aria-label="Verax — overview"
              className="shrink-0 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ui-accent focus-visible:ring-offset-4 focus-visible:ring-offset-ui-canvas"
            >
              <VeraxLogo size={24} tone={resolved === "dark" ? "light" : "dark"} />
            </Link>
            {firm?.name ? (
              <>
                <span aria-hidden="true" className="hidden text-lg font-light text-ui-line-strong sm:block">
                  /
                </span>
                <Link
                  to="/settings"
                  className="hidden min-w-0 items-center gap-2 rounded-full px-2 py-1 text-[0.8125rem] font-medium text-ui-fg-2 outline-none transition-colors hover:bg-ui-inset hover:text-ui-fg focus-visible:ring-2 focus-visible:ring-ui-accent sm:flex"
                  title="Firm settings"
                >
                  <span className="max-w-[12rem] truncate">{firm.name}</span>
                  {firm.plan ? (
                    <span className="rounded-full border border-ui-line bg-ui-surface px-1.5 py-px text-[10px] font-medium capitalize text-ui-fg-3">
                      {firm.plan}
                    </span>
                  ) : null}
                </Link>
              </>
            ) : null}
          </div>

          <nav aria-label="Main" className="ml-3 hidden items-center lg:flex" onMouseLeave={() => setHovered(null)}>
            {primaryNav.map((item) => {
              const active = isActivePath(pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onMouseEnter={() => setHovered(item.to)}
                  onFocus={() => setHovered(item.to)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative isolate rounded-full px-3 py-1.5 text-[0.8125rem] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ui-accent",
                    active ? "text-ui-fg" : "text-ui-fg-3 hover:text-ui-fg"
                  )}
                >
                  {hovered === item.to ? (
                    <motion.span
                      layoutId="vx-app-nav-pill"
                      aria-hidden="true"
                      className="absolute inset-0 -z-10 rounded-full bg-ui-fg/[0.055]"
                      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36 }}
                    />
                  ) : null}
                  {item.label}
                  {active ? (
                    <motion.span
                      layoutId="vx-app-nav-active"
                      aria-hidden="true"
                      className="absolute inset-x-3 -bottom-[11px] h-[2px] rounded-full bg-gradient-to-r from-brand-500 via-sky-500 to-verify-500"
                      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 34 }}
                    />
                  ) : null}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <NotificationsMenu />
            <div className="ml-1.5 hidden lg:block">
              <AccountMenu user={user} firm={firm} onLogout={onLogout} loggingOut={loggingOut} />
            </div>
            <button
              type="button"
              className="btn-icon h-9 w-9 rounded-full lg:hidden"
              onClick={() => setMobileOpen((prev) => !prev)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <IconClose size={18} /> : <IconMenu size={18} />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen ? (
            <motion.div
              initial={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: EASE }}
              className="overflow-hidden border-t border-ui-line bg-ui-canvas/95 lg:hidden"
            >
              <nav aria-label="Main" className="mx-auto flex max-w-[1200px] flex-col gap-0.5 px-4 py-3 sm:px-6">
                {[...primaryNav, ...accountNav(user).map((item) => ({ ...item, match: [item.to] }))].map((item) => {
                  const active = isActivePath(pathname, item);
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-ui-surface text-ui-fg shadow-ui-card" : "text-ui-fg-2 hover:bg-ui-inset"
                      )}
                    >
                      <Icon size={16} className={active ? "text-ui-accent-text" : "text-ui-fg-3"} />
                      {item.label}
                    </NavLink>
                  );
                })}
                <div className="mt-2 flex items-center justify-between gap-3 border-t border-ui-line px-3 pt-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={user?.name} size={28} />
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-medium text-ui-fg">{user?.name}</p>
                      <p className="truncate text-xs text-ui-fg-3">{user?.email}</p>
                    </div>
                  </div>
                  <ThemeSwitch className="w-[7.5rem] shrink-0" />
                </div>
                <button type="button" onClick={onLogout} disabled={loggingOut} className="btn-secondary mt-3 w-full">
                  <IconLogout size={15} />
                  {loggingOut ? "Signing out…" : "Sign out"}
                </button>
              </nav>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </header>

      <main className={cn("relative mx-auto px-4 pb-16 pt-7 sm:px-6 sm:pt-9 lg:px-8", containerWidth)}>
        {title || subtitle ? (
          <PageHeader title={title} description={subtitle} actions={actions} breadcrumbs={breadcrumbs} />
        ) : null}
        {children}
      </main>
    </AppThemeRoot>
  );
};

export default AppShell;

