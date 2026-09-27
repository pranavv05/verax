/**
 * The signed-in app's icon set: 16px-grid line icons at a 1.6 stroke, drawn to
 * sit on the same optical weight as Inter at 13–14px. Every icon inherits
 * `currentColor` and is decorative (aria-hidden) — pair it with visible text
 * or an aria-label on the control.
 */
const Svg = ({ size = 16, className = "", strokeWidth = 1.6, children, ...rest }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    className={`shrink-0 ${className}`}
    {...rest}
  >
    {children}
  </svg>
);

export const IconHome = (p) => (
  <Svg {...p}>
    <path d="M3.5 10.5 12 4l8.5 6.5" />
    <path d="M5.5 9v10.5h13V9" />
    <path d="M10 19.5v-5h4v5" />
  </Svg>
);

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.25" />
    <path d="M3 19.5c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
    <path d="M15.5 5.6a3.25 3.25 0 0 1 0 5.8" />
    <path d="M17.5 14.8c1.8.6 3 2.2 3.5 4.7" />
  </Svg>
);

export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Svg>
);

export const IconExport = (p) => (
  <Svg {...p}>
    <path d="M12 4v11" />
    <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
    <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </Svg>
);

export const IconUpload = (p) => (
  <Svg {...p}>
    <path d="M12 15.5v-11" />
    <path d="m7.5 9 4.5-4.5L16.5 9" />
    <path d="M4.5 15.5v3a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </Svg>
);

export const IconTools = (p) => (
  <Svg {...p}>
    <path d="M14.5 6.5a4 4 0 0 0 5 5l-8.8 8.8a2.1 2.1 0 0 1-3-3l8.8-8.8" />
    <path d="M14.5 6.5 17 4l3 3-2.5 2.5" />
  </Svg>
);

export const IconSettings = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Svg>
);

export const IconAudit = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6l-7-2.5Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
);

export const IconBell = (p) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="3.75" />
    <path d="M12 2.75v1.5M12 19.75v1.5M4.75 12h-1.5M20.75 12h-1.5M6.9 6.9 5.8 5.8M18.2 18.2l-1.1-1.1M6.9 17.1l-1.1 1.1M18.2 5.8l-1.1 1.1" />
  </Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}>
    <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10Z" />
  </Svg>
);

export const IconMonitor = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="11.5" rx="1.75" />
    <path d="M9 20h6M12 16v4" />
  </Svg>
);

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M14 4.5h3.5A1.5 1.5 0 0 1 19 6v12a1.5 1.5 0 0 1-1.5 1.5H14" />
    <path d="M10 16.5 5.5 12 10 7.5M5.5 12H15" />
  </Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="m9.5 6 6 6-6 6" />
  </Svg>
);

export const IconChevronLeft = (p) => (
  <Svg {...p}>
    <path d="m14.5 6-6 6 6 6" />
  </Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Svg>
);

export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M5 12h14M13.5 6.5 19 12l-5.5 5.5" />
  </Svg>
);

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M19 12H5M10.5 6.5 5 12l5.5 5.5" />
  </Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2" />
  </Svg>
);

export const IconFile = (p) => (
  <Svg {...p}>
    <path d="M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5l-5-5Z" />
    <path d="M13.5 3.5v5h5" />
  </Svg>
);

export const IconFiles = (p) => (
  <Svg {...p}>
    <path d="M15 3.5H9.5A1.5 1.5 0 0 0 8 5v11a1.5 1.5 0 0 0 1.5 1.5h8A1.5 1.5 0 0 0 19 16V7.5l-4-4Z" />
    <path d="M15 3.5v4h4" />
    <path d="M5 7.5v12A1.5 1.5 0 0 0 6.5 21H15" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconCheckCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.5 12.3 2.4 2.4 4.6-4.9" />
  </Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M10.3 4.3 2.9 17.2A2 2 0 0 0 4.6 20h14.8a2 2 0 0 0 1.7-2.8L13.7 4.3a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.5v4M12 16.8v.2" />
  </Svg>
);

export const IconInfo = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 7.8v.2" />
  </Svg>
);

export const IconXCircle = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconRefresh = (p) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 0 1-13 5.1" />
    <path d="M4.5 12a7.5 7.5 0 0 1 13-5.1" />
    <path d="M17.5 3.5v3.4h-3.4M6.5 20.5v-3.4h3.4" />
  </Svg>
);

export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Svg>
);

export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.75" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);

export const IconCopy = (p) => (
  <Svg {...p}>
    <rect x="8.5" y="8.5" width="11" height="11" rx="1.75" />
    <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
  </Svg>
);

export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15M9.5 6.5V4.5h5v2" />
    <path d="M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5l.8-12.5" />
  </Svg>
);

export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15" rx="1.75" />
    <path d="M3.5 9.5h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconScale = (p) => (
  <Svg {...p}>
    <path d="M12 4v16M7 20h10" />
    <path d="M5 7.5h14" />
    <path d="m5 7.5-2.5 6a3 3 0 0 0 5 0L5 7.5ZM19 7.5l-2.5 6a3 3 0 0 0 5 0L19 7.5Z" />
  </Svg>
);

export const IconSpark = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 13.8 10.2 20.5 12l-6.7 1.8L12 20.5l-1.8-6.7L3.5 12l6.7-1.8L12 3.5Z" />
  </Svg>
);

export const IconDots = (p) => (
  <Svg {...p} strokeWidth={0} fill="currentColor">
    <circle cx="5.5" cy="12" r="1.6" />
    <circle cx="12" cy="12" r="1.6" />
    <circle cx="18.5" cy="12" r="1.6" />
  </Svg>
);

export const IconExternal = (p) => (
  <Svg {...p}>
    <path d="M13.5 4.5h6v6M19.5 4.5l-8 8" />
    <path d="M17 13.5V18a1.5 1.5 0 0 1-1.5 1.5H6A1.5 1.5 0 0 1 4.5 18V8.5A1.5 1.5 0 0 1 6 7h4.5" />
  </Svg>
);

export const IconFilter = (p) => (
  <Svg {...p}>
    <path d="M4 6h16M7 12h10M10 18h4" />
  </Svg>
);

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="1.75" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </Svg>
);

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.75" />
  </Svg>
);

export const IconTable = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4.5" width="17" height="15" rx="1.75" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
  </Svg>
);

export const IconZoomIn = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M11 8.5v5M8.5 11h5" />
  </Svg>
);

export const IconZoomOut = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4.2-4.2M8.5 11h5" />
  </Svg>
);

export const IconRotate = (p) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.5 4v4h-4" />
  </Svg>
);

export const IconHistory = (p) => (
  <Svg {...p}>
    <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9" />
    <path d="M4.5 4.5V9H9M12 8v4.2l2.8 1.8" />
  </Svg>
);

export const IconBank = (p) => (
  <Svg {...p}>
    <path d="M3.5 9.5 12 4.5l8.5 5" />
    <path d="M5.5 10v7.5M10 10v7.5M14 10v7.5M18.5 10v7.5M3.5 20h17" />
  </Svg>
);

export const IconWhatsapp = (p) => (
  <Svg {...p}>
    <path d="M4 20l1.3-3.9A8.5 8.5 0 1 1 8.1 19L4 20Z" />
    <path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .8a4 4 0 0 1-2-2l.8-1-1-2L9 9.5Z" />
  </Svg>
);
