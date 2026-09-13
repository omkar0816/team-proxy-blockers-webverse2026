const express = require("express");
const { createScore, getScores } = require("../controllers/scoreController");

const router = express.Router();

router.post("/", createScore);
router.get("/:patientId", getScores);

module.exports = router;