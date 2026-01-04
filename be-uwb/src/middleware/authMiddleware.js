// src/middleware/authMiddleware.js
const admin = require("../config/firebaseAdmin");

const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        req.user = decodedToken; // gắn thông tin user vào request
        next();
    } catch (error) {
        console.error("Token verify error:", error);
        return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
};

module.exports = verifyToken;