const express = require("express");
const router = express.Router();
const gaussianController = require("../controllers/gaussianController");

router.post("/train/start", gaussianController.startTrain);
router.post("/train/stop", gaussianController.stopTrain);

module.exports = router;