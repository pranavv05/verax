const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/auth.routes");
const clientRoutes = require("./routes/clients.routes");
const documentRoutes = require("./routes/documents.routes");
const publicUploadRoutes = require("./routes/public-upload.routes");
const exportRoutes = require("./routes/exports.routes");
const extractionRoutes = require("./routes/extractions.routes");
const waitlistRoutes = require("./routes/waitlist.routes");
const firmRoutes = require("./routes/firms.routes");
const userRoutes = require("./routes/users.routes");
const auditRoutes = require("./routes/audit.routes");
const toolsRoutes = require("./routes/tools.routes");
const complianceRoutes = require("./routes/compliance.routes");
const notificationRoutes = require("./routes/notifications.routes");
const scheduledRequestRoutes = require("./routes/scheduled-requests.routes");
const env = require("./config/env");
const { notFoundHandler, errorHandler } = require("./middlewares/error.middleware");

const app = express();

app.disable("x-powered-by");
app.use(helmet());
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

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/upload", publicUploadRoutes);
app.use("/api/export", exportRoutes);
app.use("/api/extractions", extractionRoutes);
app.use("/api/waitlist", waitlistRoutes);
app.use("/api/firms", firmRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit-logs", auditRoutes);
app.use("/api/tools", toolsRoutes);
app.use("/api/compliance", complianceRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/scheduled-requests", scheduledRequestRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
