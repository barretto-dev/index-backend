const express = require("express");
const router = express.Router();
const controller = require("../controllers/sibrController");

router.get("/start", controller.start);
router.get("/stop", controller.stop);

module.exports = router;