const express = require("express");
const asyncHandler = require("../utils/async-handler");
const { requireAuth } = require("../middlewares/auth.middleware");
const { getDashboardOverview } = require("../services/dashboard.service");

const router = express.Router();

router.use(requireAuth);

router.get(
  "/overview",
  asyncHandler(async (req, res) => {
    const result = await req.withTenantTransaction((db) =>
      getDashboardOverview(db, { firmId: req.user.firmId })
    );
    res.status(200).json(result);
  })
);

module.exports = router;
