const ApiError = require("../utils/api-error");

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const isDev = process.env.NODE_ENV !== "production";
  const isKnownError = error instanceof ApiError;

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
