// src/controllers/deviceController.js
const deviceService = require("../services/deviceService");

exports.getDevices = async (req, res) => {
    try {
        const devices = await deviceService.fetchDevices();
        res.json(devices);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch devices" });
    }
};

exports.updateDevice = async (req, res) => {
    const { docId } = req.params;
    const data = req.body;

    try {
        await deviceService.updateDevice(docId, data);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Failed to update device" });
    }
};