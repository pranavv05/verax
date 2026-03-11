const ApiError = require("../utils/api-error");

const notFoundHandler = (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;
  const response = {
    error: error.error || "INTERNAL_SERVER_ERROR",
    message: error.message || "Internal server error",
    statusCode
  };

  if (statusCode >= 500 && process.env.NODE_ENV !== "production") {
    response.details = error.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
