const express = require("express");
const router = express.Router();
const outputController = require("../controllers/outputController");

router.get("/folders", outputController.listFolders);
router.delete("/folder/:name", outputController.deleteFolder);

module.exports = router;