const express = require("express");
const Joi = require("joi");
const asyncHandler = require("../utils/async-handler");
const validate = require("../middlewares/validate.middleware");
const { addToWaitlist } = require("../services/waitlist.service");

const router = express.Router();

const waitlistSchema = Joi.object({
  email: Joi.string().email().required().custom((value, helpers) => {
    if (!value.endsWith("@gmail.com")) {
      return helpers.message("Only Gmail addresses are accepted.");
    }
    return value;
  })
});

router.post(
  "/join",
  validate(waitlistSchema),
  asyncHandler(async (req, res) => {
    const { email } = req.body;
    const entry = await addToWaitlist(email);

    res.status(201).json({
      success: true,
      message: "You've been added to the waitlist!",
      email: entry.email
    });
  })
);

module.exports = router;
