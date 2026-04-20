const express = require("express");
const router = express.Router();
const controller = require("../controllers/imageController");

router.get("/download", controller.downloadImagesZip);
router.get("/download-and-save", controller.downloadAndSave);
router.post("/prepare", controller.prepareFrames);
router.post("/prepare/stop", controller.stopPrepareFrames);

module.exports = router;