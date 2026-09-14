const express = require("express");
const { verifyToken } = require("../middleware/authMiddleware");
const patientController = require("../controllers/patientController");

const router = express.Router();

router.get("/register", patientController.register);
router.post("/login", patientController.login);
router.post("/logout", verifyToken, patientController.logout);
router.get("/verify", verifyToken, patientController.verifyTokenEndpoint);
router.get("/", patientController.getPatient);

module.exports = router;