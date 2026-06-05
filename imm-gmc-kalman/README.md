# UWB Positioning Filter & BLE-Socket Gateway (IMM-GMC-Kalman)

This directory contains the Python gateway and filtering algorithms that process coordinates computed by UWB tags, filter them for noise, and synchronize the results with the Web Dashboard.

---

## Real-time Data Flow & Architecture

```
[UWB Tag] 
   │  (Runs IM-IRLS Solver on-board to compute raw 2D coordinates)
   ▼
[BLE Advertisement Broadcast]
   │
   ▼ 
[Bluetooth Adapter]
   │
   ▼ 
[uwb_gateway.py]
   │
   ▼ 
[gmc_kalman.py (IMM-GMC-Kalman Filter)]
   │
   ├─► [Smooths trajectory, rejects NLOS outliers & locks jitter]
   │
   ▼ 
[Backend Node.js Server (be-uwb)]
   │
   ▼ 
[Web Frontend Dashboard (fe-uwb)] ──► (Renders position on 2D/3D map)
```
