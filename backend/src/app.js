const Sentry = require("@sentry/node");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const clientAuthRoutes = require("./routes/client-auth.routes");
const clientPortalRoutes = require("./routes/client-portal.routes");
const clientRoutes = require("./routes/clients.routes");
const documentRoutes = require("./routes/documents.routes");
const publicUploadRoutes = require("./routes/public-upload.routes");
const exportRoutes = require("./routes/exports.routes");
const extractionRoutes = require("./routes/extractions.routes");
const waitlistRoutes = require("./routes/waitlist.routes");
const firmRoutes = require("./routes/firms.routes");
const userRoutes = require("./routes/users.routes");
const auditRoutes = require("./routes/audit.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const toolsRoutes = require("./routes/tools.routes");
const complianceRoutes = require("./routes/compliance.routes");
const notificationRoutes = require("./routes/notifications.routes");
const scheduledRequestRoutes = require("./routes/scheduled-requests.routes");
const narrationMappingRoutes = require("./routes/narration-mappings.routes");
const env = require("./config/env");
const pool = require("./db/pool");
const { checkRedisHealth } = require("./services/document-queue.service");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");
const localUploadRoutes = env.LOCAL_STORAGE ? require("./routes/local-upload.routes") : null;

const app = express();

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        frameAncestors: ["'self'", "http://localhost:5174"]
      }
    }
  })
);
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

if (env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// Checks actual dependency health, not just "the process is up" — Render's
// healthCheckPath uses this to decide whether to route traffic to this
// instance. A liveness-only check (always 200) can't detect a backend that's
// up but can't reach its database or Redis, which is exactly the failure
// mode that matters in production.
const HEALTH_CHECK_TIMEOUT_MS = 4000;
const withTimeout = (promise, ms, label) =>
  Promise.race([
    promise,
    new Promise((_resolve, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms))
  ]);

app.get("/health", async (req, res) => {
  try {
    await Promise.all([
      withTimeout(pool.query("SELECT 1"), HEALTH_CHECK_TIMEOUT_MS, "Postgres check"),
      withTimeout(checkRedisHealth(), HEALTH_CHECK_TIMEOUT_MS, "Redis check")
    ]);
    res.status(200).json({ status: "ok" });
  } catch (error) {
    res.status(503).json({ status: "error", message: error.message });
  }
});

app.use("/api/auth", authRoutes);
// Client portal — a separate auth world. Mounted before /api/clients so the
// more specific prefix wins, and guarded exclusively by requireClientAuth.
app.use("/api/client-portal/auth", clientAuthRoutes);
app.use("/api/client-portal", clientPortalRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/upload", publicUploadRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/extractions", extractionRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/firms", firmRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/scheduled-requests", scheduledRequestRoutes);
app.use("/api/narration-mappings", narrationMappingRoutes);
if (env.LOCAL_STORAGE) {
  app.use("/api", localUploadRoutes);
}

app.use(notFoundHandler);

if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

app.use(errorHandler);

module.exports = app;
