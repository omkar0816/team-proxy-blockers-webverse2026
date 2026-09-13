const express = require("express");
const { getPatient } = require("../controllers/patientController");

const router = express.Router();

router.get("/", getPatient);

module.exports = router;