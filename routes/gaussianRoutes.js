const express = require("express");
const router = express.Router();
const gaussianController = require("../controllers/gaussianController");

router.post("/train/start", gaussianController.startTrain);

module.exports = router;