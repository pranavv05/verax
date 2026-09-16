class ApiError extends Error {
  constructor(statusCode, message, error) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.error = error;
  }

  static badRequest(message) {
    return new ApiError(400, message, "BAD_REQUEST");
  }

  static unauthorized(message = "Unauthorized") {
    return new ApiError(401, message, "UNAUTHORIZED");
  }

  static forbidden(message = "Forbidden") {
    return new ApiError(403, message, "FORBIDDEN");
  }

  static notFound(message = "Not found") {
    return new ApiError(404, message, "NOT_FOUND");
  }

  static conflict(message) {
    return new ApiError(409, message, "CONFLICT");
  }

  static invalidFileType(message = "Only PDF, JPG, PNG, and Excel files are allowed") {
    return new ApiError(422, message, "INVALID_FILE_TYPE");
  }
}

module.exports = ApiError;
