const express = require("express");
const router = express.Router();
const convertController = require("../controllers/convertController");

router.post("/run", convertController.runConvert);

module.exports = router;