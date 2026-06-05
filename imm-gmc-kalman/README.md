# UWB Positioning Filter & BLE-Socket Gateway (IMM-GMC-Kalman)

This directory contains the Python gateway and filtering algorithms that process coordinates computed by UWB tags, filter them for noise, and synchronize the results with the Web Dashboard.

---

## System Architecture

The gateway operates in two independent directional loops:
1. **Uplink (Telemetry Flow)**: Scans for BLE advertisement packets from hardware nodes, filters tag coordinates using the IMM-GMC-Kalman filter, and emits updates to the Web Server via Socket.io.
2. **Downlink (Configuration Flow)**: Listens for configuration events from the Web Server, enqueues them, and broadcasts them down to physical UWB nodes via BLE.

---

