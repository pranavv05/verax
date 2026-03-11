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

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
