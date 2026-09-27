// Hosting-platform domains that are on the Public Suffix List: every
// subdomain of one (my-app.vercel.app) is its own "site" to a browser, so it
// can never be same-site with the API. The refresh-token cookie is
// SameSite=Strict and the access token lives only in memory, so a frontend
// served from one of these while the API is elsewhere logs users out on every
// page reload — the frontend and API must share a registrable domain (e.g.
// app.yourdomain.in + api.yourdomain.in).
const PLATFORM_SUFFIXES = [
  "vercel.app",
  "onrender.com",
  "netlify.app",
  "herokuapp.com",
  "pages.dev",
  "github.io",
  "fly.dev",
  "up.railway.app",
  "azurewebsites.net",
  "web.app",
  "firebaseapp.com"
];

const getPlatformSuffix = (hostname) =>
  PLATFORM_SUFFIXES.find((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`)) || null;

// Returns a warning string when FRONTEND_URL can't share cookies with the
// API, or null when it's fine (or unparseable — env.js already validates it).
const getFrontendDomainWarning = (frontendUrl) => {
  let hostname;
  try {
    hostname = new URL(frontendUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const suffix = getPlatformSuffix(hostname);
  if (!suffix) {
    return null;
  }
  return (
    `FRONTEND_URL (${hostname}) is on the shared platform domain "${suffix}", which browsers ` +
    "treat as its own site. The SameSite=Strict refresh cookie will not be sent to the API from " +
    "there, so users will be logged out on every page reload. Serve the frontend and API from " +
    "one domain you own (e.g. app.yourdomain.in and api.yourdomain.in)."
  );
};

module.exports = { getFrontendDomainWarning };
