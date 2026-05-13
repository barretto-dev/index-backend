const express = require("express");
const router = express.Router();
const pointCloudController = require("../controllers/pointCloudController");

router.post("/generation/start", pointCloudController.generationStart);
router.post("/generation/stop", pointCloudController.generationStop);

module.exports = router;