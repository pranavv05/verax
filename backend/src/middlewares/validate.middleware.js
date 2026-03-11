const ApiError = require("../utils/api-error");

const validate = (schema, source = "body") => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const message = error.details.map((detail) => detail.message).join(", ");
    return next(ApiError.badRequest(message));
  }

  req[source] = value;
  return next();
};

module.exports = validate;
