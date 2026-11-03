const ApiError = require("../utils/api-error");

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

// express.json() failures: a client mistake, not a server one. Give them a
// proper code and a fixed message instead of the parser's internals.
const BODY_PARSER_ERRORS = {
  "entity.parse.failed": { error: "BAD_REQUEST", message: "Request body is not valid JSON" },
  "entity.too.large": { error: "PAYLOAD_TOO_LARGE", message: "Request body is too large" },
  "encoding.unsupported": { error: "BAD_REQUEST", message: "Unsupported request encoding" },
  "charset.unsupported": { error: "BAD_REQUEST", message: "Unsupported request charset" }
};

const errorHandler = (error, req, res, next) => {
  const parserError = error && BODY_PARSER_ERRORS[error.type];
  if (parserError) {
    const statusCode = error.statusCode || error.status || 400;
    return res.status(statusCode).json({ ...parserError, statusCode });
  }

  const statusCode = error.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";
  const isKnownError = error instanceof ApiError;

  // An unexpected failure must leave a trace on the server even when the
  // client only sees "Internal server error" — otherwise, with no Sentry DSN
  // set, production 500s vanish (morgan logs only the status line). Method and
  // path only: never the body, which can hold passwords or invoice data.
  if (statusCode >= 500 && !isKnownError) {
    process.stderr.write(`[unhandled ${statusCode}] ${req.method} ${req.originalUrl.split("?")[0]}: ${error.stack || error.message}\n`);
  }

  // An unexpected (non-ApiError) 5xx can be a raw DB/AWS/upstream exception —
  // its .message is not written to be client-facing, so never echo it in production.
  const message =
    !isDev && statusCode >= 500 && !isKnownError
      ? "Internal server error"
      : error.message || "Internal server error";

  const response = {
    error: error.error || "INTERNAL_SERVER_ERROR",
    message,
    statusCode,
    ...(isDev && { stack: error.stack }),
    ...(isDev && { details: error.details })
  };

  res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
