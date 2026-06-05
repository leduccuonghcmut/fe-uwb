# UWB Real-time Tracking System - Frontend

## Overview

Frontend for an **Ultra-Wideband (UWB) Real-time Tracking System** built with **React + Vite**.

### Features

* Firebase Authentication (Email/Password + Google OAuth)
* Real-time position tracking (2D/3D visualization)
* Geofence management (forbidden zones)
* Device configuration and status monitoring
* Live dashboard with analytics
* WebSocket communication via Socket.IO

## Project Structure

```text
src/
├── main.jsx
├── App.jsx
├── index.css
│
├── components/
│   ├── Header/
│   ├── Sidebar/
│   ├── OverviewCard/
│   └── ProtectedRoute.jsx
│
├── pages/
│   ├── Home/
│   ├── Login/
│   ├── Register/
│   ├── Dashboard/
│   ├── SystemConfig/
│   ├── LiveTracking/
│   ├── Export/
│   └── AdvancedFeature/
│
├── service/
│   ├── firebase.js
│   ├── auth.js
│   ├── socket.js
│   ├── deviceService.js
│   └── init-firebase.js
│
└── context/
    └── AuthContext.jsx
```

