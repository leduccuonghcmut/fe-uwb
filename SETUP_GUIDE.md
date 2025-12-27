# Hướng Dẫn Chạy UWB Tracking System

Hệ thống bao gồm 3 thành phần chính:
1. **Python Simulation** (kalman_test) - Mô phỏng dữ liệu UWB
2. **Backend Server** (be-uwb) - Node.js server xử lý dữ liệu
3. **Frontend** (fe-uwb) - React app hiển thị 3D tracking

## Yêu Cầu Hệ Thống

### Python
- Python 3.7+
- Các thư viện: `numpy`, `requests`, `python-socketio[client]`

### Node.js
- Node.js 16+
- npm hoặc yarn

## Cài Đặt

### 1. Cài đặt Backend (be-uwb)

```bash
cd be-uwb
npm install
```

### 2. Cài đặt Frontend (fe-uwb)

```bash
cd fe-uwb
npm install
```

### 3. Cài đặt Python Dependencies

```bash
cd kalman_test/simulation
pip install numpy requests python-socketio[client]
```

## Chạy Hệ Thống

> **Lưu ý**: Phải chạy theo đúng thứ tự dưới đây!

### Bước 1: Khởi động Backend Server

Mở Terminal/PowerShell thứ nhất:

```bash
cd be-uwb
npm run dev
```

Bạn sẽ thấy:
```
Server running at http://localhost:3000
   • /push → tag position
   • anchors-update → anchor drift
   • Clients nhận: full-state-update
```

### Bước 2: Khởi động Frontend

Mở Terminal/PowerShell thứ hai:

```bash
cd fe-uwb
npm run dev
```

Frontend sẽ chạy tại http://localhost:5173 (hoặc port khác nếu 5173 đang bận)

### Bước 3: Chạy Python Simulation

Mở Terminal/PowerShell thứ ba:

```bash
cd kalman_test/simulation
python main.py
```

Bạn sẽ thấy:
```
===== REALTIME UWB → WEB PUSH (No delay after scenario switch) =====

Socket.IO connected
Tag → X=... Y=... Z=...
```

## Truy Cập Web App

1. Mở trình duyệt: http://localhost:5173
2. Đăng nhập/Đăng ký (nếu cần)
3. Vào trang **Live Tracking** để xem visualization 3D

## Kiểm Tra Kết Nối

### Backend logs sẽ hiển thị:
- `Frontend connected: <socket-id>` - Khi frontend kết nối
- `Tag → X=... Y=... Z=...` - Khi nhận dữ liệu từ Python
- `Anchors drift updated →` - Khi anchor positions thay đổi

### Frontend sẽ hiển thị:
- Hình khối 3D đại diện cho tag di chuyển theo thời gian thực
- 4 anchor points (A0, A1, A2, A3) ở các góc không gian

## Troubleshooting

### Port đã được sử dụng

**Backend (Port 3000):**
```bash
# Tìm process đang dùng port 3000
netstat -ano | findstr :3000
# Kill process (thay <PID> bằng số thực tế)
taskkill /PID <PID> /F
```

**Frontend (Port 5173):**
- Vite sẽ tự động dùng port khác nếu 5173 bận

### Python không kết nối được Backend

- Kiểm tra Backend đã chạy chưa
- Xác nhận URL trong `main.py`:
  - Line 8: `PUSH_URL = "http://localhost:3000/push"`
  - Line 52: `sio.connect("http://localhost:3000")`

### Frontend không nhận được dữ liệu

1. Kiểm tra Browser Console (F12)
2. Xem có lỗi WebSocket không
3. Kiểm tra CORS settings trong `be-uwb/src/server.js`

## Script Nhanh (Quick Start)

Tôi đã tạo các script để khởi động nhanh:

### Windows PowerShell

```powershell
# Chạy tất cả trong 1 lệnh
.\start-all.ps1
```

### Hoặc từng lệnh riêng

```powershell
.\start-backend.ps1   # Terminal 1
.\start-frontend.ps1  # Terminal 2  
.\start-python.ps1    # Terminal 3
```

## Cấu Trúc Dữ Liệu

### Tag Position (từ Python → Backend)
```javascript
{
  x: float,  // Tọa độ X (0-12m)
  y: float,  // Chiều cao (1.2-2.2m)
  z: float,  // Tọa độ Z (0-12m)
  timestamp: float
}
```

### Anchors (từ Python → Backend)
```javascript
{
  A0: { x, y, z },
  A1: { x, y, z },
  A2: { x, y, z },
  A3: { x, y, z }
}
```

### Full State (Backend → Frontend)
```javascript
{
  tag: { x, y, z, timestamp },
  anchors: { A0, A1, A2, A3 }
}
```

## Lưu Ý Quan Trọng

1. **Thứ tự khởi động**: Backend → Frontend → Python
2. **Port cần thiết**: 3000 (backend), 5173 (frontend)
3. **Hệ tọa độ**: Y là chiều cao (vertical)
4. **Update rate**: 10 Hz (mỗi 0.1s)
5. **Scenarios**: Tự động chuyển đổi mỗi 10 giây

## Tùy Chỉnh

### Thay đổi Update Rate

File: `kalman_test/simulation/main.py`
```python
dt = 0.1  # Line 168 - Thay đổi từ 0.1 (10Hz) sang 0.05 (20Hz)
```

### Thay đổi Scenario Duration

File: `kalman_test/simulation/main.py`
```python
SCENARIO_DUR_S = 10.0  # Line 9 - Thời gian mỗi scenario (giây)
```

### Thay đổi Backend Port

File: `be-uwb/src/server.js`
```javascript
const PORT = 3000;  // Line 88 - Thay đổi port
```

Sau đó cập nhật trong `main.py`:
```python
PUSH_URL = "http://localhost:YOUR_NEW_PORT/push"
sio.connect("http://localhost:YOUR_NEW_PORT")
```
