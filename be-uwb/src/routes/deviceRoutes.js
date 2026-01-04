// src/routes/deviceRoutes.js
const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/deviceController");
const verifyToken = require("../middleware/authMiddleware");

// Áp dụng middleware xác thực cho tất cả route device
router.get("/devices", verifyToken, deviceController.getDevices);
router.patch("/devices/:docId", verifyToken, deviceController.updateDevice);

module.exports = router;