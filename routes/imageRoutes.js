const express = require("express");
const router = express.Router();
const controller = require("../controllers/imageController");

router.get("/download", controller.downloadImagesZip);
router.post("/download-and-save", controller.downloadAndSave);
router.post("/prepare/start", controller.startPrepareFrames);
router.post("/prepare/stop", controller.stopPrepareFrames);
router.post("/record-ws/start", controller.startRecordWS);
router.post("/record-ws/stop", controller.stopRecordWS);


module.exports = router;