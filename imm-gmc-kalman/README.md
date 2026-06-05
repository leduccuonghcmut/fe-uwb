# UWB Positioning Filter & BLE-Socket Gateway (imm-gmc-kalman)

This directory contains the Python gateway and filtering algorithms that process coordinates computed by UWB tags, filter them for noise, and synchronize the results with the Web Dashboard.

---

## Real-time Data Flow & Architecture

```
[UWB Tag] 
   │  (Runs IM-IRLS Solver on-board to compute raw 2D coordinates)
   ▼
[BLE Advertisement Broadcast (15 Bytes payload)]
   │
   ▼ (Over-the-air BLE)
[Windows Bluetooth Adapter]
   │
   ▼ (Captured by BleakScanner in Gateway)
[uwb_gateway.py (BLE Scanner Callback)]
   │
   ▼ (Passes raw_x, raw_y)
[gmc_kalman.py (IMM-GMC-Kalman Filter)]
   │
   ├─► [Smooths trajectory, rejects NLOS outliers & locks jitter]
   │
   ▼ (Outputs final_x, final_y)
[Write to local 'vitri.txt'] ──► (Offline Logging)
   │
   ▼ (socket.emit("tag-update"))
[Backend Node.js Server (be-uwb)]
   │
   ▼ (Socket.io Broadcast)
[Web Frontend Dashboard (fe-uwb)] ──► (Renders position on 2D/3D map)
```

---

## Main Components & Files

1.  **`uwb_gateway.py` (Gateway Manager)**:
    *   **Uplink**: Scans for BLE advertising packets from UWB Tags/Anchors. Unpacks raw coordinates solved by **IM-IRLS** on-board, passes them to the Kalman filter, writes logs to `vitri.txt`, and sends the final coordinates to the Node.js backend.
    *   **Downlink (Configuration)**: Listens for Socket.io events (`set-device-role` & `update_anchor`) originating from the web administration page, packages them as BLE manufacturer payloads, and broadcasts them down to physical UWB nodes via the Windows Bluetooth advertiser.
2.  **`gmc_kalman.py` (IMM-GMC-Kalman Filter)**:
    *   Implements `GMC_Kalman4D` (Generalized Maximum Correntropy Kalman Filter with ZUPT zero-velocity updates and jitter-lock deadbands).
    *   Implements `IMM_GMC_Kalman` (Interacting Multiple Model framework). This handles switching dynamically between motion models (low process variance for standing still, high process variance for rapid movement) to keep tracking extremely responsive yet stable.
3.  **`uwb_logger.py` (Evaluation & Statistics Logger)**:
    *   Reads the real-time filtered output from `vitri.txt`.
    *   Allows entering Ground Truth (true coordinates) for specific test points.
    *   Calculates statistical benchmarks (Mean Position, Precision/StdDev, RMSE, CEP50, CEP90) and logs them to a CSV report for evaluation.

---

## Setup & Execution

### 1. Prerequisites
Ensure Bluetooth is turned on on your Windows host machine.

### 2. Install Python Dependencies
```bash
pip install python-socketio bleak winsdk numpy websocket-client
```

### 3. Adjust Server URL
Open [uwb_gateway.py](file:///d:/252_DATN/WEB_fe_uwb/fe-uwb/imm-gmc-kalman/uwb_gateway.py) and configure the Node.js Backend IP URL on line 29:
```python
SERVER_URL = "http://localhost:3000" # Change to Backend IP if running on a separate machine
```

### 4. Run the Gateway & Logger

*   **To run the main UWB BLE Gateway**:
    ```bash
    python uwb_gateway.py
    ```
*   **To run the Evaluation Logger** (in a separate terminal):
    ```bash
    python uwb_logger.py
    ```
    *This will prompt you for session info and log statistics to CSV.*