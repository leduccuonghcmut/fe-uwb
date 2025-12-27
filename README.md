# UWB Real-time Tracking System

Hệ thống tracking 3D real-time sử dụng công nghệ UWB (Ultra-Wideband) với Kalman Filter.

## 🚀 Quick Start

### Cách đơn giản nhất (Windows)

```powershell
.\start-all.ps1
```

Script này sẽ tự động mở 3 cửa sổ cho:
1. Backend Server (Node.js)
2. Frontend (React)
3. Python Simulation

### Cách thủ công

**Terminal 1 - Backend:**
```powershell
.\start-backend.ps1
```

**Terminal 2 - Frontend:**
```powershell
.\start-frontend.ps1
```

**Terminal 3 - Python:**
```powershell
.\start-python.ps1
```

## 📁 Cấu trúc Project

```
fe-uwb/
├── be-uwb/              # Node.js Backend Server
│   ├── src/
│   │   └── server.js    # WebSocket & HTTP server
│   └── package.json
│
├── fe-uwb/              # React Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   └── LiveTracking/  # 3D Visualization
│   │   └── App.jsx
│   └── package.json
│
├── kalman_test/         # Python Simulation
│   └── simulation/
│       ├── main.py                  # Main simulation loop
│       ├── hybrid_scalable.py       # UWB positioning algorithm
│       └── gmc_kalman_filter.py     # Kalman filter
│
├── start-all.ps1        # Launch all components
├── start-backend.ps1    # Launch backend only
├── start-frontend.ps1   # Launch frontend only
├── start-python.ps1     # Launch Python only
└── SETUP_GUIDE.md       # Chi tiết hướng dẫn
```

## 🔧 Yêu cầu

- **Node.js** 16+ 
- **Python** 3.7+
- **npm** hoặc **yarn**

## 📊 Luồng Dữ Liệu

```
Python Simulation
      ↓ (HTTP GET /push + Socket.IO)
Backend Server (Port 3000)
      ↓ (WebSocket)
React Frontend (Port 5173)
      ↓
3D Visualization (Three.js)
```

## 🌐 Truy cập

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

## 📖 Tài liệu chi tiết

Xem [SETUP_GUIDE.md](./SETUP_GUIDE.md) để có hướng dẫn chi tiết về:
- Cài đặt dependencies
- Troubleshooting
- Tùy chỉnh cấu hình
- Cấu trúc dữ liệu

## 🎯 Features

- ✅ Real-time 3D tracking visualization
- ✅ Kalman Filter smoothing
- ✅ Multi-scenario simulation
- ✅ WebSocket live updates
- ✅ Anchor drift compensation
- ✅ 10Hz update rate

## 🐛 Troubleshooting

### Port đã được sử dụng
```powershell
# Tìm process sử dụng port 3000
netstat -ano | findstr :3000

# Kill process
taskkill /PID <PID> /F
```

### Python không kết nối được
- Kiểm tra Backend đã chạy chưa
- Đảm bảo port 3000 không bị block bởi firewall

### Không thấy dữ liệu trên Frontend
- Mở Browser Console (F12)
- Kiểm tra WebSocket connection
- Xem Backend logs có nhận dữ liệu không

## 📝 License

MIT
