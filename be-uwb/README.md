# UWB Indoor Positioning System - Backend Server (be-uwb)

This is the backend server for the **UWB Indoor Positioning and Tracking System**. Built with **Node.js, Express, and Socket.io**, it acts as a real-time gateway/relay server between:
1. **Web Dashboard (Frontend)**: Renders the 2D/3D map, coordinates, zones, configuration inputs, and AI assistant chatbot.
2. **Raspberry Pi / Python Gateway (Hardware)**: Reads distance data from DW1000/DWM1001 modules, calculates positioning coordinates (via Kalman/Trilateration), and communicates device statuses.
3. **Firebase Realtime Database**: Persists device configurations, roles, calibration logs, and overall system state.

---

